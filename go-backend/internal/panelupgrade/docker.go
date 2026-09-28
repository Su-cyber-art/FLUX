package panelupgrade

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Deployment struct {
	HostDir              string   `json:"hostDir"`
	Project              string   `json:"project"`
	Backend              string   `json:"backend"`
	Frontend             string   `json:"frontend"`
	Postgres             string   `json:"postgres,omitempty"`
	BackendImage         string   `json:"backendImage"`
	FrontendImage        string   `json:"frontendImage"`
	Network              string   `json:"network"`
	Architecture         string   `json:"architecture"`
	DBType               string   `json:"dbType"`
	DataDir              string   `json:"dataDir"`
	HealthTimeoutSeconds int      `json:"healthTimeoutSeconds,omitempty"`
	ExtraHosts           []string `json:"extraHosts,omitempty"`
}

type Container struct {
	ID         string
	Name       string
	Image      string
	HostConfig struct{ ExtraHosts []string }
	Config     struct {
		User   string
		Env    []string
		Labels map[string]string
	}
	State struct {
		Running  bool
		ExitCode int
		Health   struct{ Status string }
	}
	Mounts []struct {
		Type, Source, Destination, Name string
		RW                              bool
	}
	NetworkSettings struct{ Networks map[string]json.RawMessage }
}

type Docker struct {
	// Inject command execution in unit tests; production always uses Docker's
	// mounted Unix socket, independent of the helper container's environment.
	Run func(context.Context, io.Reader, io.Writer, ...string) error
}

func NewDocker() *Docker {
	return &Docker{Run: func(ctx context.Context, input io.Reader, output io.Writer, args ...string) error {
		cmd := exec.CommandContext(ctx, "docker", args...)
		cmd.Env = append(os.Environ(), "DOCKER_HOST=unix:///var/run/docker.sock")
		cmd.Stdin, cmd.Stdout = input, output
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		// Do not expose CLI stderr: Compose may include expanded secrets.
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("Docker %s 失败: %w", args[0], err)
		}
		return nil
	}}
}

func (d *Docker) output(ctx context.Context, args ...string) ([]byte, error) {
	var out bytes.Buffer
	err := d.Run(ctx, nil, &out, args...)
	return out.Bytes(), err
}

func (d *Docker) Inspect(ctx context.Context, name string) (*Container, error) {
	out, err := d.output(ctx, "inspect", name)
	if err != nil {
		return nil, err
	}
	var containers []Container
	if err := json.Unmarshal(out, &containers); err != nil {
		return nil, err
	}
	if len(containers) != 1 {
		return nil, errors.New("未找到面板容器")
	}
	return &containers[0], nil
}

func envValue(c *Container, key string) string {
	for _, item := range c.Config.Env {
		if value, ok := strings.CutPrefix(item, key+"="); ok {
			return value
		}
	}
	return ""
}

var safeName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)

