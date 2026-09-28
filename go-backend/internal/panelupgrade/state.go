// Package panelupgrade runs panel upgrades independently of the web server.
package panelupgrade

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"time"
)

const Directory = ".flux-upgrade"
const ImagePrefix = "ghcr.io/su-cyber-art/flux"

var ErrBusy = errors.New("已有面板升级任务执行中")
var validID = regexp.MustCompile(`^[a-f0-9]{32}$`)
var validVersion = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9][A-Za-z0-9.-]*)?$`)

type Event struct {
	Time    int64  `json:"time"`
	Message string `json:"message"`
}

type State struct {
	ID               string  `json:"id"`
	FromVersion      string  `json:"fromVersion"`
	Version          string  `json:"version"`
	Status           string  `json:"status"`
	Stage            string  `json:"stage"`
	Message          string  `json:"message"`
	Downloaded       int64   `json:"downloaded"`
	Total            int64   `json:"total"`
	StartedAt        int64   `json:"startedAt"`
	UpdatedAt        int64   `json:"updatedAt"`
	FinishedAt       int64   `json:"finishedAt,omitempty"`
	Error            string  `json:"error,omitempty"`
	BackupPath       string  `json:"backupPath,omitempty"`
	Events           []Event `json:"events"`
	BackendStopped   bool    `json:"-"`
	DatabaseBackedUp bool    `json:"-"`
}

func (s *State) Active() bool { return s != nil && s.Status == "running" }

// Plan is private, stored with mode 0600, and never returned by an API.
type Plan struct {
	ID           string     `json:"id"`
	Version      string     `json:"version"`
	FromVersion  string     `json:"fromVersion"`
	DownloadBase string     `json:"downloadBase"`
	Deployment   Deployment `json:"deployment"`
}

func ValidateVersion(version string) error {
	if !validVersion.MatchString(version) {
		return errors.New("版本号格式无效")
	}
	return nil
}

func JobDir(deployDir, id string) (string, error) {
	if !validID.MatchString(id) {
		return "", errors.New("升级任务编号无效")
	}
	return filepath.Join(deployDir, Directory, id), nil
}

func Create(deployDir string, plan Plan) (*State, error) {
	if err := ValidateVersion(plan.Version); err != nil {
		return nil, err
	}
	root := filepath.Join(deployDir, Directory)
	if err := os.MkdirAll(root, 0700); err != nil {
		return nil, err
	}
	if err := os.Mkdir(filepath.Join(root, "lock"), 0700); err != nil {
		if os.IsExist(err) {
			return nil, ErrBusy
		}
		return nil, err
	}
	ok := false
	defer func() {
		if !ok {
			_ = os.RemoveAll(filepath.Join(root, "lock"))
		}
	}()
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return nil, err
	}
	plan.ID = hex.EncodeToString(id[:])
	dir, _ := JobDir(deployDir, plan.ID)
	if err := os.Mkdir(dir, 0700); err != nil {
		return nil, err
	}
	if err := writeJSON(filepath.Join(dir, "plan.json"), plan); err != nil {
		return nil, err
	}
	s := &State{ID: plan.ID, FromVersion: plan.FromVersion, Version: plan.Version, Status: "running", Stage: "queued", Message: "升级任务已创建", StartedAt: time.Now().UnixMilli(), Events: []Event{}}
	if err := Save(deployDir, s); err != nil {
		return nil, err
	}
	if err := atomicWrite(filepath.Join(root, "current"), []byte(plan.ID), 0600); err != nil {
		return nil, err
	}
	if err := atomicWrite(filepath.Join(root, "lock", "owner"), []byte(plan.ID), 0600); err != nil {
		return nil, err
	}
	ok = true
	return s, nil
}

func Load(deployDir, id string) (*State, error) {
	if id == "" {
		data, err := os.ReadFile(filepath.Join(deployDir, Directory, "current"))
		if os.IsNotExist(err) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		id = string(data)
	}
	dir, err := JobDir(deployDir, id)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(dir, "state.json"))
	if err != nil {
		return nil, err
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func Save(deployDir string, s *State) error {
	dir, err := JobDir(deployDir, s.ID)
	if err != nil {
		return err
	}
	s.UpdatedAt = time.Now().UnixMilli()
	return writeJSON(filepath.Join(dir, "state.json"), s)
}

func Finish(deployDir string, s *State, status, message string) error {
	s.Status, s.Message, s.FinishedAt = status, message, time.Now().UnixMilli()
	s.Events = append(s.Events, Event{Time: s.FinishedAt, Message: message})
	if err := Save(deployDir, s); err != nil {
		return err
	}
	root := filepath.Join(deployDir, Directory, "lock")
	owner, err := os.ReadFile(filepath.Join(root, "owner"))
	if err == nil && string(owner) == s.ID {
		return os.RemoveAll(root)
	}
	return err
}

func writeJSON(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return atomicWrite(path, data, 0600)
}

func atomicWrite(path string, data []byte, mode os.FileMode) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".upgrade-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if err := f.Chmod(mode); err != nil {
		f.Close()
		return err
	}
	if _, err := f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(f.Name(), path); err != nil {
		return fmt.Errorf("保存升级状态失败: %w", err)
	}
	return nil
}
