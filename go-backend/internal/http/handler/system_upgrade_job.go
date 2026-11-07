package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
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

// cachedSystemUpgradeCapability avoids re-running Docker discovery on every
// settings page load. Starting an upgrade always discovers afresh.
func (h *Handler) cachedSystemUpgradeCapability(ctx context.Context) systemUpgradeCapabilityData {
	e := newSystemUpgradeExecutor()
	key := e.deployDir + "\x00" + e.backendContainer
	cache := &h.systemUpgradeCache
	cache.mu.Lock()
	if cache.capabilityKey == key && time.Since(cache.capabilityAt) < systemCapabilityCacheTTL {
		capability := cache.capability
		cache.mu.Unlock()
		return capability
	}
	cache.mu.Unlock()
	capability := e.capability(ctx)
	cache.mu.Lock()
	cache.capabilityKey, cache.capabilityAt, cache.capability = key, time.Now(), capability
	cache.mu.Unlock()
	return capability
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
	if panelupgrade.MaintenanceActive(e.deployDir) {
		message := "面板正在切换版本，请等待当前任务完成"
		if previous, _ := panelupgrade.Load(e.deployDir, ""); previous != nil && !previous.Active() {
			message = "上次升级未正常结束，请在升级进度中确认服务状态并解除维护"
		}
		response.WriteJSON(w, response.ErrDefault(message))
		return
	}
	channel := normalizeReleaseChannel(req.Channel)
	version := strings.TrimSpace(req.Version)
	if version == "" {
		version, err = h.resolveSystemUpgradeLatestReleaseByChannel(channel, time.Minute)
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
				// This API answering means the backend was restarted; lift the
				// maintenance flag in the background once both services are
				// confirmed healthy, instead of leaving every API at 503.
				h.recoverSystemUpgradeInBackground(e.deployDir)
			} else if readErr == nil {
				state = fresh
			}
		}
	}
	if state != nil {
		state.Maintenance = panelupgrade.MaintenanceActive(e.deployDir)
	}
	response.WriteJSON(w, response.OK(state))
}

const systemUpgradeRecoverTimeout = 45 * time.Second

func (h *Handler) recoverSystemUpgradeInBackground(deployDir string) {
	cache := &h.systemUpgradeCache
	cache.mu.Lock()
	if cache.recovering {
		cache.mu.Unlock()
		return
	}
	cache.recovering = true
	cache.mu.Unlock()
	go func() {
		defer func() {
			cache.mu.Lock()
			cache.recovering = false
			cache.mu.Unlock()
		}()
		if !h.systemUpgradeMu.TryLock() {
			return
		}
		defer h.systemUpgradeMu.Unlock()
		ctx, cancel := context.WithTimeout(context.Background(), systemUpgradeRecoverTimeout+15*time.Second)
		defer cancel()
		_, _ = panelupgrade.Recover(ctx, deployDir, panelupgrade.NewDocker(), systemUpgradeRecoverTimeout)
	}()
}

// systemUpgradeRecover lets an administrator lift a maintenance flag left by
// an interrupted upgrade or a failed rollback, after a health check passes.
func (h *Handler) systemUpgradeRecover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.WriteJSON(w, response.ErrDefault("请求失败"))
		return
	}
	if !h.systemUpgradeMu.TryLock() {
		response.WriteJSON(w, response.ErrDefault(systemUpgradeConflictError))
		return
	}
	defer h.systemUpgradeMu.Unlock()
	e := newSystemUpgradeExecutor()
	// Finish even if the browser gives up waiting.
	ctx, cancel := context.WithTimeout(context.Background(), systemUpgradeRecoverTimeout+15*time.Second)
	defer cancel()
	state, err := panelupgrade.Recover(ctx, e.deployDir, panelupgrade.NewDocker(), systemUpgradeRecoverTimeout)
	if err != nil {
		response.WriteJSON(w, response.ErrDefault("无法解除维护状态: "+err.Error()))
		return
	}
	if state != nil {
		state.Maintenance = panelupgrade.MaintenanceActive(e.deployDir)
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
			if panelupgrade.MaintenanceActive(newSystemUpgradeExecutor().deployDir) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusServiceUnavailable)
				_ = json.NewEncoder(w).Encode(response.Err(503, "面板正在升级，请等待服务恢复"))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
