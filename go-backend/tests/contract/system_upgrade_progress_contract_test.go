package contract_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"go-backend/internal/auth"
	"go-backend/internal/panelupgrade"
)

func TestUpgradeProgressRequiresAdminAndSurvivesNewRouter(t *testing.T) {
	root := t.TempDir()
	t.Setenv("PANEL_DEPLOY_DIR", root)
	state, err := panelupgrade.Create(root, panelupgrade.Plan{Version: "3.2.1", FromVersion: "3.2.0"})
	if err != nil {
		t.Fatal(err)
	}
	state.Stage = "downloading_backend"
	state.Downloaded = 50
	state.Total = 100
	if err := panelupgrade.Save(root, state); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		router, r := setupContractRouter(t, "upgrade-contract-secret")
		token, err := auth.GenerateTokenAt(1, "admin_user", 0, "upgrade-contract-secret", time.Now().Add(time.Millisecond))
		if err != nil {
			t.Fatal(err)
		}
		result := postAuthRequest(t, router, token, "/api/v1/system/upgrade/status", `{}`)
		if result.Code != 0 {
			t.Fatalf("status failed: %+v", result)
		}
		data := result.Data.(map[string]interface{})
		if data["id"] != state.ID || data["downloaded"] != float64(50) || data["total"] != float64(100) {
			t.Fatalf("progress was lost after router recreation: %+v", data)
		}
		if _, exists := data["downloadBase"]; exists {
			t.Fatal("private plan exposed")
		}
		if anonymous := postAuthRequest(t, router, "", "/api/v1/system/upgrade/status", `{}`); anonymous.Code != 401 {
			t.Fatal("anonymous progress access permitted")
		}
		seedContractUser(t, r, 99001, "upgrade-viewer", 1, 1)
		viewer, err := auth.GenerateTokenAt(99001, "upgrade-viewer", 1, "upgrade-contract-secret", time.Now().Add(time.Second))
		if err != nil {
			t.Fatal(err)
		}
		if result := postAuthRequest(t, router, viewer, "/api/v1/system/upgrade/status", `{}`); result.Code != 403 {
			t.Fatal("non-admin can read upgrade state")
		}
	}
}

func TestUpgradeMaintenanceProtectsWritesWhileProgressRemainsReadable(t *testing.T) {
	root := t.TempDir()
	t.Setenv("PANEL_DEPLOY_DIR", root)
	state, err := panelupgrade.Create(root, panelupgrade.Plan{Version: "3.2.1", FromVersion: "3.2.0"})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, panelupgrade.Directory, "maintenance"), []byte(state.ID), 0600); err != nil {
		t.Fatal(err)
	}
	router, _ := setupContractRouter(t, "upgrade-contract-secret")
	token, err := auth.GenerateTokenAt(1, "admin_user", 0, "upgrade-contract-secret", time.Now().Add(time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/config/update", bytes.NewBufferString(`{"upgrade_test":"must not write"}`))
	req.Header.Set("Authorization", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("write during backup was not rejected: %d", rec.Code)
	}
	var body map[string]any
	if json.Unmarshal(rec.Body.Bytes(), &body) != nil || body["code"] != float64(503) {
		t.Fatal("maintenance error contract invalid")
	}
	if result := postAuthRequest(t, router, token, "/api/v1/system/upgrade/status", `{}`); result.Code != 0 {
		t.Fatal("maintenance hid upgrade progress")
	}
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/flow/test", nil))
	if rec.Code != 200 {
		t.Fatal("maintenance blocked health probes")
	}
}
