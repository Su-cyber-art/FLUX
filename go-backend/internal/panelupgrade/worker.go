package panelupgrade

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Worker struct {
	Plan          Plan
	State         *State
	Docker        *Docker
	Client        *http.Client
	HealthTimeout time.Duration
	// FreeSpace reports available bytes on a path's filesystem; nil uses statfs.
	FreeSpace func(string) (uint64, error)
	dir       string
	backup    string
}

// RunFile is invoked by a detached container using the current backend image.
func RunFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var plan Plan
	if err := json.Unmarshal(data, &plan); err != nil {
		return err
	}
	dir, err := JobDir(plan.Deployment.HostDir, plan.ID)
	if err != nil {
		return err
	}
	if filepath.Clean(path) != filepath.Join(dir, "plan.json") {
		return errors.New("升级任务路径与计划不匹配")
	}
	state, err := Load(plan.Deployment.HostDir, plan.ID)
	if err != nil {
		return err
	}
	if state == nil || !state.Active() || state.Stage != "queued" {
		return errors.New("升级任务已执行或已中断")
	}
	w := &Worker{Plan: plan, State: state, Docker: NewDocker(), Client: &http.Client{Timeout: 20 * time.Minute}, HealthTimeout: 180 * time.Second}
	if plan.Deployment.HealthTimeoutSeconds >= 10 && plan.Deployment.HealthTimeoutSeconds <= 300 {
		w.HealthTimeout = time.Duration(plan.Deployment.HealthTimeoutSeconds) * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	return w.Run(ctx)
}

func (w *Worker) stage(stage, message string) error {
	w.State.Stage, w.State.Message = stage, message
	w.State.Downloaded, w.State.Total = 0, 0
	w.State.Events = append(w.State.Events, Event{Time: time.Now().UnixMilli(), Message: message})
	return Save(w.Plan.Deployment.HostDir, w.State)
}

func (w *Worker) Run(ctx context.Context) (result error) {
	var err error
	w.dir, err = JobDir(w.Plan.Deployment.HostDir, w.Plan.ID)
	if err != nil {
		return err
	}
	w.backup = filepath.Join(w.dir, "backup")
	defer func() {
		if recovered := recover(); recovered != nil {
			result = fmt.Errorf("升级任务异常: %v", recovered)
		}
		if result == nil {
			return
		}
		w.State.Error = result.Error()
		status, message := "failed", "升级失败，当前版本未变更"
		if w.State.BackendStopped {
			recoveryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			recoveryErr := w.rollback(recoveryCtx)
			cancel()
			if recoveryErr == nil {
				status, message = "rolled_back", "升级失败，已恢复原版本和数据"
			} else {
				status, message = "rollback_failed", "自动恢复失败，请使用保留的备份恢复服务"
				w.State.Error += "；恢复失败：" + recoveryErr.Error()
			}
		}
		if status != "rollback_failed" {
			_ = os.Remove(MaintenancePath(w.Plan.Deployment.HostDir))
		}
		if finishErr := Finish(w.Plan.Deployment.HostDir, w.State, status, message); finishErr != nil {
			result = errors.Join(result, finishErr)
		}
	}()
	if err := ValidateVersion(w.Plan.Version); err != nil {
		return err
	}
	if err := w.stage("preparing", "检查升级文件与当前部署"); err != nil {
		return err
	}
	checksums, err := w.checksums(ctx)
	if err != nil {
		return err
	}
	for _, component := range []string{"backend", "frontend"} {
		name := fmt.Sprintf("flux-%s-linux-%s.tar.gz", component, w.Plan.Deployment.Architecture)
		expected, ok := checksums[name]
		if !ok {
			return fmt.Errorf("发布校验清单缺少 %s", name)
		}
		if err := w.stage("downloading_"+component, map[string]string{"backend": "下载后端镜像", "frontend": "下载前端镜像"}[component]); err != nil {
			return err
		}
		path := filepath.Join(w.dir, name)
		if err := w.download(ctx, name, path, expected); err != nil {
			_ = os.Remove(path)
			return err
		}
		if err := w.stage("loading_"+component, "校验通过，导入"+map[string]string{"backend": "后端", "frontend": "前端"}[component]+"镜像"); err != nil {
			return err
		}
		err := w.Docker.Run(ctx, nil, io.Discard, "load", "-i", path)
		_ = os.Remove(path)
		if err != nil {
			return fmt.Errorf("导入 %s 镜像失败: %w", component, err)
		}
		if _, err := w.Docker.output(ctx, "image", "inspect", ImagePrefix+"/"+component+":"+w.Plan.Version); err != nil {
			return errors.New("镜像包不包含目标版本的镜像")
		}
	}
	if err := w.prepareFiles(ctx); err != nil {
		return err
	}
	// Running out of space while the backend is stopped would force a rollback,
	// so make sure the backup fits before taking the panel offline.
	if err := w.ensureSpace(w.databaseSize(ctx)+spaceMargin, "数据库备份"); err != nil {
		return err
	}
	if err := w.stage("backing_up", "备份配置与数据库，面板将短暂离线"); err != nil {
		return err
	}
	w.State.BackupPath = filepath.Join(Directory, w.Plan.ID, "backup")
	if err := atomicWrite(MaintenancePath(w.Plan.Deployment.HostDir), []byte(w.Plan.ID), 0600); err != nil {
		return err
	}
	w.State.BackendStopped = true
	if err := w.Docker.Compose(ctx, w.Plan.Deployment, []string{filepath.Join(w.Plan.Deployment.HostDir, "docker-compose.yml")}, "stop", "--timeout", "65", "backend"); err != nil {
		return err
	}
	if err := w.backupDatabase(ctx); err != nil {
		return fmt.Errorf("数据库备份失败: %w", err)
	}
	w.State.DatabaseBackedUp = true
	if err := w.stage("restarting", "切换到新版本并重新启动面板"); err != nil {
		return err
	}
	if err := w.activateFiles(); err != nil {
		return err
	}
	if err := w.restart(ctx); err != nil {
		return err
	}
	if err := w.stage("checking", "确认前后端服务已经恢复"); err != nil {
		return err
	}
	if err := w.Docker.WaitHealthy(ctx, w.Plan.Deployment, w.HealthTimeout); err != nil {
		return err
	}
	if err := os.Remove(MaintenancePath(w.Plan.Deployment.HostDir)); err != nil {
		return err
	}
	w.cleanup(ctx)
	return Finish(w.Plan.Deployment.HostDir, w.State, "succeeded", "升级完成，面板已恢复可用")
}

