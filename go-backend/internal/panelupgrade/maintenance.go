package panelupgrade

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"
)

// MaintenancePath is the flag file that makes the API reject writes while
// containers are being replaced.
func MaintenancePath(deployDir string) string {
	return filepath.Join(deployDir, Directory, "maintenance")
}

func MaintenanceActive(deployDir string) bool {
	_, err := os.Stat(MaintenancePath(deployDir))
	return err == nil
}

func LoadPlan(deployDir, id string) (*Plan, error) {
	dir, err := JobDir(deployDir, id)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(dir, "plan.json"))
	if err != nil {
		return nil, err
	}
	var plan Plan
	if err := json.Unmarshal(data, &plan); err != nil {
		return nil, err
	}
	return &plan, nil
}

var ErrNotRecoverable = errors.New("升级任务仍在执行，无法解除维护状态")

// Recover lifts a maintenance flag left behind by a worker that stopped
// without finishing (killed, host restart) or whose rollback failed. It only
// does so after the deployment's own health check passes, so the API is never
// reopened on top of a half-replaced deployment.
func Recover(ctx context.Context, deployDir string, docker *Docker, timeout time.Duration) (*State, error) {
	state, err := Load(deployDir, "")
	if err != nil {
		return nil, err
	}
	if !MaintenanceActive(deployDir) {
		return state, nil
	}
	if state == nil {
		return nil, errors.New("未找到升级任务记录，请手动检查部署后删除维护标记")
	}
	if state.Active() {
		return state, ErrNotRecoverable
	}
	if running, err := docker.HelperRunning(ctx, state.ID); err != nil || running {
		return state, ErrNotRecoverable
	}
	plan, err := LoadPlan(deployDir, state.ID)
	if err != nil {
		return state, err
	}
	if err := docker.WaitHealthy(ctx, plan.Deployment, timeout); err != nil {
		return state, err
	}
	if err := os.Remove(MaintenancePath(deployDir)); err != nil && !os.IsNotExist(err) {
		return state, err
	}
	state.Events = append(state.Events, Event{Time: time.Now().UnixMilli(), Message: "已确认前后端服务可用，解除维护状态"})
	return state, Save(deployDir, state)
}
