package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"go-backend/internal/store/model"
)

func TestTunnelUpdateReportsSavedConfigurationWithPendingForwardSync(t *testing.T) {
	fixture := identifiedFlowTestHandler(t)
	h := New(fixture.repo, "test-secret")
	if err := h.repo.DB().Exec(`INSERT INTO chain_tunnel(tunnel_id, chain_type, node_id, port, protocol, strategy, inx) VALUES(1, '1', 11, 31001, 'tls', 'round', 1)`).Error; err != nil {
		t.Fatal(err)
	}
	if err := h.repo.DB().Create(&model.Node{ID: 12, Name: "new-entry", Secret: "new-entry-secret", ServerIP: "127.0.0.1", Port: "30000-40000", HTTP: 1, TLS: 1, Socks: 1, Status: 1}).Error; err != nil {
		t.Fatal(err)
	}
	body := `{"id":1,"name":"saved-but-pending","type":1,"flow":1,"trafficRatio":1,"status":1,"inNodeId":[{"nodeId":12,"protocol":"tls"}]}`
	res := httptest.NewRecorder()
	h.tunnelUpdate(res, httptest.NewRequest(http.MethodPost, "/api/v1/tunnel/update", strings.NewReader(body)))
	var payload struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			RuntimeStatus string               `json:"runtimeStatus"`
			Failures      []batchFailureDetail `json:"failures"`
		} `json:"data"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Code != 0 || payload.Data.RuntimeStatus != "pending" || len(payload.Data.Failures) != 1 {
		t.Fatalf("expected an explicit pending result instead of silent success: %s", res.Body.String())
	}
	if payload.Data.Failures[0].ID != 20 || payload.Data.Failures[0].Reason == "" || !strings.Contains(payload.Msg, "配置已保存") {
		t.Fatalf("missing actionable failure detail: %s", res.Body.String())
	}
	var tunnel model.Tunnel
	err := h.repo.DB().First(&tunnel, 1).Error
	if err != nil || tunnel.Name != "saved-but-pending" {
		t.Fatalf("saved configuration was misreported: %+v %v", tunnel, err)
	}
}

func TestTunnelForwardLookupFailureIsReportedAsPending(t *testing.T) {
	h := identifiedFlowTestHandler(t)
	if err := h.repo.DB().Migrator().DropTable(&model.Forward{}); err != nil {
		t.Fatal(err)
	}
	err := h.syncUpdatedTunnelForwards(1)
	if err == nil || !strings.Contains(err.Error(), "关联转发暂时无法读取") {
		t.Fatalf("lookup failure was silently accepted: %v", err)
	}
	out := tunnelRuntimePendingResponse(1, err)
	if out.Code != 0 || !strings.Contains(out.Msg, "配置已保存") {
		t.Fatalf("lookup failure was not reported as pending: %+v", out)
	}
}
