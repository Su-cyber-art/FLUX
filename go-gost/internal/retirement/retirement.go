// Package retirement removes only installations owned by the FLUX installer.
package retirement

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const Marker = ".retiring"

type installation struct {
	dir, binary, service string
	systemd              []string
	openrc               string
	pidfile              string
	run                  func(string, ...string) error
}

// Uninstall never accepts paths from a panel command. Directory and executable
// must match an installer-owned layout, and service files must identify it.
func Uninstall(stop func() error) error {
	dir, err := os.Getwd()
	if err != nil {
		return err
	}
	binary, err := os.Executable()
	if err != nil {
		return err
	}
	i, err := locate(dir, binary)
	if err != nil {
		return err
	}
	return i.remove(stop)
}

func locate(dir, binary string) (*installation, error) {
	i := &installation{dir: dir, binary: binary, run: runCommand}
	switch {
	case dir == "/etc/flux_agent" && binary == "/etc/flux_agent/flux_agent":
		i.service = "flux_agent"
		i.systemd = []string{"/etc/systemd/system/flux_agent.service"}
		i.openrc = "/etc/init.d/flux_agent"
		i.pidfile = "/run/flux_agent.pid"
	case dir == "/etc/gost" && binary == "/usr/local/bin/gost":
		i.service = "gost"
		i.systemd = []string{"/etc/systemd/system/gost.service", "/lib/systemd/system/gost.service", "/usr/lib/systemd/system/gost.service"}
	default:
		return nil, fmt.Errorf("无法确认 agent 安装目录，请使用官方安装脚本安装到 /etc/flux_agent 后重试")
	}
	resolved, err := filepath.EvalSymlinks(dir)
	if err != nil || resolved != dir {
		return nil, fmt.Errorf("拒绝清理符号链接安装目录 %s", dir)
	}
	return i, nil
}

func runCommand(name string, args ...string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, name, args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %v: %w: %s", name, args, err, strings.TrimSpace(string(output)))
	}
	return nil
}

func (i *installation) remove(stop func() error) error {
	var units []string
	for _, path := range i.systemd {
		data, err := os.ReadFile(path)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return err
		}
		if !strings.Contains(string(data), "WorkingDirectory="+i.dir+"\n") || !strings.Contains(string(data), "ExecStart="+i.binary+"\n") {
			return fmt.Errorf("服务 %s 不属于当前 agent，拒绝删除", path)
		}
		units = append(units, path)
	}
	openrc := false
	if i.openrc != "" {
		data, err := os.ReadFile(i.openrc)
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		if err == nil {
			if !strings.Contains(string(data), `command="`+i.binary+`"`) || !strings.Contains(string(data), `directory="`+i.dir+`"`) {
				return fmt.Errorf("服务 %s 不属于当前 agent，拒绝删除", i.openrc)
			}
			openrc = true
		}
	}
	// A crash before cleanup finishes must never restore forwarding on restart.
	if err := os.WriteFile(filepath.Join(i.dir, Marker), []byte("retiring\n"), 0600); err != nil {
		return err
	}
	if len(units) > 0 {
		if err := i.run("systemctl", "disable", i.service+".service"); err != nil {
			return err
		}
	}
	if openrc {
		if err := i.run("rc-update", "del", i.service, "default"); err != nil {
			return err
		}
	}
	if err := stop(); err != nil {
		return err
	}
	for _, path := range units {
		if err := os.Remove(path); err != nil {
			return err
		}
	}
	if len(units) > 0 {
		if err := i.run("systemctl", "daemon-reload"); err != nil {
			return err
		}
	}
	if openrc {
		if err := os.Remove(i.openrc); err != nil {
			return err
		}
	}
	if i.pidfile != "" {
		if err := os.Remove(i.pidfile); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	// Legacy installs keep the binary outside their configuration directory.
	if filepath.Dir(i.binary) != i.dir {
		for _, path := range []string{i.binary, i.binary + ".bak", i.binary + ".old"} {
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				return err
			}
		}
	}
	return os.RemoveAll(i.dir)
}
