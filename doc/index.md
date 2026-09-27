# FLUX 文档

FLUX 是 [Su-cyber-art](https://github.com/Su-cyber-art) 个人维护的流量转发管理面板，基于 [FLVX](https://github.com/Sagit-chu/flvx) 继续开发。当前前端使用 Mantine，后端与代理采用 Go / GOST。

## 从这里开始

| 需求 | 文档 |
| --- | --- |
| 了解项目、来源与当前状态 | [仓库说明](https://github.com/Su-cyber-art/FLUX#readme) |
| 在本地运行、构建与修改代码 | [开发指南](development.md) |
| 部署当前个人分支 | [源码部署](install.md) |
| 添加节点、隧道、规则与用户 | [使用指南](usage.md) |
| 使用 PostgreSQL、备份与迁移 | [数据库指南](postgresql.md) |
| 接入 API 操作技能 | [AI Skill 接入](ai-skill.md) |
| 处理常见问题 | [FAQ](faq.md) |

## 版本与发布

这些文档以当前仓库源码为准。前端重构已通过构建与静态检查，真实节点和完整业务交互验证仍在完善。发行资源以 [FLUX Releases](https://github.com/Su-cyber-art/FLUX/releases) 为准，问题反馈使用 [FLUX Issues](https://github.com/Su-cyber-art/FLUX/issues)。

源码保留了部分 FLVX 名称、配置键和 API 标识，以兼容既有面板数据及代理协议。历史设计记录不一定代表当前部署方式。