// Discover preserves the existing Compose project and resolves container paths
// to host paths. Docker interprets bind sources on the daemon's host.
func (d *Docker) Discover(ctx context.Context, localDir, backendName string) (Deployment, error) {
	p := Deployment{Backend: backendName, DataDir: "/app/data"}
	if !filepath.IsAbs(localDir) || !safeName.MatchString(backendName) {
		return p, errors.New("部署目录或容器名称无效")
	}
	for _, name := range []string{"docker-compose.yml", ".env"} {
		info, err := os.Stat(filepath.Join(localDir, name))
		if err != nil || !info.Mode().IsRegular() {
			return p, fmt.Errorf("部署目录缺少 %s", name)
		}
	}
	if _, err := d.output(ctx, "compose", "version"); err != nil {
		return p, errors.New("Docker Compose 不可用")
	}
	backend, err := d.Inspect(ctx, backendName)
	if err != nil {
		return p, err
	}
	if !backend.State.Running {
		return p, errors.New("后端容器未运行")
	}
	p.Backend = strings.TrimPrefix(backend.Name, "/")
	if user := strings.Split(backend.Config.User, ":")[0]; user != "" && user != "0" && user != "root" {
		return p, errors.New("当前容器使用自定义运行用户，请使用部署脚本更新以保留文件权限")
	}
	p.Project = backend.Config.Labels["com.docker.compose.project"]
	if !safeName.MatchString(p.Project) || backend.Config.Labels["com.docker.compose.service"] != "backend" {
		return p, errors.New("当前容器不属于受支持的 Compose 面板部署")
	}
	for _, mount := range backend.Mounts {
		if filepath.Clean(mount.Destination) == filepath.Clean(localDir) && mount.Type == "bind" && mount.RW {
			p.HostDir = mount.Source
		}
	}
	if !filepath.IsAbs(p.HostDir) || strings.ContainsAny(p.HostDir, ":\r\n") {
		return p, errors.New("部署目录需要可写的宿主机绑定挂载")
	}
	files := backend.Config.Labels["com.docker.compose.project.config_files"]
	if files != filepath.Join(p.HostDir, "docker-compose.yml") {
		return p, errors.New("自升级支持单个 docker-compose.yml；源码或多配置文件部署请使用部署脚本更新")
	}
	p.BackendImage = backend.Image
	p.ExtraHosts = append([]string(nil), backend.HostConfig.ExtraHosts...)
	if seconds, err := strconv.Atoi(envValue(backend, "PANEL_UPGRADE_HEALTH_TIMEOUT")); err == nil && seconds >= 10 && seconds <= 300 {
		p.HealthTimeoutSeconds = seconds
	}
	var networks []string
	for name := range backend.NetworkSettings.Networks {
		networks = append(networks, name)
	}
	sort.Strings(networks)
	if len(networks) == 0 {
		return p, errors.New("无法确定面板网络")
	}
	p.Network = networks[0]
	frontend, err := d.findService(ctx, p.Project, "frontend")
	if err != nil {
		return p, err
	}
	if !frontend.State.Running {
		return p, errors.New("前端容器未运行")
	}
	p.Frontend, p.FrontendImage = strings.TrimPrefix(frontend.Name, "/"), frontend.Image
	arch, err := d.output(ctx, "info", "--format", "{{.OSType}}/{{.Architecture}}")
	if err != nil {
		return p, err
	}
	switch strings.TrimSpace(string(arch)) {
	case "linux/amd64", "linux/x86_64":
		p.Architecture = "amd64"
	case "linux/arm64", "linux/aarch64":
		p.Architecture = "arm64"
	default:
		return p, errors.New("仅支持 Linux amd64 / arm64 发布镜像")
	}
	p.DBType = strings.ToLower(strings.TrimSpace(envValue(backend, "DB_TYPE")))
	if p.DBType == "postgresql" {
		p.DBType = "postgres"
	}
	if p.DBType == "" {
		p.DBType = "sqlite"
	}
	switch p.DBType {
	case "sqlite":
		if envValue(backend, "DB_PATH") != "/app/data/gost.db" {
			return p, errors.New("自动备份需要 SQLite 数据存储在 /app/data/gost.db")
		}
		mounted := false
		for _, m := range backend.Mounts {
			if m.Destination == p.DataDir && m.RW {
				mounted = true
			}
		}
		if !mounted {
			return p, errors.New("SQLite 数据目录未挂载，无法保证升级后保留数据")
		}
	case "postgres":
		pg, err := d.findService(ctx, p.Project, "postgres")
		if err != nil {
			return p, errors.New("PostgreSQL 自动备份需要同一项目的 postgres 容器")
		}
		u, err := url.Parse(envValue(backend, "DATABASE_URL"))
		if err != nil {
			return p, errors.New("数据库连接配置无法验证")
		}
		pgName := strings.TrimPrefix(pg.Name, "/")
		if (u.Hostname() != "postgres" && u.Hostname() != pgName) || strings.TrimPrefix(u.Path, "/") != envValue(pg, "POSTGRES_DB") || strings.TrimPrefix(u.Path, "/") == "template1" {
			return p, errors.New("数据库连接与备份容器不匹配，无法安全进行自动备份")
		}
		p.Postgres = pgName
	default:
		return p, errors.New("当前数据库类型不支持自动备份")
	}
	return p, nil
}

