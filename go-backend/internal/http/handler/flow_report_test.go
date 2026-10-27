package handler

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"go-backend/internal/store/model"
	"go-backend/internal/store/repo"
)

func identifiedFlowTestHandler(t *testing.T) *Handler {
	t.Helper()
	r, err := repo.Open(filepath.Join(t.TempDir(), "identified-flow.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = r.Close() })
	now := time.Now().UnixMilli()
	for _, row := range []interface{}{
		&model.User{ID: 2, User: "flow-user", Pwd: "pwd", RoleID: 1, ExpTime: 2727251700000, Flow: 99999, Num: 99999, CreatedTime: now, Status: 1},
		&model.Node{ID: 11, Name: "flow-node", Secret: "flow-secret", Status: 1},
		&model.Tunnel{ID: 1, Name: "flow-tunnel", Type: 1, Protocol: "tls", TrafficRatio: 1, Flow: 1, CreatedTime: now, UpdatedTime: now, Status: 1},
		&model.UserTunnel{ID: 10, UserID: 2, TunnelID: 1, Num: 99999, Flow: 99999, ExpTime: 2727251700000, Status: 1},
		&model.Forward{ID: 20, UserID: 2, UserName: "flow-user", Name: "flow-forward", TunnelID: 1, RemoteAddr: "127.0.0.1:8080", CreatedTime: now, UpdatedTime: now, Status: 1},
		&model.ForwardPort{ForwardID: 20, NodeID: 11, Port: 31001},
	} {
		if err := r.DB().Create(row).Error; err != nil {
			t.Fatalf("seed %T: %v", row, err)
		}
	}
	return &Handler{repo: r}
}

func sendIdentifiedFlow(t *testing.T, h *Handler, sequence int, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/flow/upload?secret=flow-secret", strings.NewReader(body))
	req.Header.Set(flowProducerHeader, "process-a")
	req.Header.Set(flowSequenceHeader, strconv.Itoa(sequence))
	res := httptest.NewRecorder()
	h.flowUpload(res, req)
	return res
}

func TestIdentifiedFlowUploadAcknowledgesOnlyCommittedBatchAndDeduplicatesRetries(t *testing.T) {
	h := identifiedFlowTestHandler(t)
	body := `[{"n":"20_2_10","u":10,"d":20}]`
	for range 2 {
		res := sendIdentifiedFlow(t, h, 1, body)
		if res.Code != http.StatusOK || res.Body.String() != "ok" || res.Header().Get(flowAckHeader) != "process-a:1" {
			t.Fatalf("unexpected acknowledgement: status=%d body=%s headers=%v", res.Code, res.Body.String(), res.Header())
		}
	}
	var forward model.Forward
	if err := h.repo.DB().First(&forward, 20).Error; err != nil {
		t.Fatal(err)
	}
	var quota model.UserQuota
	if err := h.repo.DB().Where("user_id = ?", 2).First(&quota).Error; err != nil {
		t.Fatal(err)
	}
	if forward.InFlow != 20 || forward.OutFlow != 10 || quota.DailyUsedBytes != 30 {
		t.Fatalf("retry changed committed counters: forward=%+v quota=%+v", forward, quota)
	}
	res := sendIdentifiedFlow(t, h, 1, `[{"n":"20_2_10","u":99,"d":20}]`)
	if res.Code != http.StatusConflict || res.Header().Get(flowAckHeader) != "" {
		t.Fatalf("changed payload reused a receipt: %d %s", res.Code, res.Body.String())
	}
}

func TestIdentifiedFlowUploadRollsBackOnDatabaseFailureAndRecoversWithSameIdentity(t *testing.T) {
	h := identifiedFlowTestHandler(t)
	if err := h.repo.DB().Exec(`CREATE TRIGGER reject_report_quota BEFORE INSERT ON user_quota BEGIN SELECT RAISE(FAIL, 'database unavailable'); END`).Error; err != nil {
		t.Fatal(err)
	}
	body := `[{"n":"20_2_10","u":10,"d":20}]`
	res := sendIdentifiedFlow(t, h, 1, body)
	if res.Code != http.StatusServiceUnavailable || res.Header().Get(flowAckHeader) != "" {
		t.Fatalf("failed transaction was acknowledged: %d %s", res.Code, res.Body.String())
	}
	var forward model.Forward
	if err := h.repo.DB().First(&forward, 20).Error; err != nil {
		t.Fatal(err)
	}
	var receipts int64
	if err := h.repo.DB().Model(&model.FlowReportCursor{}).Count(&receipts).Error; err != nil {
		t.Fatal(err)
	}
	if forward.InFlow != 0 || receipts != 0 {
		t.Fatalf("partial accounting survived: in_flow=%d receipts=%d", forward.InFlow, receipts)
	}
	if err := h.repo.DB().Exec(`DROP TRIGGER reject_report_quota`).Error; err != nil {
		t.Fatal(err)
	}
	res = sendIdentifiedFlow(t, h, 1, body)
	if res.Code != http.StatusOK || res.Header().Get(flowAckHeader) != "process-a:1" {
		t.Fatalf("recovery failed: %d %s", res.Code, res.Body.String())
	}
}

func TestIdentifiedFlowUploadDoesNotAcknowledgeOwnershipLookupFailure(t *testing.T) {
	h := identifiedFlowTestHandler(t)
	if err := h.repo.DB().Migrator().DropTable(&model.ForwardPort{}); err != nil {
		t.Fatal(err)
	}
	res := sendIdentifiedFlow(t, h, 1, `[{"n":"20_2_10","u":10,"d":20}]`)
	if res.Code != http.StatusServiceUnavailable || res.Header().Get(flowAckHeader) != "" {
		t.Fatalf("ownership failure was acknowledged: %d %s", res.Code, res.Body.String())
	}
}

func TestIdentifiedFlowUploadRejectsMalformedAndNegativeCounters(t *testing.T) {
	h := identifiedFlowTestHandler(t)
	for _, body := range []string{"not-json", `[{"n":"20_2_10","u":-1,"d":20}]`, `[{"n":"20_2_10","u":9223372036854775807,"d":20}]`} {
		res := sendIdentifiedFlow(t, h, 1, body)
		if res.Code != http.StatusBadRequest || res.Header().Get(flowAckHeader) != "" {
			t.Fatalf("invalid report accepted: %d %s", res.Code, res.Body.String())
		}
	}
}

func TestLegacyFlowUploadRemainsCompatible(t *testing.T) {
	h := identifiedFlowTestHandler(t)
	res := httptest.NewRecorder()
	h.flowUpload(res, httptest.NewRequest(http.MethodPost, "/flow/upload?secret=flow-secret", strings.NewReader(`[{"n":"20_2_10","u":10,"d":20}]`)))
	if res.Code != http.StatusOK || res.Body.String() != "ok" {
		t.Fatalf("legacy report rejected: %d %s", res.Code, res.Body.String())
	}
}

func TestIdentifiedFlowUploadDeduplicatesSharedUsageWithoutChargingLocalIDs(t *testing.T) {
	h := identifiedFlowTestHandler(t)
	if err := h.repo.DB().Create(&model.PeerShare{ID: 5, NodeID: 11}).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now().UnixMilli()
	if err := h.repo.DB().Exec(`INSERT INTO peer_share_runtime(share_id, node_id, reservation_id, resource_key, binding_id, role, chain_name, service_name, protocol, strategy, port, target, applied, status, created_time, updated_time)
		VALUES(5, 11, 'report-runtime', 'report-resource', '', 'forward', '', '20_999_0', 'tcp', 'fifo', 31002, '', 1, 1, ?, ?)`, now, now).Error; err != nil {
		t.Fatal(err)
	}
	for range 2 {
		res := sendIdentifiedFlow(t, h, 1, `[{"n":"20_999_0_tcp","u":10,"d":20}]`)
		if res.Code != http.StatusOK || res.Header().Get(flowAckHeader) != "process-a:1" {
			t.Fatalf("shared batch failed: %d %s", res.Code, res.Body.String())
		}
	}
	var share model.PeerShare
	if err := h.repo.DB().First(&share, 5).Error; err != nil {
		t.Fatal(err)
	}
	var forward model.Forward
	if err := h.repo.DB().First(&forward, 20).Error; err != nil {
		t.Fatal(err)
	}
	if share.CurrentFlow != 30 || forward.InFlow != 0 || forward.OutFlow != 0 {
		t.Fatalf("shared ownership or duplicate handling changed: shared=%d local_in=%d local_out=%d", share.CurrentFlow, forward.InFlow, forward.OutFlow)
	}
}
