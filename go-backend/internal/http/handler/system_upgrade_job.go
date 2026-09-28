package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go-backend/internal/http/response"
	"go-backend/internal/panelupgrade"
)

func (e *systemUpgradeExecutor) capability(ctx context.Context) systemUpgradeCapabilityData {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	_, err := panelupgrade.NewDocker().Discover(ctx, e.deployDir, e.backendContainer)
	reasons := []string{}
	if err != nil {
		reasons = append(reasons, err.Error())
	}
	return systemUpgradeCapabilityData{Capable: err == nil, Reasons: reasons, DeployDir: e.deployDir, BackendContainer: e.backendContainer}
}

func (h *Handler) systemUpgrade(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.WriteJSON(w, response.ErrDefault("请求失败"))
		return
	}
	if !h.systemUpgradeMu.TryLock() {
		response.WriteJSON(w, response.ErrDefault(systemUpgradeConflictError))
		return
	}
	defer h.systemUpgradeMu.Unlock()
	var req systemUpgradeRequest
	if err := decodeSystemUpgradeRequest(r, &req); err != nil {
		response.WriteJSON(w, response.ErrDefault("请求参数错误"))
		return
	}
	e := newSystemUpgradeExecutor()
	docker := panelupgrade.NewDocker()
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	deployment, err := docker.Discover(ctx, e.deployDir, e.backendContainer)
	if err != nil {
		response.WriteJSON(w, response.ErrDefault("当前环境不支持面板自升级: "+err.Error()))
		return
	}
	if _, err := os.Stat(filepath.Join(e.deployDir, panelupgrade.Directory, "maintenance")); err == nil {
		message := "面板正在切换版本，请等待当前任务完成"
		if previous, _ := panelupgrade.Load(e.deployDir, ""); previous != nil && !previous.Active() {
			message = "上次升级未正常恢复，请先根据保留的备份恢复服务并解除维护状态"
		}
		response.WriteJSON(w, response.ErrDefault(message))
		return
	}
	channel := normalizeReleaseChannel(req.Channel)
	version := strings.TrimSpace(req.Version)
	if version == "" {
		version, err = h.resolveSystemUpgradeLatestReleaseByChannel(channel)
		if err != nil {
			response.WriteJSON(w, response.ErrDefault(err.Error()))
			return
		}
	}
	if err := panelupgrade.ValidateTarget(version); err != nil {
		response.WriteJSON(w, response.ErrDefault(err.Error()))
		return
	}
	if version == currentPanelVersion() {
		response.WriteJSON(w, response.ErrDefault("当前已经是所选版本"))
		return
	}
	plan := panelupgrade.Plan{Version: version, FromVersion: currentPanelVersion(), Deployment: deployment, DownloadBase: strings.TrimSuffix(h.buildSystemUpgradeDownloadURL(version, ""), "/")}
	state, err := panelupgrade.Create(e.deployDir, plan)
	if err != nil {
		if errors.Is(err, panelupgrade.ErrBusy) {
			response.WriteJSON(w, response.ErrDefault(systemUpgradeConflictError))
		} else {
			response.WriteJSON(w, response.ErrDefault("创建升级任务失败: "+err.Error()))
		}
		return
	}
	plan.ID = state.ID
	// Creating the helper must finish even if the initiating tab disconnects.
	startCtx, stop := context.WithTimeout(context.Background(), 30*time.Second)
	helper, err := docker.Start(startCtx, plan)
	stop()
	if err != nil {
		state.Error = err.Error()
		_ = panelupgrade.Finish(e.deployDir, state, "failed", "升级任务启动失败，当前版本未变更")
		response.WriteJSON(w, response.ErrDefault(state.Message))
		return
	}
	response.WriteJSON(w, response.OK(systemUpgradeRunData{Version: version, Channel: channel, ComposeAsset: "docker-compose.yml", HelperContainer: helper, BackendImageID: deployment.BackendImage, Message: systemUpgradeMessage, Job: state}))
}

func (h *Handler) systemUpgradeStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodPost {
		response.WriteJSON(w, response.ErrDefault("请求失败"))
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r.Body, &req); err != nil {
		response.WriteJSON(w, response.ErrDefault("请求参数错误"))
		return
	}
	e := newSystemUpgradeExecutor()
	state, err := panelupgrade.Load(e.deployDir, req.ID)
	if err != nil {
		response.WriteJSON(w, response.ErrDefault("读取升级进度失败: "+err.Error()))
		return
	}
	if state.Active() && time.Since(time.UnixMilli(state.UpdatedAt)) > 60*time.Second {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		alive, checkErr := panelupgrade.NewDocker().HelperRunning(ctx, state.ID)
		cancel()
		if checkErr == nil && !alive {
			fresh, readErr := panelupgrade.Load(e.deployDir, state.ID)
			if readErr == nil && fresh.Active() {
				fresh.Error = "升级进程已意外退出；请检查部署状态，已有备份会保留"
				_ = panelupgrade.Finish(e.deployDir, fresh, "failed", fresh.Error)
				state = fresh
			} else if readErr == nil {
				state = fresh
			}
		}
	}
	response.WriteJSON(w, response.OK(state))
}

// The frontend stays available while the worker backs up and swaps containers.
// Reject writes and agent reconnects until validation/rollback has finished.
func (h *Handler) UpgradeMaintenance(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		allowed := path == "/flow/test" || path == "/api/v1/user/login" || strings.HasPrefix(path, "/api/v1/system/") || strings.HasPrefix(path, "/api/v1/public/") || strings.HasPrefix(path, "/api/v1/captcha/")
		if !allowed {
			if _, err := os.Stat(filepath.Join(newSystemUpgradeExecutor().deployDir, panelupgrade.Directory, "maintenance")); err == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusServiceUnavailable)
				_ = json.NewEncoder(w).Encode(response.Err(503, "面板正在升级，请等待服务恢复"))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
