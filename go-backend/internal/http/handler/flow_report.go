package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"go-backend/internal/http/response"
	"go-backend/internal/store/repo"
)

const flowProducerHeader = "X-Flux-Flow-Producer"
const flowSequenceHeader = "X-Flux-Flow-Sequence"
const flowAckHeader = "X-Flux-Flow-Ack"

var flowProducerPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)

// The identified protocol keeps the legacy encrypted array body. Old panels
// ignore these headers; new panels atomically receipt and account each batch.
func (h *Handler) flowUploadIdentified(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	producer := r.Header.Get(flowProducerHeader)
	sequence, err := strconv.ParseInt(r.Header.Get(flowSequenceHeader), 10, 64)
	if r.Method != http.MethodPost || !flowProducerPattern.MatchString(producer) || err != nil || sequence <= 0 {
		response.WriteJSONStatus(w, http.StatusBadRequest, response.Err(400, "无效的流量批次标识"))
		return
	}
	secret := r.URL.Query().Get("secret")
	if secret == "" {
		response.WriteJSONStatus(w, http.StatusUnauthorized, response.Err(401, "无效的节点凭证"))
		return
	}
	node, err := h.repo.GetNodeBySecret(secret)
	if err != nil {
		response.WriteJSONStatus(w, http.StatusServiceUnavailable, response.Err(503, "流量接收暂时不可用"))
		return
	}
	if node == nil {
		response.WriteJSONStatus(w, http.StatusUnauthorized, response.Err(401, "无效的节点凭证"))
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4*1024*1024)
	raw, err := readAndDecryptFlowBody(r.Body, secret)
	var items []flowItem
	if err != nil || json.Unmarshal([]byte(raw), &items) != nil || len(items) > 500 {
		response.WriteJSONStatus(w, http.StatusBadRequest, response.Err(400, "无效的流量批次内容"))
		return
	}
	var total int64
	for _, item := range items {
		if item.U < 0 || item.D < 0 || item.U > math.MaxInt64-item.D || total > math.MaxInt64-item.U-item.D || len(item.N) > 1024 {
			response.WriteJSONStatus(w, http.StatusBadRequest, response.Err(400, "无效的流量计数"))
			return
		}
		total += item.U + item.D
	}
	hash := sha256.Sum256([]byte(raw))
	now := time.Now()
	var batch flowUploadBatch
	var flowMetas map[int64]repo.FlowUploadForwardMeta
	result, err := h.repo.ApplyFlowReport(r.Context(), node.ID, producer, sequence, hex.EncodeToString(hash[:]), now, func(scoped *repo.Repository) (repo.FlowReportAccounting, error) {
		planner := &Handler{repo: scoped}
		metas, err := scoped.GetFlowUploadForwardMetas(collectFlowUploadForwardIDs(items))
		if err != nil {
			return repo.FlowReportAccounting{}, err
		}
		flowMetas = metas
		// Reject scaled counter overflow before aggregating integer counters.
		var scaledTotal float64
		for _, item := range items {
			forwardID, _, _, ok := parseFlowServiceIDs(item.N)
			if meta, exists := metas[forwardID]; ok && exists {
				scaledTotal += float64(item.U+item.D) * meta.TrafficRatio * float64(meta.TunnelFlow)
			}
		}
		if math.IsNaN(scaledTotal) || math.IsInf(scaledTotal, 0) || scaledTotal >= float64(math.MaxInt64) {
			return repo.FlowReportAccounting{}, fmt.Errorf("scaled flow counters overflow")
		}
		batch, err = planner.buildNodeFlowUploadBatchChecked(node.ID, items, metas)
		if err != nil {
			return repo.FlowReportAccounting{}, err
		}
		if err := planner.resolveFlowReportPeerUsage(node.ID, &batch, metas); err != nil {
			return repo.FlowReportAccounting{}, err
		}
		return repo.FlowReportAccounting{Deltas: batch.flowDeltas, QuotaUsage: batch.quotaUsage, PeerShareUsage: batch.peerShareUsage}, nil
	})
	if err != nil {
		if errors.Is(err, repo.ErrFlowReportConflict) || errors.Is(err, repo.ErrFlowReportSequence) {
			response.WriteJSONStatus(w, http.StatusConflict, response.Err(409, err.Error()))
			return
		}
		log.Printf("flow report transaction failed node_id=%d producer=%s sequence=%d err=%v", node.ID, producer, sequence, err)
		w.Header().Set("Retry-After", "5")
		response.WriteJSONStatus(w, http.StatusServiceUnavailable, response.Err(503, "流量批次未确认，请使用原标识重试"))
		return
	}
	if !result.Duplicate {
		for userID, quota := range result.QuotaViews {
			h.enforceUserQuotaIfNeeded(userID, quota)
		}
		for _, target := range batch.policyTargets {
			if target.UserID > 0 && target.UserTunnelID > 0 {
				h.enforceFlowPolicies(target.UserID, target.UserTunnelID)
			}
		}
		for shareID := range batch.peerShareUsage {
			share, lookupErr := h.repo.GetPeerShare(shareID)
			if lookupErr == nil && isPeerShareFlowExceeded(share) {
				h.enforcePeerShareFlowLimit(shareID)
			}
		}
		if len(batch.orphanServices) > 0 {
			names := make([]string, 0, len(batch.orphanServices))
			for name := range batch.orphanServices {
				names = append(names, name)
			}
			h.sendDeleteOrphanedForwardServices(node.ID, names)
		}
		// Accounting is already committed. Diagnostic metrics must not turn an
		// accepted batch into a retry or participate in its billing transaction.
		h.recordTunnelMetricsFromForwardBatch(node.ID, batch.forwardTraffic, flowMetas, now.UnixMilli())
	}
	w.Header().Set(flowAckHeader, producer+":"+strconv.FormatInt(sequence, 10))
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ok"))
}

func (h *Handler) resolveFlowReportPeerUsage(nodeID int64, batch *flowUploadBatch, metas map[int64]repo.FlowUploadForwardMeta) error {
	if batch.peerShareUsage == nil {
		batch.peerShareUsage = make(map[int64]int64)
	}
	for runtimeID, item := range batch.peerShareRuntimeItems {
		runtime, err := h.repo.GetPeerShareRuntimeByID(runtimeID)
		if err != nil {
			return err
		}
		if runtime != nil && runtime.NodeID == nodeID && runtime.Status == 1 {
			batch.peerShareUsage[runtime.ShareID] += item.U + item.D
		}
	}
	for serviceName, item := range batch.peerShareForwardItems {
		forwardID, userID, _, ok := parseFlowServiceIDs(serviceName)
		if !ok {
			continue
		}
		meta, exists := metas[forwardID]
		if !exists || meta.UserID != userID {
			continue
		}
		if shareID, ok := parsePeerShareIDFromFederationTunnelName(meta.TunnelName); ok {
			batch.peerShareUsage[shareID] += item.U + item.D
		}
	}
	return nil
}
