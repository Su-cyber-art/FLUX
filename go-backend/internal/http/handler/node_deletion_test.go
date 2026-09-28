package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"go-backend/internal/security"
	"go-backend/internal/store/model"
	"go-backend/internal/store/repo"
)

func newDeletionHandler(t *testing.T, path string) *Handler {
	t.Helper()
	r, err := repo.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { r.Close() })
	h := New(r, "test-secret")
	h.wsServer.SetNodeOnlineHook(nil)
	return h
}
func seedDeletionNode(t *testing.T, h *Handler, id int64, remote int) *model.Node {
	t.Helper()
	n := &model.Node{ID: id, Name: "delete-me", Secret: "deletion-secret", ServerIP: "127.0.0.1", Port: "1000-65535", Status: 0, IsRemote: remote, ForwardMode: "agent", Version: sql.NullString{String: "3.1.1", Valid: true}}
	if err := h.repo.DB().Create(n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}
func connectDeletionAgent(t *testing.T, serverURL, secret string, clean bool) <-chan string {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(serverURL, "http")+"?type=1&secret="+url.QueryEscape(secret)+"&version=3.1.1", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	commands := make(chan string, 20)
	cipher, _ := security.NewAESCrypto(secret)
	go func() {
		defer close(commands)
		for {
			_, payload, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var envelope struct {
				Encrypted bool   `json:"encrypted"`
				Data      string `json:"data"`
			}
			json.Unmarshal(payload, &envelope)
			if envelope.Encrypted {
				payload, err = cipher.Decrypt(envelope.Data)
				if err != nil {
					return
				}
			}
			var cmd struct {
				Type      string `json:"type"`
				RequestID string `json:"requestId"`
			}
			if json.Unmarshal(payload, &cmd) != nil {
				return
			}
			commands <- cmd.Type
			success := clean || cmd.Type == "FinalizeNodeDeletion"
			response := map[string]interface{}{"type": cmd.Type + "Response", "requestId": cmd.RequestID, "success": success, "message": "cleanup rejected", "data": map[string]bool{"cleaned": clean}}
			if conn.WriteJSON(response) != nil {
				return
			}
		}
	}()
	return commands
}
func waitDeletionNodeOnline(t *testing.T, h *Handler, id int64) {
	t.Helper()
	waitForCondition(t, 3*time.Second, func() bool { n, _ := h.repo.GetNodeByID(id); return n != nil && n.Status == 1 }, "agent online")
}
func assertNodeAbsent(t *testing.T, h *Handler, id int64) {
	t.Helper()
	n, err := h.repo.GetNodeByID(id)
	if err != nil || n != nil {
		t.Fatalf("node remains: %+v, %v", n, err)
	}
}

func TestNodeDeletionRequiresConfirmedAgentCleanup(t *testing.T) {
	for _, clean := range []bool{false, true} {
		t.Run(map[bool]string{false: "failure retained", true: "success removed"}[clean], func(t *testing.T) {
			h := newDeletionHandler(t, filepath.Join(t.TempDir(), "delete.db"))
			n := seedDeletionNode(t, h, 1, 0)
			server := httptest.NewServer(h.WebSocketHandler())
			defer server.Close()
			commands := connectDeletionAgent(t, server.URL, n.Secret, clean)
			waitDeletionNodeOnline(t, h, n.ID)
			err := h.deleteNodeByID(n.ID)
			if clean {
				if err != nil {
					t.Fatal(err)
				}
				assertNodeAbsent(t, h, n.ID)
				if <-commands != "RetireNode" || <-commands != "FinalizeNodeDeletion" {
					t.Fatal("incorrect cleanup protocol")
				}
				conn, response, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http")+"?type=1&secret="+n.Secret, nil)
				if conn != nil {
					conn.Close()
				}
				if err == nil || response == nil || response.StatusCode != 403 {
					t.Fatal("deleted enrollment was accepted")
				}
			} else {
				if err == nil {
					t.Fatal("unconfirmed cleanup must fail")
				}
				node, _ := h.repo.GetNodeByID(n.ID)
				if node == nil || node.DeleteState != 1 {
					t.Fatalf("must retain pending node: %+v", node)
				}
				if _, err := h.repo.GetNodeRecord(n.ID); err == nil {
					t.Fatal("retiring node can still be assigned")
				}
				if _, err := h.wsServer.SendCommand(n.ID, "AddService", nil, time.Second); err == nil {
					t.Fatal("retiring node accepted deployment")
				}
			}
		})
	}
}

func TestOfflineDeletionResumesAfterPanelRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "delete.db")
	h := newDeletionHandler(t, path)
	n := seedDeletionNode(t, h, 1, 0)
	if h.deleteNodeByID(n.ID) == nil {
		t.Fatal("offline deletion must not claim completion")
	}
	h.repo.Close()
	h = newDeletionHandler(t, path)
	h.wsServer.SetNodeOnlineHook(h.onNodeOnline)
	server := httptest.NewServer(h.WebSocketHandler())
	defer server.Close()
	commands := connectDeletionAgent(t, server.URL, n.Secret, true)
	select {
	case command := <-commands:
		if command != "RetireNode" {
			t.Fatalf("reconnect restored runtime before cleanup: %s", command)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("cleanup did not resume")
	}
	waitForCondition(t, 3*time.Second, func() bool { n, _ := h.repo.GetNodeByID(1); return n == nil }, "durable deletion")
}

