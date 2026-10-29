package handler

import (
	"log"
	"net/http"

	"go-backend/internal/http/response"
)

// Forced removal revokes the enrollment and deletes local data only. It must
// never claim that a permanently unavailable server has been cleaned up.
func (h *Handler) nodeForceDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.WriteJSON(w, response.ErrDefault("请求失败"))
		return
	}
	id := idFromBody(r, w)
	if id <= 0 {
		return
	}
	if err := h.removeNodeByID(id, true); err != nil {
		response.WriteJSON(w, response.Err(-2, err.Error()))
		return
	}
	log.Printf("node removed from panel without remote cleanup node_id=%d", id)
	payload := response.OK(map[string]bool{"removed": true, "remoteCleanupConfirmed": false})
	payload.Msg = "节点已从面板移除，原接入凭证已失效；远端程序未清理"
	response.WriteJSON(w, payload)
}

func (h *Handler) nodeBatchForceDelete(w http.ResponseWriter, r *http.Request) {
	h.nodeBatchRemove(w, r, true)
}
