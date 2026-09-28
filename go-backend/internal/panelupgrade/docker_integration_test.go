package panelupgrade_test

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"go-backend/internal/panelupgrade"
)

// Requires the actual release images/archives on a disposable Linux Docker
// host. It replaces its own API through HTTP, then proves checksum rejection,
// database restoration, deployment identity and progress across the restart.
func TestPanelUpgradeDocker(t *testing.T) {
	prefix := os.Getenv("FLUX_UPGRADE_INTEGRATION_IMAGE_PREFIX")
	if prefix == "" {
		t.Skip("requires disposable Docker host with built release artifacts")
	}
	if runtime.GOOS != "linux" || os.Geteuid() != 0 {
		t.Fatal("run only as root on a disposable Linux Docker runner")
	}
	version, arch, archives := os.Getenv("FLUX_RELEASE_VERSION"), os.Getenv("FLUX_UPGRADE_ARCH"), os.Getenv("FLUX_UPGRADE_ARCHIVES")
	if prefix != panelupgrade.ImagePrefix || panelupgrade.ValidateTarget(version) != nil {
		t.Fatal("invalid integration release identity")
	}
	run := func(input io.Reader, args ...string) []byte {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		cmd := exec.CommandContext(ctx, "docker", args...)
		cmd.Stdin = input
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("docker %v: %v\n%s", args, err, out)
		}
		return out
	}
	fixtureDir := t.TempDir()
	const corruptVersion, badVersion = "99.0.1", "99.0.2"
	badBackend, badFrontend := prefix+"/backend:"+badVersion, prefix+"/frontend:"+badVersion
	badContainer := strings.TrimSpace(string(run(nil, "create", prefix+"/backend:"+version)))
	run(nil, "commit", "--change", `ENTRYPOINT ["/bin/sh", "-c", "printf broken > /app/data/gost.db; exec sleep 300"]`, "--change", `CMD []`, badContainer, badBackend)
	run(nil, "rm", badContainer)
	run(nil, "tag", prefix+"/frontend:"+version, badFrontend)
	files := map[string]map[string]string{version: {}, corruptVersion: {}, badVersion: {}}
	sums := map[string]string{}
	for _, component := range []string{"backend", "frontend"} {
		name := fmt.Sprintf("flux-%s-linux-%s.tar.gz", component, arch)
		files[version][name] = filepath.Join(archives, name)
		files[corruptVersion][name] = filepath.Join(archives, name)
		files[badVersion][name] = filepath.Join(fixtureDir, name)
		file, err := os.Create(files[badVersion][name])
		if err != nil {
			t.Fatal(err)
		}
		writer := gzip.NewWriter(file)
		command := exec.Command("docker", "save", prefix+"/"+component+":"+badVersion)
		command.Stdout = writer
		command.Stderr = os.Stderr
		if err := command.Run(); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}
		file.Close()
	}
	for tag, assets := range files {
		for name, path := range assets {
			file, err := os.Open(path)
			if err != nil {
				t.Fatal(err)
			}
			hash := sha256.New()
			_, err = io.Copy(hash, file)
			file.Close()
			if err != nil {
				t.Fatal(err)
			}
			sums[tag] += hex.EncodeToString(hash.Sum(nil)) + "  " + name + "\n"
		}
	}
	listener, err := net.Listen("tcp", "0.0.0.0:0")
	if err != nil {
		t.Fatal(err)
	}
	fixture := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "api.github.com") {
			_ = json.NewEncoder(w).Encode([]map[string]any{{"tag_name": version, "name": "Upgrade test release", "draft": false}})
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) < 2 {
			http.NotFound(w, r)
			return
		}
		tag, name := parts[len(parts)-2], parts[len(parts)-1]
		if name == "SHA256SUMS" && sums[tag] != "" {
			io.WriteString(w, sums[tag])
			return
		}
		path := files[tag][name]
		if path == "" {
			http.NotFound(w, r)
			return
		}
		if tag == corruptVersion {
			io.WriteString(w, "corrupted archive")
			return
		}
		file, err := os.Open(path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer file.Close()
		info, _ := file.Stat()
		w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
		buffer := make([]byte, 128*1024)
		for {
			n, readErr := file.Read(buffer)
			if n > 0 {
				if _, err := w.Write(buffer[:n]); err != nil {
					return
				}
				time.Sleep(2 * time.Millisecond)
			}
			if readErr != nil {
				return
			}
		}
	}))
	fixture.Listener = listener
	fixture.Start()
	defer fixture.Close()
	proxyURL := "http://host.docker.internal:" + strconv.Itoa(listener.Addr().(*net.TCPAddr).Port)
	for _, database := range []string{"sqlite", "postgres"} {
		t.Run(database, func(t *testing.T) {
			root := filepath.Join(t.TempDir(), "installation with spaces")
			if err := os.Mkdir(root, 0700); err != nil {
				t.Fatal(err)
			}
			project := fmt.Sprintf("flux-upgrade-%s-%d", database, time.Now().UnixNano())
			backend, frontend, postgres := project+"-backend", project+"-frontend", project+"-postgres"
			portReservation, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			port := portReservation.Addr().(*net.TCPAddr).Port
			portReservation.Close()
			environment := map[string]string{"JWT_SECRET": "${JWT_SECRET}", "DB_TYPE": database, "DB_PATH": "/app/data/gost.db", "FLUX_VERSION": "${FLUX_VERSION}", "PANEL_DEPLOY_DIR": "/opt/flvx-panel", "PANEL_BACKEND_CONTAINER": backend, "PANEL_UPGRADE_HEALTH_TIMEOUT": "30"}
			if database == "postgres" {
				environment["DATABASE_URL"] = "postgres://flux_test:integration_password@postgres:5432/flux_panel?sslmode=disable"
			}
			services := map[string]any{
				"backend":  map[string]any{"image": prefix + "/backend:" + version, "container_name": backend, "environment": environment, "volumes": []string{"./:/opt/flvx-panel", "data:/app/data", "/var/run/docker.sock:/var/run/docker.sock"}, "extra_hosts": []string{"host.docker.internal:host-gateway"}, "healthcheck": map[string]any{"test": []string{"CMD", "wget", "-q", "--spider", "http://127.0.0.1:6365/flow/test"}, "interval": "1s", "timeout": "1s", "retries": 3}},
				"frontend": map[string]any{"image": prefix + "/frontend:" + version, "container_name": frontend, "ports": []string{fmt.Sprintf("127.0.0.1:%d:80", port)}, "depends_on": []string{"backend"}},
			}
			if database == "postgres" {
				services["postgres"] = map[string]any{"image": "postgres:16-alpine", "container_name": postgres, "environment": map[string]string{"POSTGRES_USER": "flux_test", "POSTGRES_PASSWORD": "integration_password", "POSTGRES_DB": "flux_panel"}, "volumes": []string{"pgdata:/var/lib/postgresql/data"}, "healthcheck": map[string]any{"test": []string{"CMD", "pg_isready", "-U", "flux_test", "-d", "flux_panel"}, "interval": "1s", "timeout": "1s", "retries": 30}}
				services["backend"].(map[string]any)["depends_on"] = map[string]any{"postgres": map[string]string{"condition": "service_healthy"}}
			}
			compose, _ := json.Marshal(map[string]any{"services": services, "volumes": map[string]any{"data": map[string]any{}, "pgdata": map[string]any{}}})
			os.WriteFile(filepath.Join(root, "docker-compose.yml"), compose, 0600)
			os.WriteFile(filepath.Join(root, ".env"), []byte("JWT_SECRET=integration-upgrade-session\nCUSTOM_SETTING=unchanged\nFLUX_VERSION=3.1.999\n"), 0600)
			composeArgs := []string{"compose", "--project-name", project, "--project-directory", root, "--env-file", filepath.Join(root, ".env"), "-f", filepath.Join(root, "docker-compose.yml")}
			t.Cleanup(func() {
				entries, _ := os.ReadDir(filepath.Join(root, panelupgrade.Directory))
				for _, entry := range entries {
					if _, err := panelupgrade.JobDir(root, entry.Name()); err == nil {
						exec.Command("docker", "rm", "-f", panelupgrade.HelperName(entry.Name())).Run()
					}
				}
				exec.Command("docker", append(composeArgs, "down", "--volumes", "--remove-orphans")...).Run()
			})
			run(nil, append(composeArgs, "up", "-d")...)
			base := fmt.Sprintf("http://127.0.0.1:%d/api/v1", port)
			client := &http.Client{Timeout: 3 * time.Second}
			type envelope struct {
				Code int             `json:"code"`
				Msg  string          `json:"msg"`
				Data json.RawMessage `json:"data"`
			}
			token := ""
			request := func(path string, payload any) (envelope, error) {
				var result envelope
				body, _ := json.Marshal(payload)
				req, _ := http.NewRequest(http.MethodPost, base+path, bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", token)
				response, err := client.Do(req)
				if err != nil {
					return result, err
				}
				defer response.Body.Close()
				if response.StatusCode != 200 {
					return result, fmt.Errorf("HTTP %d", response.StatusCode)
				}
				err = json.NewDecoder(response.Body).Decode(&result)
				return result, err
			}
			must := func(path string, payload any) json.RawMessage {
				t.Helper()
				response, err := request(path, payload)
				if err != nil || response.Code != 0 {
					t.Fatalf("%s: err=%v code=%d message=%s", path, err, response.Code, response.Msg)
				}
				return response.Data
			}
			deadline := time.Now().Add(90 * time.Second)
			for {
				response, err := request("/user/login", map[string]string{"username": "admin_user", "password": "admin_user"})
				if err == nil && response.Code == 0 {
					var data struct {
						Token string `json:"token"`
					}
					json.Unmarshal(response.Data, &data)
					token = data.Token
					break
				}
				if time.Now().After(deadline) {
					t.Fatal("initial deployment never became ready")
				}
				time.Sleep(time.Second)
			}
			must("/config/update", map[string]string{"github_proxy_enabled": "true", "github_proxy_url": proxyURL, "upgrade_test_marker": "preserve-me"})
			inspect := func(name string) panelupgrade.Container {
				var values []panelupgrade.Container
				json.Unmarshal(run(nil, "inspect", name), &values)
				if len(values) != 1 {
					t.Fatal("missing container")
				}
				return values[0]
			}
			initial := inspect(backend)
			versionData := must("/system/version", map[string]any{})
			var capability struct {
				Capability struct {
					Capable bool     `json:"capable"`
					Reasons []string `json:"reasons"`
				} `json:"capability"`
			}
			json.Unmarshal(versionData, &capability)
			if !capability.Capability.Capable {
				t.Fatalf("fixture should support upgrade: %v", capability.Capability.Reasons)
			}
			begin := func(target string) panelupgrade.State {
				t.Helper()
				data := must("/system/upgrade", map[string]string{"version": target})
				var result struct {
					Job panelupgrade.State `json:"job"`
				}
				if err := json.Unmarshal(data, &result); err != nil {
					t.Fatal(err)
				}
				if result.Job.ID == "" {
					t.Fatal("upgrade did not return job ID")
				}
				return result.Job
			}
			wait := func(job panelupgrade.State, expected string, mutatePG bool) {
				t.Helper()
				deadline := time.Now().Add(4 * time.Minute)
				sawBytes := false
				mutated := false
				for time.Now().Before(deadline) {
					// The helper's durable state is also observable while the API is down.
					if mutatePG && !mutated {
						local, _ := panelupgrade.Load(root, job.ID)
						if local != nil && (local.Stage == "restarting" || local.Stage == "checking") {
							run(nil, "exec", postgres, "psql", "-U", "flux_test", "-d", "flux_panel", "-c", "UPDATE vite_config SET value='modified-after-backup' WHERE name='upgrade_test_marker'")
							mutated = true
						}
					}
					response, err := request("/system/upgrade/status", map[string]any{})
					if err == nil && response.Code == 0 {
						var state panelupgrade.State
						json.Unmarshal(response.Data, &state)
						if state.ID == job.ID {
							if state.Total > 0 && state.Downloaded > 0 && state.Downloaded < state.Total {
								sawBytes = true
							}
							if !state.Active() {
								if state.Status != expected {
									t.Fatalf("expected %s, got %+v", expected, state)
								}
								if expected == "succeeded" && !sawBytes {
									t.Fatal("no real download progress was observable")
								}
								if mutatePG && !mutated {
									t.Fatal("PostgreSQL rollback fixture was not exercised")
								}
								t.Logf("%s: job %s completed as %s", database, job.ID, state.Status)
								return
							}
						}
					}
					time.Sleep(100 * time.Millisecond)
				}
				local, _ := panelupgrade.Load(root, job.ID)
				t.Fatalf("upgrade never completed: %+v", local)
			}
			job := begin(version)
			conflict, err := request("/system/upgrade", map[string]string{"version": corruptVersion})
			if err != nil || conflict.Code == 0 {
				t.Fatalf("concurrent upgrade was not rejected: %+v %v", conflict, err)
			}
			wait(job, "succeeded", false)
			after := inspect(backend)
			if after.ID == initial.ID {
				t.Fatal("backend was not actually replaced")
			}
			if after.Config.Labels["com.docker.compose.project"] != project {
				t.Fatal("compose project changed")
			}
			foundMount := false
			for _, mount := range after.Mounts {
				if mount.Destination == "/opt/flvx-panel" && mount.Source == root {
					foundMount = true
				}
			}
			if !foundMount {
				t.Fatal("host bind directory changed during upgrade")
			}
			must("/config/get", map[string]string{"name": "upgrade_test_marker"})
			wait(begin(corruptVersion), "failed", false)
			if inspect(backend).ID != after.ID {
				t.Fatal("checksum failure replaced the running backend")
			}
			wait(begin(badVersion), "rolled_back", database == "postgres")
			restored := inspect(backend)
			if restored.Image != after.Image {
				t.Fatal("rollback did not restore the previous image")
			}
			var marker struct {
				Value string `json:"value"`
			}
			json.Unmarshal(must("/config/get", map[string]string{"name": "upgrade_test_marker"}), &marker)
			if marker.Value != "preserve-me" {
				t.Fatalf("database backup was not restored: %q", marker.Value)
			}
			env, _ := os.ReadFile(filepath.Join(root, ".env"))
			if !strings.Contains(string(env), "CUSTOM_SETTING=unchanged") || !strings.Contains(string(env), "FLUX_VERSION="+version) {
				t.Fatal("configuration did not survive rollback")
			}
			current := must("/system/version", map[string]any{})
			var info struct {
				CurrentVersion string `json:"currentVersion"`
			}
			json.Unmarshal(current, &info)
			if info.CurrentVersion != version {
				t.Fatalf("wrong version after rollback: %s", info.CurrentVersion)
			}
		})
	}
}
