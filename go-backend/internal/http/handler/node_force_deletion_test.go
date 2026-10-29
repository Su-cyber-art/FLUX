package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"go-backend/internal/auth"
	"go-backend/internal/http/middleware"
	"go-backend/internal/store/model"
)

func assertDeletedCredentialRejected(t *testing.T, h *Handler, secret string) {
	t.Helper()
	server := httptest.NewServer(h.WebSocketHandler())
	defer server.Close()
	conn, res, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http")+"?type=1&secret="+url.QueryEscape(secret), nil)
	if conn != nil {
		conn.Close()
	}
	if res != nil {
		defer res.Body.Close()
	}
	if err == nil || res == nil || res.StatusCode != http.StatusForbidden {
		t.Fatalf("removed node credential was not rejected: response=%v error=%v", res, err)
	}
}

func assertNoRemovalCommands(t *testing.T, commands <-chan string) {
	t.Helper()
	select {
	case command, ok := <-commands:
		if ok {
			t.Fatalf("panel-only removal sent a remote command: %s", command)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("removed agent connection was not closed")
	}
}

func TestForceRemoveOfflineNodeRevokesCredentialAndClearsLocalData(t *testing.T) {
	for _, pending := range []bool{false, true} {
		t.Run(map[bool]string{false: "never requested cleanup", true: "waiting for offline agent"}[pending], func(t *testing.T) {
			h := newDeletionHandler(t, filepath.Join(t.TempDir(), "force-delete.db"))
			node := seedDeletionNode(t, h, 1, 0)
			for _, record := range []interface{}{
				&model.NodeMetric{NodeID: node.ID, Timestamp: time.Now().UnixMilli()},
				&model.NodeSSHConfig{NodeID: node.ID, Host: "192.0.2.1", Username: "root", AuthType: "password"},
				&model.FlowReportCursor{NodeID: node.ID, ProducerID: "old-agent", Sequence: 1},
			} {
				if err := h.repo.DB().Create(record).Error; err != nil {
					t.Fatal(err)
				}
			}
			if pending && h.deleteNodeByID(node.ID) == nil {
				t.Fatal("offline cleanup was incorrectly reported as complete")
			}
			rec := postJSONToHandler(t, h.nodeForceDelete, map[string]interface{}{"id": node.ID})
			var result struct {
				Code int `json:"code"`
				Data struct {
					Removed bool `json:"removed"`
					Cleaned bool `json:"remoteCleanupConfirmed"`
				} `json:"data"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if result.Code != 0 || !result.Data.Removed || result.Data.Cleaned {
				t.Fatalf("incorrect local removal result: %s", rec.Body.String())
			}
			assertNodeAbsent(t, h, node.ID)
			for _, table := range []interface{}{&model.NodeMetric{}, &model.NodeSSHConfig{}, &model.FlowReportCursor{}} {
				var count int64
				if err := h.repo.DB().Model(table).Where("node_id = ?", node.ID).Count(&count).Error; err != nil || count != 0 {
					t.Fatalf("local data remained: %T count=%d err=%v", table, count, err)
				}
			}
			assertDeletedCredentialRejected(t, h, node.Secret)
		})
	}
}

func TestForceRemoveConnectedOldAgentDoesNotAttemptUninstall(t *testing.T) {
	h := newDeletionHandler(t, filepath.Join(t.TempDir(), "force-delete.db"))
	node := seedDeletionNode(t, h, 1, 0)
	server := httptest.NewServer(h.WebSocketHandler())
	defer server.Close()
	commands := connectDeletionAgent(t, server.URL, node.Secret, false)
	waitDeletionNodeOnline(t, h, node.ID)
	if err := h.removeNodeByID(node.ID, true); err != nil {
		t.Fatal(err)
	}
	assertNodeAbsent(t, h, node.ID)
	assertNoRemovalCommands(t, commands)
	assertDeletedCredentialRejected(t, h, node.Secret)
}

func TestForceRemovalIntentSurvivesFailureAndRestartWithoutRemoteCleanup(t *testing.T) {
	path := filepath.Join(t.TempDir(), "force-delete.db")
	h := newDeletionHandler(t, path)
	node := seedDeletionNode(t, h, 1, 0)
	if err := h.repo.DB().Create(&model.NodeMetric{NodeID: node.ID, Timestamp: 1}).Error; err != nil {
		t.Fatal(err)
	}
	if err := h.repo.DB().Exec(`CREATE TRIGGER reject_node_removal BEFORE DELETE ON node BEGIN SELECT RAISE(FAIL, 'temporary deletion failure'); END`).Error; err != nil {
		t.Fatal(err)
	}
	if err := h.removeNodeByID(node.ID, true); err == nil {
		t.Fatal("database failure was ignored")
	}
	remaining, err := h.repo.GetNodeByID(node.ID)
	if err != nil || remaining == nil || remaining.DeleteState != model.NodeDeletionPanelOnly {
		t.Fatalf("panel-only intent was lost or falsely marked cleaned: %+v %v", remaining, err)
	}
	var count int64
	if err := h.repo.DB().Model(&model.NodeMetric{}).Where("node_id = ?", node.ID).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("failed deletion did not roll back local data: count=%d err=%v", count, err)
	}
	if err := h.repo.DB().Exec(`DROP TRIGGER reject_node_removal`).Error; err != nil {
		t.Fatal(err)
	}
	if err := h.repo.Close(); err != nil {
		t.Fatal(err)
	}
	h = newDeletionHandler(t, path)
	h.wsServer.SetNodeOnlineHook(h.onNodeOnline)
	server := httptest.NewServer(h.WebSocketHandler())
	defer server.Close()
	commands := connectDeletionAgent(t, server.URL, node.Secret, false)
	waitForCondition(t, 3*time.Second, func() bool { n, _ := h.repo.GetNodeByID(node.ID); return n == nil }, "panel-only removal resumed")
	assertNoRemovalCommands(t, commands)
}

func TestForceRemoveNftablesNodeSkipsSSHButDeletesCredentials(t *testing.T) {
	f := setupNftablesHandler(t)
	defer f.handler.repo.Close()
	seedNftablesSSHConfig(t, f.handler, f.nodeID)
	manager := &fakeNftablesManager{clearErr: errors.New("server permanently unavailable")}
	f.handler.nftablesManager = manager
	if err := f.handler.removeNodeByID(f.nodeID, true); err != nil {
		t.Fatal(err)
	}
	if manager.clearHit != 0 {
		t.Fatal("panel-only removal attempted SSH cleanup")
	}
	assertNodeAbsent(t, f.handler, f.nodeID)
	var count int64
	if err := f.handler.repo.DB().Model(&model.NodeSSHConfig{}).Where("node_id = ?", f.nodeID).Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("SSH credentials retained: count=%d err=%v", count, err)
	}
}

func TestForceRemovalPreservesReferencesAndReportsBatchFailures(t *testing.T) {
	h := newDeletionHandler(t, filepath.Join(t.TempDir(), "force-delete.db"))
	seedDeletionNode(t, h, 1, 0)
	node := seedDeletionNode(t, h, 2, 0)
	if err := h.repo.DB().Create(&model.ChainTunnel{NodeID: node.ID, TunnelID: 8, ChainType: "1"}).Error; err != nil {
		t.Fatal(err)
	}
	rec := postJSONToHandler(t, h.nodeBatchForceDelete, map[string]interface{}{"ids": []int64{1, 2}})
	var result struct {
		Code int                  `json:"code"`
		Data batchOperationResult `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Code != 0 || result.Data.SuccessCount != 1 || result.Data.FailCount != 1 || len(result.Data.Failures) != 1 || result.Data.Failures[0].ID != 2 {
		t.Fatalf("incorrect forced batch result: %s", rec.Body.String())
	}
	assertNodeAbsent(t, h, 1)
	remaining, err := h.repo.GetNodeByID(2)
	if err != nil || remaining == nil || remaining.DeleteState != 0 {
		t.Fatalf("referenced node was changed: %+v %v", remaining, err)
	}
}

func TestForceRemovalRechecksReferencesBeforeCommitting(t *testing.T) {
	h := newDeletionHandler(t, filepath.Join(t.TempDir(), "force-delete.db"))
	node := seedDeletionNode(t, h, 1, 0)
	if err := h.repo.BeginForceNodeDeletion(node.ID); err != nil {
		t.Fatal(err)
	}
	if err := h.repo.DB().Create(&model.ForwardPort{NodeID: node.ID, ForwardID: 20, Port: 31001}).Error; err != nil {
		t.Fatal(err)
	}
	if err := h.repo.ForceDeleteNodeCascade(node.ID); err == nil || !strings.Contains(err.Error(), "转发") {
		t.Fatalf("late reference was silently removed: %v", err)
	}
	if err := h.repo.DeleteNodeCascade(node.ID); err == nil {
		t.Fatal("panel-only intent was treated as an agent cleanup acknowledgement")
	}
}

func TestForceRemovalEndpointsRequireExplicitAdminRequests(t *testing.T) {
	for _, path := range []string{"/api/v1/node/force-delete", "/api/v1/node/batch-force-delete"} {
		t.Run(path, func(t *testing.T) {
			h := newDeletionHandler(t, filepath.Join(t.TempDir(), "force-delete.db"))
			node := seedDeletionNode(t, h, 1, 0)
			mux := http.NewServeMux()
			h.Register(mux)
			wrapped := middleware.JWT(middleware.AuthOptions{JWTSecret: "test-secret", GetUserAuthState: func(id int64) (*auth.UserAuthState, error) {
				role := 0
				if id == 2 {
					role = 1
				}
				return &auth.UserAuthState{ID: id, RoleID: role, Status: 1}, nil
			}})(mux)
			for _, user := range []struct {
				id         int64
				role, want int
			}{{0, 0, 401}, {2, 1, 403}, {1, 0, 0}} {
				req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"id":1,"ids":[1]}`))
				if user.id > 0 {
					token, err := auth.GenerateToken(user.id, "test-user", user.role, "test-secret")
					if err != nil {
						t.Fatal(err)
					}
					req.Header.Set("Authorization", token)
				}
				rec := httptest.NewRecorder()
				wrapped.ServeHTTP(rec, req)
				var result struct {
					Code int `json:"code"`
				}
				if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
					t.Fatal(err)
				}
				if result.Code != user.want {
					t.Fatalf("want %d: %s", user.want, rec.Body.String())
				}
				if user.want != 0 {
					remaining, err := h.repo.GetNodeByID(node.ID)
					if err != nil || remaining == nil || remaining.DeleteState != 0 {
						t.Fatalf("unauthorized request altered node: %+v %v", remaining, err)
					}
				}
			}
			assertNodeAbsent(t, h, node.ID)
		})
	}
	h := newDeletionHandler(t, filepath.Join(t.TempDir(), "normal-delete.db"))
	node := seedDeletionNode(t, h, 1, 0)
	rec := postJSONToHandler(t, h.nodeDelete, map[string]interface{}{"id": node.ID, "force": true})
	remaining, err := h.repo.GetNodeByID(node.ID)
	if err != nil || remaining == nil || remaining.DeleteState != 1 {
		t.Fatalf("ordinary deletion bypassed cleanup: %s", rec.Body.String())
	}
}
