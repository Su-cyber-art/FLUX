package panelupgrade

import (
	"bytes"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

func mappingValue(node *yaml.Node, key string) *yaml.Node {
	if node == nil || node.Kind != yaml.MappingNode {
		return nil
	}
	for i := 0; i+1 < len(node.Content); i += 2 {
		if node.Content[i].Value == key {
			return node.Content[i+1]
		}
	}
	return nil
}

func setMapping(node *yaml.Node, key string, value *yaml.Node) {
	for i := 0; i+1 < len(node.Content); i += 2 {
		if node.Content[i].Value == key {
			node.Content[i+1] = value
			return
		}
	}
	node.Content = append(node.Content, &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: key}, value)
}

// PatchCompose only changes images and the reported version. Relative mounts,
// ports, volumes, database settings and custom service options are preserved.
func PatchCompose(data []byte, backendImage, frontendImage, version string) ([]byte, error) {
	var root yaml.Node
	if err := yaml.Unmarshal(data, &root); err != nil {
		return nil, errors.New("Compose 配置不是有效的 YAML")
	}
	if len(root.Content) != 1 {
		return nil, errors.New("Compose 配置为空")
	}
	services := mappingValue(root.Content[0], "services")
	for _, item := range []struct{ name, image string }{{"backend", backendImage}, {"frontend", frontendImage}} {
		node := mappingValue(services, item.name)
		if node == nil || node.Kind != yaml.MappingNode {
			return nil, errors.New("Compose 缺少 backend / frontend 服务")
		}
		if mappingValue(node, "build") != nil {
			return nil, errors.New("源码构建部署请使用部署脚本更新")
		}
		setMapping(node, "image", &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: item.image})
		if item.name == "backend" {
			environment := mappingValue(node, "environment")
			if environment == nil {
				environment = &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
				setMapping(node, "environment", environment)
			}
			switch environment.Kind {
			case yaml.MappingNode:
				setMapping(environment, "FLUX_VERSION", &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: version})
			case yaml.SequenceNode:
				found := false
				for _, value := range environment.Content {
					if strings.HasPrefix(value.Value, "FLUX_VERSION=") {
						value.Value = "FLUX_VERSION=" + version
						found = true
					}
				}
				if !found {
					environment.Content = append(environment.Content, &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: "FLUX_VERSION=" + version})
				}
			default:
				return nil, errors.New("backend environment 配置格式不受支持")
			}
		}
	}
	var out bytes.Buffer
	encoder := yaml.NewEncoder(&out)
	encoder.SetIndent(2)
	if err := encoder.Encode(&root); err != nil {
		return nil, err
	}
	return out.Bytes(), encoder.Close()
}

var envVersionLine = regexp.MustCompile(`(?m)^[ \t]*(?:export[ \t]+)?FLUX_VERSION[ \t]*=.*$`)

func EnvWithVersion(data []byte, version string) ([]byte, error) {
	if err := ValidateVersion(version); err != nil {
		return nil, err
	}
	if envVersionLine.Match(data) {
		return envVersionLine.ReplaceAll(data, []byte("FLUX_VERSION="+version)), nil
	}
	return []byte(strings.TrimRight(string(data), "\r\n") + "\nFLUX_VERSION=" + version + "\n"), nil
}

func copyFile(source, target string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(output, input)
	if copyErr == nil {
		copyErr = output.Sync()
	}
	return errors.Join(copyErr, output.Close())
}

func copyDirectory(source, target string) error {
	if err := os.MkdirAll(target, 0700); err != nil {
		return err
	}
	return filepath.WalkDir(source, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		destination := filepath.Join(target, rel)
		if entry.IsDir() {
			return os.MkdirAll(destination, 0700)
		}
		if !entry.Type().IsRegular() {
			return errors.New("数据目录包含非常规文件，已停止自动备份")
		}
		return copyFile(path, destination)
	})
}

func restoreDirectory(backup, target string) error {
	if info, err := os.Stat(backup); err != nil || !info.IsDir() {
		return errors.New("数据库备份不存在")
	}
	entries, err := os.ReadDir(target)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if err := os.RemoveAll(filepath.Join(target, entry.Name())); err != nil {
			return err
		}
	}
	return copyDirectory(backup, target)
}
