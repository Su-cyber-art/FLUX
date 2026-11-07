package panelupgrade

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func finishedJob(t *testing.T, root string, started int64, status string) string {
	t.Helper()
	state, err := Create(root, Plan{Version: "3.2.1", FromVersion: "3.2.0"})
	if err != nil {
		t.Fatal(err)
	}
	state.StartedAt = started
	if status == "running" {
		// Leave the job active but release the lock so another can be created.
		if err := Save(root, state); err != nil {
			t.Fatal(err)
		}
		if err := os.RemoveAll(filepath.Join(root, Directory, "lock")); err != nil {
			t.Fatal(err)
		}
		return state.ID
	}
	if err := Finish(root, state, status, status); err != nil {
		t.Fatal(err)
	}
	return state.ID
}

func TestPruneJobsKeepsNewestCurrentAndActive(t *testing.T) {
	root := t.TempDir()
	oldest := finishedJob(t, root, 1, "succeeded")
	active := finishedJob(t, root, 2, "running")
	older := finishedJob(t, root, 3, "rolled_back")
	newer := finishedJob(t, root, 4, "succeeded")
	current := finishedJob(t, root, 5, "succeeded")

	removed, err := PruneJobs(root, current, 3)
	if err != nil {
		t.Fatal(err)
	}
	// current plus the two newest finished jobs are kept; a running job is
	// never removed and does not take one of the kept slots.
	if removed != 1 {
		t.Fatalf("removed %d jobs, want 1", removed)
	}
	for id, want := range map[string]bool{oldest: false, older: true, active: true, newer: true, current: true} {
		_, err := os.Stat(filepath.Join(root, Directory, id))
		if exists := err == nil; exists != want {
			t.Fatalf("job %s exists=%v, want %v", id, exists, want)
		}
	}
}

func TestPruneImagesKeepsTargetPreviousAndRunningImages(t *testing.T) {
	var removed []string
	docker := &Docker{Run: func(ctx context.Context, in io.Reader, out io.Writer, args ...string) error {
		switch strings.Join(args[:2], " ") {
		case "image ls":
			io.WriteString(out, "sha256:new 3.2.1\nsha256:prev 3.2.0\nsha256:old 3.1.0\nsha256:dev latest\nsha256:old2 3.0.0\n")
		case "image rm":
			if strings.HasSuffix(args[2], ":3.0.0") {
				return errors.New("image is being used by a stopped container")
			}
			removed = append(removed, args[2])
		default:
			t.Fatalf("unexpected Docker operation: %v", args)
		}
		return nil
	}}
	count := docker.PruneImages(context.Background(), []string{"3.2.1", "dev"}, []string{"sha256:prev"})
	if count != 2 || len(removed) != 2 {
		t.Fatalf("removed %v (count %d)", removed, count)
	}
	for _, ref := range removed {
		if !strings.HasSuffix(ref, ":3.1.0") {
			t.Fatalf("removed protected image %s", ref)
		}
	}
}

func TestUpgradeCleansUpAfterSuccess(t *testing.T) {
	w, _ := fixture(t, false, false, false)
	stale := filepath.Join(w.Plan.Deployment.HostDir, Directory, strings.Repeat("0", 32))
	for i := 0; i < KeepJobs+1; i++ {
		dir := stale[:len(stale)-1] + string(rune('a'+i))
		if err := os.MkdirAll(filepath.Join(dir, "backup"), 0700); err != nil {
			t.Fatal(err)
		}
		old := time.Unix(int64(1000+i), 0)
		os.Chtimes(dir, old, old)
	}
	if err := w.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(filepath.Join(w.Plan.Deployment.HostDir, Directory))
	jobs := 0
	for _, entry := range entries {
		if entry.IsDir() && validID.MatchString(entry.Name()) {
			jobs++
		}
	}
	if jobs != KeepJobs {
		t.Fatalf("kept %d job directories, want %d", jobs, KeepJobs)
	}
	state, _ := Load(w.Plan.Deployment.HostDir, "")
	if state.Status != "succeeded" || !strings.Contains(state.Events[len(state.Events)-2].Message, "已清理") {
		t.Fatalf("cleanup not recorded: %+v", state.Events)
	}
}

