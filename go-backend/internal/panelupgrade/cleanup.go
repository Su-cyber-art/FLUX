package panelupgrade

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// KeepJobs is how many upgrade job directories (each holding a full database
// backup) survive a successful upgrade, counting the one that just finished.
const KeepJobs = 3

// PruneJobs deletes the oldest job directories beyond keep. The job named by
// keepID and any job that is still running are never removed.
func PruneJobs(deployDir, keepID string, keep int) (int, error) {
	root := filepath.Join(deployDir, Directory)
	entries, err := os.ReadDir(root)
	if err != nil {
		return 0, err
	}
	type job struct {
		id      string
		started int64
	}
	var jobs []job
	for _, entry := range entries {
		if !entry.IsDir() || !validID.MatchString(entry.Name()) || entry.Name() == keepID {
			continue
		}
		started := int64(0)
		if state, err := Load(deployDir, entry.Name()); err == nil {
			if state.Active() {
				continue
			}
			started = state.StartedAt
		} else if info, err := entry.Info(); err == nil {
			started = info.ModTime().UnixMilli()
		}
		jobs = append(jobs, job{id: entry.Name(), started: started})
	}
	sort.Slice(jobs, func(i, j int) bool { return jobs[i].started > jobs[j].started })
	removed := 0
	// keepID already occupies one of the kept slots.
	for index, item := range jobs {
		if index < keep-1 {
			continue
		}
		if err := os.RemoveAll(filepath.Join(root, item.id)); err != nil {
			return removed, err
		}
		removed++
	}
	return removed, nil
}

// PruneImages removes release images other than the new version and the one
// the upgrade started from, which stays available for a manual rollback.
// Images still used by a container are left alone by Docker.
func (d *Docker) PruneImages(ctx context.Context, keepTags, keepIDs []string) int {
	keep := map[string]bool{}
	for _, value := range append(append([]string(nil), keepTags...), keepIDs...) {
		if value != "" {
			keep[value] = true
		}
	}
	removed := 0
	for _, component := range []string{"backend", "frontend"} {
		repository := ImagePrefix + "/" + component
		out, err := d.output(ctx, "image", "ls", "--no-trunc", "--format", "{{.ID}} {{.Tag}}", repository)
		if err != nil {
			continue
		}
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			fields := strings.Fields(line)
			if len(fields) != 2 || keep[fields[0]] || keep[fields[1]] || ValidateVersion(fields[1]) != nil {
				continue
			}
			if d.Run(ctx, nil, io.Discard, "image", "rm", repository+":"+fields[1]) == nil {
				removed++
			}
		}
	}
	return removed
}
