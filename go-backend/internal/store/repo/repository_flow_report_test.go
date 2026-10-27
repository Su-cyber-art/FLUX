package repo

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"go-backend/internal/store/model"
)

func flowReportTestRepository(t *testing.T) *Repository {
	t.Helper()
	r, err := Open(filepath.Join(t.TempDir(), "flow-reports.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = r.Close() })
	seedFlowBatchRows(t, r, time.Now().UnixMilli())
	return r
}

func flowReportTestPlan(*Repository) (FlowReportAccounting, error) {
	return FlowReportAccounting{
		Deltas:     []FlowUploadCounterDelta{{ForwardID: 20, UserID: 2, UserTunnelID: 10, InFlow: 10, OutFlow: 20}},
		QuotaUsage: map[int64]int64{2: 30},
	}, nil
}

func TestFlowReportConcurrentRetriesAccountOnce(t *testing.T) {
	r := flowReportTestRepository(t)
	if err := r.DB().Create(&model.PeerShare{ID: 5, NodeID: 11}).Error; err != nil {
		t.Fatal(err)
	}
	var applied, duplicate atomic.Int32
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result, err := r.ApplyFlowReport(context.Background(), 11, "process-a", 1, strings.Repeat("a", 64), time.Now(), func(scoped *Repository) (FlowReportAccounting, error) {
				applied.Add(1)
				plan, err := flowReportTestPlan(scoped)
				plan.PeerShareUsage = map[int64]int64{5: 30}
				return plan, err
			})
			if err != nil {
				errs <- err
			} else if result.Duplicate {
				duplicate.Add(1)
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatal(err)
	}
	if applied.Load() != 1 || duplicate.Load() != 7 {
		t.Fatalf("applied=%d duplicate=%d", applied.Load(), duplicate.Load())
	}
	for query, want := range map[string]int64{
		`SELECT in_flow FROM forward WHERE id = 20`:                 10,
		`SELECT out_flow FROM "user" WHERE id = 2`:                  20,
		`SELECT daily_used_bytes FROM user_quota WHERE user_id = 2`: 30,
		`SELECT current_flow FROM peer_share WHERE id = 5`:          30,
		`SELECT COUNT(*) FROM flow_report_cursor`:                   1,
	} {
		if got := mustFlowBatchCount(t, r, query); got != want {
			t.Fatalf("%s: got %d want %d", query, got, want)
		}
	}
}

func TestFlowReportQuotaFailureRollsBackReceiptAndCounters(t *testing.T) {
	r := flowReportTestRepository(t)
	if err := r.DB().Exec(`CREATE TRIGGER reject_flow_quota BEFORE INSERT ON user_quota BEGIN SELECT RAISE(FAIL, 'quota unavailable'); END`).Error; err != nil {
		t.Fatal(err)
	}
	apply := func() (FlowReportResult, error) {
		return r.ApplyFlowReport(context.Background(), 11, "process-a", 1, strings.Repeat("a", 64), time.Now(), flowReportTestPlan)
	}
	if _, err := apply(); err == nil {
		t.Fatal("expected transaction failure")
	}
	if got := mustFlowBatchCount(t, r, `SELECT in_flow FROM forward WHERE id = 20`); got != 0 {
		t.Fatalf("counter survived rollback: %d", got)
	}
	if got := mustFlowBatchCount(t, r, `SELECT COUNT(*) FROM flow_report_cursor`); got != 0 {
		t.Fatalf("receipt survived rollback: %d", got)
	}
	if err := r.DB().Exec(`DROP TRIGGER reject_flow_quota`).Error; err != nil {
		t.Fatal(err)
	}
	if result, err := apply(); err != nil || result.Duplicate {
		t.Fatalf("same batch must be accepted after recovery: result=%+v err=%v", result, err)
	}
	if got := mustFlowBatchCount(t, r, `SELECT in_flow FROM forward WHERE id = 20`); got != 10 {
		t.Fatalf("recovered counter=%d", got)
	}
}

func TestFlowReportRejectsChangedPayloadAndMissingSequence(t *testing.T) {
	r := flowReportTestRepository(t)
	apply := func(sequence int64, hash string) (FlowReportResult, error) {
		return r.ApplyFlowReport(context.Background(), 11, "process-a", sequence, strings.Repeat(hash, 64), time.Now(), flowReportTestPlan)
	}
	// An already-running agent can first encounter receipt support mid-process.
	if _, err := apply(7, "a"); err != nil {
		t.Fatal(err)
	}
	if _, err := apply(7, "b"); !errors.Is(err, ErrFlowReportConflict) {
		t.Fatalf("expected identity conflict, got %v", err)
	}
	if _, err := apply(9, "c"); !errors.Is(err, ErrFlowReportSequence) {
		t.Fatalf("expected gap rejection, got %v", err)
	}
	if _, err := apply(8, "b"); err != nil {
		t.Fatal(err)
	}
	if result, err := apply(7, "a"); err != nil || !result.Duplicate {
		t.Fatalf("delayed old batch must not be applied: %+v %v", result, err)
	}
	if got := mustFlowBatchCount(t, r, `SELECT in_flow FROM forward WHERE id = 20`); got != 20 {
		t.Fatalf("unexpected counter after replay: %d", got)
	}
}

func TestFlowReportProducerIdentityIsScopedToNode(t *testing.T) {
	r := flowReportTestRepository(t)
	for _, nodeID := range []int64{11, 12} {
		result, err := r.ApplyFlowReport(context.Background(), nodeID, "process-a", 1, strings.Repeat("a", 64), time.Now(), flowReportTestPlan)
		if err != nil || result.Duplicate {
			t.Fatalf("node %d: %+v %v", nodeID, result, err)
		}
	}
	if got := mustFlowBatchCount(t, r, `SELECT in_flow FROM forward WHERE id = 20`); got != 20 {
		t.Fatalf("independent nodes must both account: %d", got)
	}
}
