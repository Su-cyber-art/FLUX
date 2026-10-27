package repo

import (
	"context"
	"errors"
	"sort"
	"time"

	"go-backend/internal/store/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrFlowReportConflict = errors.New("流量批次标识已用于其他内容")
var ErrFlowReportSequence = errors.New("流量批次不连续，请重试尚未确认的批次")

type FlowReportAccounting struct {
	Deltas         []FlowUploadCounterDelta
	QuotaUsage     map[int64]int64
	PeerShareUsage map[int64]int64
}

type FlowReportResult struct {
	Duplicate  bool
	QuotaViews map[int64]*model.UserQuotaView
}

// ApplyFlowReport commits the receipt and all billing counters together. The
// planner reads ownership through the transaction-bound repository; external
// effects such as node commands must run only after this method succeeds.
func (r *Repository) ApplyFlowReport(ctx context.Context, nodeID int64, producerID string, sequence int64, payloadHash string, now time.Time, plan func(*Repository) (FlowReportAccounting, error)) (FlowReportResult, error) {
	var result FlowReportResult
	if r == nil || r.db == nil || nodeID <= 0 || producerID == "" || len(producerID) > 64 || sequence <= 0 || len(payloadHash) != 64 || plan == nil {
		return result, errors.New("invalid flow report")
	}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// A process may have already reported to an older panel without receipts.
		// Its first identified batch may therefore start above sequence one.
		cursor := model.FlowReportCursor{NodeID: nodeID, ProducerID: producerID, Sequence: sequence - 1}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&cursor).Error; err != nil {
			return err
		}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("node_id = ? AND producer_id = ?", nodeID, producerID).First(&cursor).Error; err != nil {
			return err
		}
		if sequence <= cursor.Sequence {
			if sequence == cursor.Sequence && payloadHash != cursor.PayloadHash {
				return ErrFlowReportConflict
			}
			result.Duplicate = true
			return nil
		}
		if sequence != cursor.Sequence+1 {
			return ErrFlowReportSequence
		}
		scoped := &Repository{db: tx, dbPath: r.dbPath}
		accounting, err := plan(scoped)
		if err != nil {
			return err
		}
		if err := applyFlowUploadDeltasTx(tx, accounting.Deltas); err != nil {
			return err
		}
		result.QuotaViews, err = scoped.addUserQuotaUsageBatchTx(tx, accounting.QuotaUsage, now)
		if err != nil {
			return err
		}
		shareIDs := make([]int64, 0, len(accounting.PeerShareUsage))
		for shareID := range accounting.PeerShareUsage {
			shareIDs = append(shareIDs, shareID)
		}
		sort.Slice(shareIDs, func(i, j int) bool { return shareIDs[i] < shareIDs[j] })
		for _, shareID := range shareIDs {
			delta := accounting.PeerShareUsage[shareID]
			if shareID <= 0 || delta <= 0 {
				continue
			}
			if err := tx.Model(&model.PeerShare{}).Where("id = ? AND node_id = ?", shareID, nodeID).
				UpdateColumn("current_flow", gorm.Expr("current_flow + ?", delta)).Error; err != nil {
				return err
			}
		}
		return tx.Model(&model.FlowReportCursor{}).Where("node_id = ? AND producer_id = ?", nodeID, producerID).
			Updates(map[string]interface{}{"sequence": sequence, "payload_hash": payloadHash, "updated_time": now.UnixMilli()}).Error
	})
	if err != nil {
		return FlowReportResult{}, err
	}
	return result, nil
}