func (d *Docker) findService(ctx context.Context, project, service string) (*Container, error) {
	out, err := d.output(ctx, "ps", "-aq", "--filter", "label=com.docker.compose.project="+project, "--filter", "label=com.docker.compose.service="+service)
	if err != nil {
		return nil, err
	}
	ids := strings.Fields(string(out))
	if len(ids) != 1 {
		return nil, fmt.Errorf("无法唯一确定 %s 容器", service)
	}
	return d.Inspect(ctx, ids[0])
}

func HelperName(id string) string { return "flux-upgrade-" + id }

func (d *Docker) HelperRunning(ctx context.Context, id string) (bool, error) {
	if !validID.MatchString(id) {
		return false, errors.New("升级任务编号无效")
	}
	out, err := d.output(ctx, "ps", "--filter", "name=^/"+HelperName(id)+"$", "--format", "{{.Names}}")
	return strings.TrimSpace(string(out)) == HelperName(id), err
}

func (d *Docker) Start(ctx context.Context, plan Plan) (string, error) {
	dir, err := JobDir(plan.Deployment.HostDir, plan.ID)
	if err != nil {
		return "", err
	}
	args := []string{"run", "-d", "--rm", "--pull", "never", "--user", "0:0", "--name", HelperName(plan.ID),
		"--volumes-from", plan.Deployment.Backend,
		"--volume", plan.Deployment.HostDir + ":" + plan.Deployment.HostDir,
		"--network", plan.Deployment.Network}
	for _, host := range plan.Deployment.ExtraHosts {
		args = append(args, "--add-host", host)
	}
	args = append(args, "--entrypoint", "/app/paneld", plan.Deployment.BackendImage, "upgrade-worker", filepath.Join(dir, "plan.json"))
	out, err := d.output(ctx, args...)
	return strings.TrimSpace(string(out)), err
}

func (d *Docker) Compose(ctx context.Context, p Deployment, files []string, args ...string) error {
	base := []string{"compose", "--project-name", p.Project, "--project-directory", p.HostDir, "--env-file", filepath.Join(p.HostDir, ".env")}
	for _, file := range files {
		base = append(base, "-f", file)
	}
	return d.Run(ctx, nil, io.Discard, append(base, args...)...)
}

func (d *Docker) WaitHealthy(ctx context.Context, p Deployment, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	for {
		backend, err := d.Inspect(ctx, p.Backend)
		front, frontErr := d.Inspect(ctx, p.Frontend)
		if err == nil && frontErr == nil && backend.State.Running && front.State.Running {
			probeCtx, stop := context.WithTimeout(ctx, 5*time.Second)
			out, probeErr := d.output(probeCtx, "exec", p.Frontend, "wget", "-q", "-T", "3", "-O", "-", "http://127.0.0.1/flow/test")
			stop()
			if probeErr == nil && strings.TrimSpace(string(out)) == "test" {
				pageCtx, pageCancel := context.WithTimeout(ctx, 5*time.Second)
				page, pageErr := d.output(pageCtx, "exec", p.Frontend, "wget", "-q", "-T", "3", "-O", "-", "http://127.0.0.1/")
				pageCancel()
				if pageErr == nil && strings.Contains(string(page), `id="root"`) {
					return nil
				}
			}
		}
		select {
		case <-ctx.Done():
			return errors.New("面板健康检查超时，前后端未恢复可用")
		case <-time.After(time.Second):
		}
	}
}
