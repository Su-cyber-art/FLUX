package handler

import (
	"errors"
	"fmt"
	"log"
	"strings"
)

// tunnelForwardSyncPendingError reports forwards whose runtime could not be
// refreshed after a tunnel update. The tunnel configuration is already saved,
// so callers surface it through tunnelRuntimePendingResponse, which keeps the
// per-forward failures for the operator.
type tunnelForwardSyncPendingError struct {
	result batchOperationResult
	cause  error
}

func (e *tunnelForwardSyncPendingError) Error() string { return e.cause.Error() }
func (e *tunnelForwardSyncPendingError) Unwrap() error { return e.cause }

func tunnelForwardSyncFailures(err error) []batchFailureDetail {
	var failures []batchFailureDetail
	for _, leaf := range flattenJoinedErrors(err) {
		var pending *tunnelForwardSyncPendingError
		if errors.As(leaf, &pending) {
			failures = append(failures, pending.result.Failures...)
		}
	}
	return failures
}

func flattenJoinedErrors(err error) []error {
	if err == nil {
		return nil
	}
	if joined, ok := err.(interface{ Unwrap() []error }); ok {
		var out []error
		for _, child := range joined.Unwrap() {
			out = append(out, flattenJoinedErrors(child)...)
		}
		return out
	}
	return []error{err}
}

// syncUpdatedTunnelForwards pushes every forward of the tunnel after its entry
// topology changed. It returns nil when all forwards were applied, otherwise a
// pending error that lists the forwards still awaiting synchronization.
func (h *Handler) syncUpdatedTunnelForwards(tunnelID int64) error {
	forwards, err := h.listForwardsByTunnel(tunnelID)
	if err != nil {
		log.Printf("tunnel forward lookup failed tunnel_id=%d err=%v", tunnelID, err)
		return &tunnelForwardSyncPendingError{cause: fmt.Errorf("关联转发暂时无法读取: %w", err)}
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
	if result.FailCount == 0 {
		return nil
	}
	log.Printf("tunnel forward synchronization pending tunnel_id=%d failures=%d", tunnelID, result.FailCount)
	return &tunnelForwardSyncPendingError{
		result: result,
		cause:  fmt.Errorf("%d 条转发尚未同步，请在节点恢复后重新下发配置", result.FailCount),
	}
}
