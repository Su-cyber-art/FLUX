package panelupgrade

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gopkg.in/yaml.v3"
)

func fixture(t *testing.T, corrupt, badHealth, badRollback bool) (*Worker, *bool) {
	t.Helper()
	root := t.TempDir()
	data := filepath.Join(t.TempDir(), "data")
	if err := os.Mkdir(data, 0700); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(data, "gost.db"), []byte("original database"), 0600)
	compose := `# deployment settings must survive an upgrade
services:
  backend:
    image: old/backend:3.2.0
    environment:
      JWT_SECRET: ${JWT_SECRET}
      FLUX_VERSION: ${FLUX_VERSION}
    ports: ["6377:6365"]
    volumes: ["./:/opt/flvx-panel", "data:/app/data"]
  frontend:
    image: old/frontend:3.2.0
    ports: ["6388:80"]
volumes:
  data: {}
`
	os.WriteFile(filepath.Join(root, "docker-compose.yml"), []byte(compose), 0600)
	os.WriteFile(filepath.Join(root, ".env"), []byte("JWT_SECRET=unchanged-secret\nCUSTOM_SETTING=keep\nFLUX_VERSION=3.2.0\n"), 0600)
	archive := []byte("downloaded archive fixture")
	hash := sha256.Sum256(archive)
	digest := hex.EncodeToString(hash[:])
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "SHA256SUMS") {
			fmt.Fprintf(w, "%s  flux-backend-linux-amd64.tar.gz\n%s  flux-frontend-linux-amd64.tar.gz\n", digest, digest)
			return
		}
		if corrupt {
			w.Write([]byte("corrupt archive"))
		} else {
			w.Write(archive)
		}
	}))
	t.Cleanup(server.Close)
	deployment := Deployment{HostDir: root, Project: "existing-project", Backend: "original-backend", Frontend: "original-frontend", BackendImage: "sha256:old-backend", FrontendImage: "sha256:old-frontend", Architecture: "amd64", DBType: "sqlite", DataDir: data}
	plan := Plan{Version: "3.2.1", FromVersion: "3.2.0", Deployment: deployment, DownloadBase: server.URL}
	state, err := Create(root, plan)
	if err != nil {
		t.Fatal(err)
	}
	plan.ID = state.ID
	stopped := false
	docker := &Docker{Run: func(ctx context.Context, in io.Reader, out io.Writer, args ...string) error {
		switch args[0] {
		case "load", "image":
			return nil
		case "compose":
			all := strings.Join(args, " ")
			if !strings.Contains(all, "--project-name existing-project") || !strings.Contains(all, "--project-directory "+root) {
				t.Fatalf("lost deployment identity: %v", args)
			}
			if strings.Contains(all, " stop ") {
				stopped = true
			}
			if strings.Contains(all, " up ") {
				config, _ := os.ReadFile(filepath.Join(root, "docker-compose.yml"))
				if strings.Contains(string(config), "backend:3.2.1") && badHealth {
					os.WriteFile(filepath.Join(data, "gost.db"), []byte("modified by failed version"), 0600)
				}
			}
			return nil
		case "inspect":
			config, _ := os.ReadFile(filepath.Join(root, "docker-compose.yml"))
			newVersion := strings.Contains(string(config), "backend:3.2.1")
			running := !((newVersion && badHealth) || (!newVersion && badRollback))
			c := Container{}
			c.State.Running = running
			return json.NewEncoder(out).Encode([]Container{c})
		case "exec":
			if args[len(args)-1] == "http://127.0.0.1/" {
				io.WriteString(out, `<div id="root"></div>`)
			} else {
				io.WriteString(out, "test")
			}
			return nil
		default:
			return fmt.Errorf("unexpected Docker operation: %v", args)
		}
	}}
	return &Worker{Plan: plan, State: state, Docker: docker, Client: server.Client(), HealthTimeout: 20 * time.Millisecond}, &stopped
}

func TestUpgradeCompletesAndPreservesDeployment(t *testing.T) {
	w, stopped := fixture(t, false, false, false)
	if err := w.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !*stopped {
		t.Fatal("database was not quiesced for backup")
	}
	saved, err := Load(w.Plan.Deployment.HostDir, "")
	if err != nil {
		t.Fatal(err)
	}
	if saved.Status != "succeeded" || saved.FinishedAt == 0 {
		t.Fatalf("incorrect completion: %+v", saved)
	}
	config, _ := os.ReadFile(filepath.Join(w.Plan.Deployment.HostDir, "docker-compose.yml"))
	for _, want := range []string{"backend:3.2.1", "frontend:3.2.1", "6377:6365", "6388:80", "./:/opt/flvx-panel", "${JWT_SECRET}"} {
		if !strings.Contains(string(config), want) {
			t.Fatalf("lost %q in compose", want)
		}
	}
	env, _ := os.ReadFile(filepath.Join(w.Plan.Deployment.HostDir, ".env"))
	if !strings.Contains(string(env), "CUSTOM_SETTING=keep") || !strings.Contains(string(env), "FLUX_VERSION=3.2.1") {
		t.Fatal("environment was not preserved")
	}
	backup, _ := os.ReadFile(filepath.Join(w.backup, "sqlite", "gost.db"))
	if string(backup) != "original database" {
		t.Fatal("missing consistent database backup")
	}
	if _, err := Create(w.Plan.Deployment.HostDir, w.Plan); err != nil {
		t.Fatalf("completed job retained lock: %v", err)
	}
}