func (w *Worker) prepareFiles(ctx context.Context) error {
	root := w.Plan.Deployment.HostDir
	original, err := os.ReadFile(filepath.Join(root, "docker-compose.yml"))
	if err != nil {
		return err
	}
	next, err := PatchCompose(original, ImagePrefix+"/backend:"+w.Plan.Version, ImagePrefix+"/frontend:"+w.Plan.Version, w.Plan.Version)
	if err != nil {
		return err
	}
	if err := atomicWrite(filepath.Join(w.dir, "next-compose.yml"), next, 0600); err != nil {
		return err
	}
	if err := w.Docker.Compose(ctx, w.Plan.Deployment, []string{filepath.Join(w.dir, "next-compose.yml")}, "config", "--quiet"); err != nil {
		return fmt.Errorf("新配置验证失败: %w", err)
	}
	if err := os.Mkdir(w.backup, 0700); err != nil {
		return err
	}
	for _, name := range []string{"docker-compose.yml", ".env"} {
		if err := copyFile(filepath.Join(root, name), filepath.Join(w.backup, name)); err != nil {
			return err
		}
	}
	return nil
}

func (w *Worker) activateFiles() error {
	data, err := os.ReadFile(filepath.Join(w.dir, "next-compose.yml"))
	if err != nil {
		return err
	}
	if err := atomicWrite(filepath.Join(w.Plan.Deployment.HostDir, "docker-compose.yml"), data, 0600); err != nil {
		return err
	}
	env, err := os.ReadFile(filepath.Join(w.backup, ".env"))
	if err != nil {
		return err
	}
	env, err = EnvWithVersion(env, w.Plan.Version)
	if err != nil {
		return err
	}
	return atomicWrite(filepath.Join(w.Plan.Deployment.HostDir, ".env"), env, 0600)
}

func (w *Worker) restart(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, w.HealthTimeout)
	defer cancel()
	return w.Docker.Compose(ctx, w.Plan.Deployment, []string{filepath.Join(w.Plan.Deployment.HostDir, "docker-compose.yml")}, "up", "-d", "--no-deps", "--pull", "never", "--force-recreate", "backend", "frontend")
}

