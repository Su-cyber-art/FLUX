package retirement

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestOnlyInstallerOwnedLayoutsAreAccepted(t *testing.T) {
	for _, paths := range [][2]string{{"/", "/flux_agent"}, {"/etc/flux_agent", "/usr/bin/other"}, {"/tmp/agent", "/tmp/agent/flux_agent"}} {
		if _, err := locate(paths[0], paths[1]); err == nil {
			t.Fatalf("unsafe layout accepted: %v", paths)
		}
	}
}

func TestRemoveInstallation(t *testing.T) {
	for _, manager := range []string{"systemd", "openrc"} {
		t.Run(manager, func(t *testing.T) {
			root := t.TempDir()
			dir := filepath.Join(root, "flux_agent")
			if err := os.Mkdir(dir, 0700); err != nil {
				t.Fatal(err)
			}
			for _, name := range []string{"config.json", "gost.json", "gost.yaml", "flux_agent", "flux_agent.bak", "upgrade.json"} {
				if err := os.WriteFile(filepath.Join(dir, name), []byte("secret or config"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			foreign := filepath.Join(root, "keep")
			os.WriteFile(foreign, []byte("unrelated"), 0600)
			i := &installation{dir: dir, binary: filepath.Join(dir, "flux_agent"), service: "flux_agent"}
			unit := filepath.Join(root, "unit")
			if manager == "systemd" {
				i.systemd = []string{unit}
				os.WriteFile(unit, []byte("WorkingDirectory="+dir+"\nExecStart="+i.binary+"\n"), 0600)
			} else {
				i.openrc = unit
				os.WriteFile(unit, []byte(`command="`+i.binary+`"`+"\n"+`directory="`+dir+`"`), 0600)
			}
			var calls []string
			i.run = func(name string, args ...string) error {
				calls = append(calls, name+" "+strings.Join(args, " "))
				return nil
			}
			stopped := false
			if err := i.remove(func() error {
				if len(calls) == 0 {
					t.Fatal("must disable autostart before runtime cleanup")
				}
				if _, err := os.Stat(filepath.Join(dir, Marker)); err != nil {
					t.Fatal("missing crash guard")
				}
				stopped = true
				return nil
			}); err != nil {
				t.Fatal(err)
			}
			if !stopped {
				t.Fatal("runtime not stopped")
			}
			for _, path := range []string{dir, unit} {
				if _, err := os.Stat(path); !os.IsNotExist(err) {
					t.Fatalf("leftover: %s", path)
				}
			}
			if _, err := os.Stat(foreign); err != nil {
				t.Fatal("unrelated file removed")
			}
		})
	}
}

func TestCleanupFailureRetainsFilesAndCrashGuard(t *testing.T) {
	dir := t.TempDir()
	unit := filepath.Join(dir, "unit")
	binary := filepath.Join(dir, "flux_agent")
	os.WriteFile(unit, []byte("WorkingDirectory="+dir+"\nExecStart="+binary+"\n"), 0600)
	i := &installation{dir: dir, binary: binary, service: "flux_agent", systemd: []string{unit}, run: func(string, ...string) error { return errors.New("disable failed") }}
	called := false
	if err := i.remove(func() error { called = true; return nil }); err == nil {
		t.Fatal("failure must propagate")
	}
	if called {
		t.Fatal("should not remove runtime after disable failure")
	}
	if _, err := os.Stat(filepath.Join(dir, Marker)); err != nil {
		t.Fatal("restart guard missing")
	}
	if _, err := os.Stat(unit); err != nil {
		t.Fatal("unit removed on failure")
	}
	os.WriteFile(unit, []byte("ExecStart=/unrelated\n"), 0600)
	if err := i.remove(func() error { t.Fatal("foreign service reached cleanup"); return nil }); err == nil {
		t.Fatal("foreign service accepted")
	}
}
