package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"go-backend/internal/panelupgrade"
)

func fakeReleases(t *testing.T) *int {
	t.Helper()
	calls := 0
	previous := systemUpgradeHTTPGet
	systemUpgradeHTTPGet = func(*http.Client, string) (*http.Response, error) {
		calls++
		body := `[{"tag_name":"3.4.0-beta.1"},{"tag_name":"3.3.0"},{"tag_name":"3.2.0"}]`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
	}
	t.Cleanup(func() { systemUpgradeHTTPGet = previous })
	t.Setenv(panelDeployDirEnv, t.TempDir())
	t.Setenv("FLUX_VERSION", "3.2.0")
	return &calls
}

func decodeData[T any](t *testing.T, rr *httptest.ResponseRecorder) T {
	t.Helper()
	var envelope struct {
		Code int `json:"code"`
		Data T   `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &envelope); err != nil || envelope.Code != 0 {
		t.Fatalf("unexpected response %s (%v)", rr.Body.String(), err)
	}
	return envelope.Data
}

func TestSystemVersionHonoursChannelAndCachesReleases(t *testing.T) {
	calls := fakeReleases(t)
	h := &Handler{}
	for i := 0; i < 2; i++ {
		rr := httptest.NewRecorder()
		h.systemVersion(rr, httptest.NewRequest(http.MethodPost, "/api/v1/system/version", strings.NewReader(`{"channel":"dev"}`)))
		data := decodeData[systemUpgradeVersionData](t, rr)
		if data.Channel != "dev" || data.LatestVersion != "3.4.0-beta.1" || !data.HasUpdate {
			t.Fatalf("dev channel ignored: %+v", data)
		}
	}
	if *calls != 1 {
		t.Fatalf("settings page reloads hit GitHub %d times, want 1", *calls)
	}

	rr := httptest.NewRecorder()
	h.systemVersion(rr, httptest.NewRequest(http.MethodPost, "/api/v1/system/version", nil))
	if data := decodeData[systemUpgradeVersionData](t, rr); data.Channel != "stable" || data.LatestVersion != "3.3.0" {
		t.Fatalf("empty body must default to stable: %+v", data)
	}

	rr = httptest.NewRecorder()
	h.systemCheckUpdates(rr, httptest.NewRequest(http.MethodPost, "/api/v1/system/check-updates", strings.NewReader(`{"channel":"stable"}`)))
	decodeData[systemUpgradeCheckData](t, rr)
	if *calls != 2 {
		t.Fatalf("explicit update check must bypass the cache, GitHub calls = %d", *calls)
	}
}

func TestSystemUpgradeStatusReportsLeftoverMaintenance(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(panelDeployDirEnv, dir)
	state, err := panelupgrade.Create(dir, panelupgrade.Plan{Version: "3.3.0", FromVersion: "3.2.0"})
	if err != nil {
		t.Fatal(err)
	}
	if err := panelupgrade.Finish(dir, state, "rollback_failed", "rollback failed"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, panelupgrade.Directory, "maintenance"), []byte(state.ID), 0o600); err != nil {
		t.Fatal(err)
	}

	h := &Handler{}
	rr := httptest.NewRecorder()
	h.systemUpgradeStatus(rr, httptest.NewRequest(http.MethodPost, "/api/v1/system/upgrade/status", strings.NewReader(`{}`)))
	if data := decodeData[panelupgrade.State](t, rr); !data.Maintenance || data.Status != "rollback_failed" {
		t.Fatalf("maintenance flag not reported: %+v", data)
	}

	saved, err := os.ReadFile(filepath.Join(dir, panelupgrade.Directory, state.ID, "state.json"))
	if err != nil || strings.Contains(string(saved), "maintenance") {
		t.Fatalf("maintenance must not be persisted in job state: %s (%v)", saved, err)
	}
}