func (w *Worker) backupDatabase(ctx context.Context) error {
	if w.Plan.Deployment.DBType == "sqlite" {
		return copyDirectory(w.Plan.Deployment.DataDir, filepath.Join(w.backup, "sqlite"))
	}
	f, err := os.OpenFile(filepath.Join(w.backup, "postgres.dump"), os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	err = w.Docker.Run(ctx, nil, f, "exec", w.Plan.Deployment.Postgres, "sh", "-c", `export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump --format=custom -U "$POSTGRES_USER" "$POSTGRES_DB"`)
	return errors.Join(err, f.Close())
}

func (w *Worker) rollback(ctx context.Context) error {
	_ = w.stage("rolling_back", "正在恢复原版本和数据库备份")
	root := w.Plan.Deployment.HostDir
	if err := w.Docker.Compose(ctx, w.Plan.Deployment, []string{filepath.Join(root, "docker-compose.yml")}, "stop", "--timeout", "65", "backend", "frontend"); err != nil {
		return err
	}
	if w.State.DatabaseBackedUp {
		if w.Plan.Deployment.DBType == "sqlite" {
			if err := restoreDirectory(filepath.Join(w.backup, "sqlite"), w.Plan.Deployment.DataDir); err != nil {
				return err
			}
		} else {
			f, err := os.Open(filepath.Join(w.backup, "postgres.dump"))
			if err != nil {
				return err
			}
			defer f.Close()
			if err := w.Docker.Run(ctx, f, io.Discard, "exec", "-i", w.Plan.Deployment.Postgres, "sh", "-c", `export PGPASSWORD="$POSTGRES_PASSWORD"; dropdb --force --if-exists --maintenance-db=template1 -U "$POSTGRES_USER" "$POSTGRES_DB" && exec pg_restore --create --exit-on-error -U "$POSTGRES_USER" -d template1`); err != nil {
				return err
			}
		}
	}
	original, err := os.ReadFile(filepath.Join(w.backup, "docker-compose.yml"))
	if err != nil {
		return err
	}
	pinned, err := PatchCompose(original, w.Plan.Deployment.BackendImage, w.Plan.Deployment.FrontendImage, w.Plan.FromVersion)
	if err != nil {
		return err
	}
	if err := atomicWrite(filepath.Join(root, "docker-compose.yml"), pinned, 0600); err != nil {
		return err
	}
	env, err := os.ReadFile(filepath.Join(w.backup, ".env"))
	if err != nil {
		return err
	}
	if err := atomicWrite(filepath.Join(root, ".env"), env, 0600); err != nil {
		return err
	}
	if err := w.restart(ctx); err != nil {
		return err
	}
	return w.Docker.WaitHealthy(ctx, w.Plan.Deployment, w.HealthTimeout)
}

func (w *Worker) checksums(ctx context.Context) (map[string]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, w.Plan.DownloadBase+"/SHA256SUMS", nil)
	if err != nil {
		return nil, err
	}
	res, err := w.Client.Do(req)
	if err != nil {
		return nil, errors.New("无法下载发布校验清单，请检查网络或 GitHub 代理")
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("下载校验清单失败（HTTP %d）", res.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, 65537))
	if err != nil {
		return nil, err
	}
	if len(data) > 65536 {
		return nil, errors.New("发布校验清单过大")
	}
	checksums := map[string]string{}
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) != 2 || len(fields[0]) != 64 {
			return nil, errors.New("发布校验清单格式无效")
		}
		if _, err := hex.DecodeString(fields[0]); err != nil {
			return nil, err
		}
		if _, exists := checksums[fields[1]]; exists {
			return nil, errors.New("发布校验清单包含重复文件")
		}
		checksums[fields[1]] = strings.ToLower(fields[0])
	}
	return checksums, scanner.Err()
}