func TestNodeDeletionPreservesSharedProviderAndDependencies(t *testing.T) {
	h := newDeletionHandler(t, filepath.Join(t.TempDir(), "delete.db"))
	imported := seedDeletionNode(t, h, 1, 1)
	if err := h.deleteNodeByID(imported.ID); err != nil {
		t.Fatal(err)
	}
	assertNodeAbsent(t, h, imported.ID)
	n := seedDeletionNode(t, h, 2, 0)
	if err := h.repo.DB().Create(&model.ChainTunnel{NodeID: n.ID, TunnelID: 8, ChainType: "1"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := h.deleteNodeByID(n.ID); err == nil || !strings.Contains(err.Error(), "隧道") {
		t.Fatalf("dependency lost: %v", err)
	}
	node, _ := h.repo.GetNodeByID(n.ID)
	if node.DeleteState != 0 {
		t.Fatal("referenced node must remain active")
	}
}

func TestNftNodeDeletionClearsRulesAndPrivateData(t *testing.T) {
	f := setupNftablesHandler(t)
	defer f.handler.repo.Close()
	seedNftablesSSHConfig(t, f.handler, f.nodeID)
	manager := &fakeNftablesManager{clearErr: errors.New("SSH unavailable")}
	f.handler.nftablesManager = manager
	if err := f.handler.deleteNodeByID(f.nodeID); err == nil {
		t.Fatal("failed SSH clear must retain node")
	}
	if node, _ := f.handler.repo.GetNodeByID(f.nodeID); node == nil {
		t.Fatal("node lost on SSH failure")
	}
	manager.clearErr = nil
	if err := f.handler.deleteNodeByID(f.nodeID); err != nil {
		t.Fatal(err)
	}
	assertNodeAbsent(t, f.handler, f.nodeID)
	for _, table := range []interface{}{&model.NodeSSHConfig{}, &model.NftRuleBinding{}, &model.NodeMetric{}, &model.ServiceMonitorResult{}} {
		var count int64
		if err := f.handler.repo.DB().Model(table).Where("node_id = ?", f.nodeID).Count(&count).Error; err != nil || count != 0 {
			t.Fatalf("leftover node data: %T count=%d err=%v", table, count, err)
		}
	}
}

func TestBatchNodeDeletionReportsIndividualFailures(t *testing.T) {
	h := newDeletionHandler(t, filepath.Join(t.TempDir(), "delete.db"))
	seedDeletionNode(t, h, 1, 1)
	seedDeletionNode(t, h, 2, 0)
	rec := postJSONToHandler(t, h.nodeBatchDelete, map[string]interface{}{"ids": []int64{1, 2}})
	var body struct {
		Code int                  `json:"code"`
		Data batchOperationResult `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Code != 0 || body.Data.SuccessCount != 1 || body.Data.FailCount != 1 || len(body.Data.Failures) != 1 || body.Data.Failures[0].ID != 2 {
		t.Fatalf("incorrect batch result: %+v", body)
	}
	assertNodeAbsent(t, h, 1)
	if n, _ := h.repo.GetNodeByID(2); n == nil {
		t.Fatal("failed node disappeared")
	}
}
