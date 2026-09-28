package panelupgrade

import (
	"errors"
	"strconv"
	"strings"
)

// Older releases cannot serve durable upgrade status after replacing the API.
func ValidateTarget(version string) error {
	if err := ValidateVersion(version); err != nil {
		return err
	}
	core := strings.Split(strings.SplitN(version, "-", 2)[0], ".")
	major, _ := strconv.Atoi(core[0])
	minor, _ := strconv.Atoi(core[1])
	if major < 3 || (major == 3 && minor < 2) {
		return errors.New("进度升级支持 3.2.0 及以后的版本；切换到更早版本请使用部署脚本")
	}
	return nil
}

func IsNewer(current, candidate string) bool {
	if ValidateVersion(candidate) != nil {
		return false
	}
	current = strings.TrimPrefix(current, "v")
	if ValidateVersion(current) != nil {
		return true
	}
	left := strings.SplitN(current, "-", 2)
	right := strings.SplitN(candidate, "-", 2)
	a, b := strings.Split(left[0], "."), strings.Split(right[0], ".")
	for i := 0; i < 3; i++ {
		x, _ := strconv.Atoi(a[i])
		y, _ := strconv.Atoi(b[i])
		if x != y {
			return y > x
		}
	}
	if len(left) != len(right) {
		return len(left) > len(right)
	}
	if len(left) == 1 {
		return false
	}
	a, b = strings.Split(left[1], "."), strings.Split(right[1], ".")
	for i := 0; i < len(a) && i < len(b); i++ {
		if a[i] == b[i] {
			continue
		}
		x, xe := strconv.Atoi(a[i])
		y, ye := strconv.Atoi(b[i])
		if xe == nil && ye == nil {
			return y > x
		}
		if xe == nil {
			return true
		}
		if ye == nil {
			return false
		}
		return b[i] > a[i]
	}
	return len(b) > len(a)
}