func (w *Worker) download(ctx context.Context, name, path, expected string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, w.Plan.DownloadBase+"/"+name, nil)
	if err != nil {
		return err
	}
	res, err := w.Client.Do(req)
	if err != nil {
		return errors.New("下载镜像失败，请检查网络或 GitHub 代理")
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("下载 %s 失败（HTTP %d）", name, res.StatusCode)
	}
	const maximum = 2 << 30
	if res.ContentLength > maximum {
		return errors.New("镜像包超过大小限制")
	}
	if res.ContentLength > 0 {
		if err := w.ensureSpace(uint64(res.ContentLength)+spaceMargin, "下载 "+name); err != nil {
			return err
		}
	}
	w.State.Total = max(res.ContentLength, 0)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	hash := sha256.New()
	reader := &progressReader{reader: io.LimitReader(res.Body, maximum+1), worker: w}
	count, copyErr := io.Copy(io.MultiWriter(f, hash), reader)
	closeErr := f.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		return fmt.Errorf("下载镜像未完成: %w", err)
	}
	if count > maximum {
		return errors.New("镜像包超过大小限制")
	}
	if res.ContentLength >= 0 && count != res.ContentLength {
		return errors.New("镜像下载不完整")
	}
	if hex.EncodeToString(hash.Sum(nil)) != expected {
		return fmt.Errorf("%s 的 SHA-256 校验失败，已停止升级", name)
	}
	return Save(w.Plan.Deployment.HostDir, w.State)
}

type progressReader struct {
	reader io.Reader
	worker *Worker
	last   time.Time
}

func (r *progressReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	r.worker.State.Downloaded += int64(n)
	if time.Since(r.last) >= 250*time.Millisecond {
		r.last = time.Now()
		if saveErr := Save(r.worker.Plan.Deployment.HostDir, r.worker.State); saveErr != nil {
			return n, saveErr
		}
	}
	return n, err
}

// spaceMargin keeps headroom for state files, logs and filesystem overhead.
const spaceMargin = 64 << 20

func (w *Worker) ensureSpace(need uint64, purpose string) error {
	measure := w.FreeSpace
	if measure == nil {
		measure = freeBytes
	}
	free, err := measure(w.dir)
	if err != nil {
		// An unmeasurable filesystem must not block the upgrade; the later
		// write still fails safely before the backend is stopped.
		return nil
	}
	if free < need {
		return fmt.Errorf("部署目录磁盘空间不足：%s需要约 %s，当前可用 %s，请清理后重试", purpose, formatBytes(need), formatBytes(free))
	}
	return nil
}

// databaseSize estimates the backup size. A failed estimate returns 0 so the
// margin alone is checked.
func (w *Worker) databaseSize(ctx context.Context) uint64 {
	if w.Plan.Deployment.DBType == "sqlite" {
		var total uint64
		_ = filepath.WalkDir(w.Plan.Deployment.DataDir, func(_ string, entry os.DirEntry, err error) error {
			if err == nil && entry.Type().IsRegular() {
				if info, infoErr := entry.Info(); infoErr == nil {
					total += uint64(info.Size())
				}
			}
			return nil
		})
		return total
	}
	sizeCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	out, err := w.Docker.output(sizeCtx, "exec", w.Plan.Deployment.Postgres, "sh", "-c", `export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -tAq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select pg_database_size(current_database())"`)
	if err != nil {
		return 0
	}
	size, err := strconv.ParseUint(strings.TrimSpace(string(out)), 10, 64)
	if err != nil {
		return 0
	}
	// pg_dump's custom format is compressed and skips indexes, so the dump is
	// well below the on-disk size; half of it is still a conservative bound.
	return size / 2
}

// cleanup is best effort: the upgrade already succeeded, so failures here are
// only recorded in the job log.
func (w *Worker) cleanup(ctx context.Context) {
	cleanupCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	jobs, jobErr := PruneJobs(w.Plan.Deployment.HostDir, w.Plan.ID, KeepJobs)
	images := w.Docker.PruneImages(cleanupCtx, []string{w.Plan.Version, w.Plan.FromVersion}, []string{w.Plan.Deployment.BackendImage, w.Plan.Deployment.FrontendImage})
	message := fmt.Sprintf("已清理 %d 份旧升级备份、%d 个旧版本镜像（保留最近 %d 次升级记录与上一版本镜像）", jobs, images, KeepJobs)
	if jobErr != nil {
		message = fmt.Sprintf("清理旧升级备份未完成：%v；已清理 %d 个旧版本镜像", jobErr, images)
	}
	w.State.Events = append(w.State.Events, Event{Time: time.Now().UnixMilli(), Message: message})
}

func formatBytes(value uint64) string {
	switch {
	case value >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(value)/(1<<30))
	case value >= 1<<20:
		return fmt.Sprintf("%.0f MB", float64(value)/(1<<20))
	default:
		return fmt.Sprintf("%d KB", value>>10)
	}
}
