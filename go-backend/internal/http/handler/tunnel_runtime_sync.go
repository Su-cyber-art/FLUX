package handler

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"go-backend/internal/http/response"
)

type tunnelRuntimeSyncResult struct {
	Status string `json:"status"`
	batchOperationResult
}

func writeTunnelRuntimePending(w http.ResponseWriter, tunnelID int64, reason string, result batchOperationResult) {
	log.Printf("tunnel runtime synchronization pending tunnel_id=%d reason=%s failures=%d", tunnelID, reason, result.FailCount)
	payload := response.OK(struct {
		RuntimeSync tunnelRuntimeSyncResult `json:"runtimeSync"`
	}{RuntimeSync: tunnelRuntimeSyncResult{Status: "pending", batchOperationResult: result}})
	payload.Msg = "配置已保存，" + reason + "；请在节点恢复后重新下发配置"
	response.WriteJSON(w, payload)
}

func (h *Handler) syncUpdatedTunnelForwards(w http.ResponseWriter, tunnelID int64) bool {
	forwards, err := h.listForwardsByTunnel(tunnelID)
	if err != nil {
		log.Printf("tunnel forward lookup failed tunnel_id=%d err=%v", tunnelID, err)
		writeTunnelRuntimePending(w, tunnelID, "关联转发暂时无法读取", batchOperationResult{})
		return false
	}
	var result batchOperationResult
	for i := range forwards {
		pending := false
		warnings, err := h.syncForwardServicesWithPending(&forwards[i], "UpdateService", true, &pending)
		if err == nil && pending {
			err = errors.New(strings.Join(warnings, "；"))
		}
		if err != nil {
			result.FailCount++
			result.Failures = appendBatchFailure(result.Failures, forwards[i].ID, forwards[i].Name, err)
		} else {
			result.SuccessCount++
		}
	}
	if result.FailCount > 0 {
		writeTunnelRuntimePending(w, tunnelID, fmt.Sprintf("%d 条转发尚未同步", result.FailCount), result)
		return false
	}
	return true
}