func TestLowDiskSpaceStopsBeforeDownloadAndKeepsServiceOnline(t *testing.T) {
	w, stopped := fixture(t, false, false, false)
	w.FreeSpace = func(string) (uint64, error) { return 1 << 20, nil }
	if err := w.Run(context.Background()); err == nil || !strings.Contains(err.Error(), "磁盘空间不足") {
		t.Fatalf("expected disk space error, got %v", err)
	}
	if *stopped {
		t.Fatal("low disk space took the panel offline")
	}
	if MaintenanceActive(w.Plan.Deployment.HostDir) {
		t.Fatal("low disk space left maintenance enabled")
	}
}

func TestLowDiskSpaceForBackupStopsBeforeMaintenance(t *testing.T) {
	w, stopped := fixture(t, false, false, false)
	// Enough for the tiny fixture archives, not for the database backup margin
	// once the downloads are done.
	calls := 0
	w.FreeSpace = func(string) (uint64, error) {
		calls++
		if calls <= 2 {
			return 1 << 40, nil
		}
		return spaceMargin - 1, nil
	}
	if err := w.Run(context.Background()); err == nil || !strings.Contains(err.Error(), "数据库备份") {
		t.Fatalf("expected backup space error, got %v", err)
	}
	if *stopped || MaintenanceActive(w.Plan.Deployment.HostDir) {
		t.Fatal("backup space check ran after the panel went offline")
	}
}

func recoveryDocker(t *testing.T, helperRunning, healthy bool) *Docker {
	return &Docker{Run: func(ctx context.Context, in io.Reader, out io.Writer, args ...string) error {
		switch args[0] {
		case "ps":
			if helperRunning {
				// args: ps --filter name=^/<helper>$ --format {{.Names}}
				io.WriteString(out, strings.TrimSuffix(strings.TrimPrefix(args[2], "name=^/"), "$"))
			}
			return nil
		case "inspect":
			c := Container{}
			c.State.Running = healthy
			return json.NewEncoder(out).Encode([]Container{c})
		case "exec":
			url := args[len(args)-1]
			switch {
			case strings.HasSuffix(url, "/flow/test"):
				io.WriteString(out, "test")
			case strings.HasSuffix(url, "/captcha/check"):
				io.WriteString(out, `{"code":0}`)
			default:
				io.WriteString(out, `<div id="root"></div>`)
			}
			return nil
		}
		t.Fatalf("unexpected Docker operation: %v", args)
		return nil
	}}
}

func interruptedJob(t *testing.T, status string) string {
	t.Helper()
	root := t.TempDir()
	state, err := Create(root, Plan{Version: "3.2.1", FromVersion: "3.2.0", Deployment: Deployment{Backend: "api", Frontend: "ui"}})
	if err != nil {
		t.Fatal(err)
	}
	if err := atomicWrite(MaintenancePath(root), []byte(state.ID), 0600); err != nil {
		t.Fatal(err)
	}
	if status != "running" {
		if err := Finish(root, state, status, "interrupted"); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func TestRecoverLiftsMaintenanceOnlyWhenHealthy(t *testing.T) {
	root := interruptedJob(t, "failed")
	if _, err := Recover(context.Background(), root, recoveryDocker(t, false, false), 20*time.Millisecond); err == nil {
		t.Fatal("unhealthy deployment reopened")
	}
	if !MaintenanceActive(root) {
		t.Fatal("maintenance lifted despite failed health check")
	}
	state, err := Recover(context.Background(), root, recoveryDocker(t, false, true), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if MaintenanceActive(root) {
		t.Fatal("maintenance not lifted for a healthy deployment")
	}
	if !strings.Contains(state.Events[len(state.Events)-1].Message, "解除维护") {
		t.Fatalf("recovery not recorded: %+v", state.Events)
	}
}

func TestRecoverRefusesWhileUpgradeRuns(t *testing.T) {
	for name, tc := range map[string]struct {
		status        string
		helperRunning bool
	}{"active job": {"running", false}, "helper alive": {"rollback_failed", true}} {
		t.Run(name, func(t *testing.T) {
			root := interruptedJob(t, tc.status)
			if _, err := Recover(context.Background(), root, recoveryDocker(t, tc.helperRunning, true), time.Second); !errors.Is(err, ErrNotRecoverable) {
				t.Fatalf("expected refusal, got %v", err)
			}
			if !MaintenanceActive(root) {
				t.Fatal("maintenance lifted while the worker may still run")
			}
		})
	}
}
