package handler

import (
	"fmt"
	"io"
	"net"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"testing"
	"time"
)

// Opt in only on disposable Linux CI hosts/containers. This exercises the real
// agent binary, listeners, encrypted WebSocket commands and service manager.
func TestAgentRemovalIntegration(t *testing.T) {
	binary := os.Getenv("FLUX_AGENT_INTEGRATION_BINARY")
	if binary == "" {
		t.Skip("requires disposable Linux host with FLUX_AGENT_INTEGRATION_BINARY")
	}
	if runtime.GOOS != "linux" || os.Geteuid() != 0 {
		t.Fatal("integration test requires root on disposable Linux")
	}
	const dir = "/etc/flux_agent"
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("refusing to replace existing agent installation")
	}
	manager := os.Getenv("FLUX_AGENT_SERVICE_MANAGER")
	if manager == "" {
		manager = "systemd"
	}
	unit := "/etc/systemd/system/flux_agent.service"
	if manager == "openrc" {
		unit = "/etc/init.d/flux_agent"
	}
	if _, err := os.Stat(unit); !os.IsNotExist(err) {
		t.Fatal("refusing to replace existing service")
	}
	run := func(name string, args ...string) {
		t.Helper()
		if out, err := exec.Command(name, args...).CombinedOutput(); err != nil {
			t.Fatalf("%s %v: %v\n%s", name, args, err, out)
		}
	}
	t.Cleanup(func() {
		if manager == "openrc" {
			exec.Command("rc-service", "flux_agent", "stop").Run()
			exec.Command("rc-update", "del", "flux_agent", "default").Run()
		} else {
			exec.Command("systemctl", "stop", "flux_agent").Run()
			exec.Command("systemctl", "disable", "flux_agent").Run()
		}
		os.Remove(unit)
		os.RemoveAll(dir)
		if manager == "systemd" {
			exec.Command("systemctl", "daemon-reload").Run()
		}
	})
	h := newDeletionHandler(t, filepath.Join(t.TempDir(), "integration.db"))
	n := seedDeletionNode(t, h, 1, 0)
	server := httptest.NewServer(h.WebSocketHandler())
	defer server.Close()
	if err := os.Mkdir(dir, 0700); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(binary)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(dir+"/flux_agent", data, 0700); err != nil {
		t.Fatal(err)
	}
	write := func(path, contents string) {
		t.Helper()
		if err := os.WriteFile(path, []byte(contents), 0700); err != nil {
			t.Fatal(err)
		}
	}
	write(dir+"/config.json", fmt.Sprintf(`{"addr":%q,"secret":%q}`, server.URL, n.Secret))
	// A real TCP listener must disappear after retirement.
	reservation, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := reservation.Addr().(*net.TCPAddr).Port
	reservation.Close()
	target := httptest.NewServer(nil)
	defer target.Close()
	write(dir+"/gost.json", fmt.Sprintf(`{"services":[{"name":"retirement-listener","addr":"127.0.0.1:%d","handler":{"type":"tcp"},"listener":{"type":"tcp"},"forwarder":{"nodes":[{"name":"target","addr":%q}]}}]}`, port, target.Listener.Addr().String()))
	write(dir+"/flux_agent.bak", "old binary")
	if manager == "systemd" {
		write(unit, "[Unit]\nDescription=FLUX retirement integration\n[Service]\nWorkingDirectory="+dir+"\nExecStart="+dir+"/flux_agent\nRestart=on-failure\n[Install]\nWantedBy=multi-user.target\n")
		run("systemctl", "daemon-reload")
		run("systemctl", "enable", "--now", "flux_agent")
	} else {
		write(unit, "#!/sbin/openrc-run\ncommand=\""+dir+"/flux_agent\"\ndirectory=\""+dir+"\"\ncommand_background=yes\npidfile=/run/flux_agent.pid\noutput_log=/tmp/flux-agent.log\nerror_log=/tmp/flux-agent.log\n")
		run("rc-update", "add", "flux_agent", "default")
		run("rc-service", "flux_agent", "start")
	}
	waitDeletionNodeOnline(t, h, n.ID)
	listenerAddr := "127.0.0.1:" + strconv.Itoa(port)
	conn, err := net.DialTimeout("tcp", listenerAddr, time.Second)
	if err != nil {
		t.Fatalf("initial listener missing: %v", err)
	}
	io.WriteString(conn, "GET / HTTP/1.0\r\n\r\n")
	conn.Close()
	if err := h.deleteNodeByID(n.ID); err != nil {
		t.Fatal(err)
	}
	assertNodeAbsent(t, h, n.ID)
	for _, path := range []string{dir, unit, "/etc/runlevels/default/flux_agent", "/etc/systemd/system/multi-user.target.wants/flux_agent.service"} {
		if _, err := os.Lstat(path); !os.IsNotExist(err) {
			t.Fatalf("leftover installation: %s", path)
		}
	}
	waitForCondition(t, 5*time.Second, func() bool {
		conn, err := net.DialTimeout("tcp", listenerAddr, 100*time.Millisecond)
		if conn != nil {
			conn.Close()
		}
		return err != nil
	}, "forwarding listener closed")
	if manager == "systemd" {
		waitForCondition(t, 5*time.Second, func() bool { return exec.Command("systemctl", "is-active", "--quiet", "flux_agent").Run() != nil }, "agent process exited")
	}
}