func TestChecksumFailureNeverStopsOrChangesDeployment(t *testing.T) {
	w, stopped := fixture(t, true, false, false)
	original, _ := os.ReadFile(filepath.Join(w.Plan.Deployment.HostDir, "docker-compose.yml"))
	if err := w.Run(context.Background()); err == nil || !strings.Contains(err.Error(), "SHA-256") {
		t.Fatalf("expected checksum error, got %v", err)
	}
	if *stopped {
		t.Fatal("invalid download stopped live services")
	}
	current, _ := os.ReadFile(filepath.Join(w.Plan.Deployment.HostDir, "docker-compose.yml"))
	if string(current) != string(original) {
		t.Fatal("invalid download changed configuration")
	}
	state, _ := Load(w.Plan.Deployment.HostDir, "")
	if state.Status != "failed" {
		t.Fatalf("unexpected status: %+v", state)
	}
}

func TestHealthFailureRestoresDatabaseAndPinsOriginalImages(t *testing.T) {
	w, _ := fixture(t, false, true, false)
	if err := w.Run(context.Background()); err == nil {
		t.Fatal("failed health must not report success")
	}
	state, _ := Load(w.Plan.Deployment.HostDir, "")
	if state.Status != "rolled_back" {
		t.Fatalf("rollback failed: %+v", state)
	}
	data, _ := os.ReadFile(filepath.Join(w.Plan.Deployment.DataDir, "gost.db"))
	if string(data) != "original database" {
		t.Fatalf("database not restored: %s", data)
	}
	compose, _ := os.ReadFile(filepath.Join(w.Plan.Deployment.HostDir, "docker-compose.yml"))
	if !strings.Contains(string(compose), "sha256:old-backend") || !strings.Contains(string(compose), "sha256:old-frontend") {
		t.Fatal("rollback used mutable tags instead of original images")
	}
	env, _ := os.ReadFile(filepath.Join(w.Plan.Deployment.HostDir, ".env"))
	if !strings.Contains(string(env), "FLUX_VERSION=3.2.0") {
		t.Fatal("previous version not restored")
	}
	if _, err := os.Stat(filepath.Join(w.Plan.Deployment.HostDir, Directory, "maintenance")); !os.IsNotExist(err) {
		t.Fatal("maintenance did not clear after successful recovery")
	}
}

func TestRollbackFailureIsExplicitAndRetainsMaintenance(t *testing.T) {
	w, _ := fixture(t, false, true, true)
	if err := w.Run(context.Background()); err == nil {
		t.Fatal("failed rollback reported success")
	}
	state, _ := Load(w.Plan.Deployment.HostDir, "")
	if state.Status != "rollback_failed" || state.Error == "" {
		t.Fatalf("missing rollback error: %+v", state)
	}
	if _, err := os.Stat(filepath.Join(w.Plan.Deployment.HostDir, Directory, "maintenance")); err != nil {
		t.Fatal("unsafe deployment reopened for writes")
	}
}

func TestJobLockAndStatusSurviveReload(t *testing.T) {
	root := t.TempDir()
	plan := Plan{Version: "3.2.1", FromVersion: "3.2.0"}
	first, err := Create(root, plan)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Create(root, plan); !errors.Is(err, ErrBusy) {
		t.Fatalf("concurrent task accepted: %v", err)
	}
	first.Stage = "downloading_backend"
	first.Downloaded = 40
	first.Total = 100
	if err := Save(root, first); err != nil {
		t.Fatal(err)
	}
	loaded, err := Load(root, "")
	if err != nil || loaded.ID != first.ID || loaded.Downloaded != 40 || loaded.Total != 100 {
		t.Fatalf("progress lost across reader restart: %+v %v", loaded, err)
	}
	if _, err := Load(root, "../../.env"); err == nil {
		t.Fatal("path traversal accepted")
	}
}

func TestComposePreservesListEnvironmentAndCustomVolumes(t *testing.T) {
	input := []byte("services:\n  backend:\n    image: old\n    environment: [JWT_SECRET=keep, FLUX_VERSION=3.2.0]\n    volumes: [external:/app/data]\n  frontend:\n    image: old-ui\nvolumes:\n  external:\n    external: true\n")
	output, err := PatchCompose(input, "new", "new-ui", "3.2.1")
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := yaml.Unmarshal(output, &got); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(output), "JWT_SECRET=keep") || !strings.Contains(string(output), "external: true") || !strings.Contains(string(output), "FLUX_VERSION=3.2.1") {
		t.Fatalf("custom options lost: %s", output)
	}
}

func TestVersionSelectionAvoidsDowngrades(t *testing.T) {
	for _, tc := range []struct {
		current, next string
		newer         bool
	}{{"3.2.0", "3.2.1", true}, {"3.3.0", "3.2.9", false}, {"3.2.0-beta.9", "3.2.0-beta.10", true}, {"3.2.0", "3.2.0-beta.1", false}, {"3.2.0-beta.1", "3.2.0", true}, {"3.2.0", "3.2.0", false}} {
		if IsNewer(tc.current, tc.next) != tc.newer {
			t.Fatalf("wrong version order: %+v", tc)
		}
	}
	for _, value := range []string{"3.1.2", "3.2.0\nJWT_SECRET=bad", "../latest", "3.2.0;rm"} {
		if ValidateTarget(value) == nil {
			t.Fatalf("unsafe target accepted: %q", value)
		}
	}
}
