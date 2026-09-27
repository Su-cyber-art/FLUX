# 数据库指南

FLUX 支持 SQLite 和 PostgreSQL，后端通过 GORM 维护两种数据库的表结构。

## 配置

| 环境变量 | 用途 |
| --- | --- |
| `DB_TYPE` | `sqlite` 或 `postgres`，默认 SQLite |
| `DB_PATH` | SQLite 文件路径，默认 `/app/data/gost.db` |
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `POSTGRES_DB` | Compose 中 PostgreSQL 容器初始化的数据库名 |
| `POSTGRES_USER` | Compose 中 PostgreSQL 容器初始化的用户名 |
| `POSTGRES_PASSWORD` | Compose 中 PostgreSQL 容器的初始化密码 |

## 使用 Compose 中的 PostgreSQL

在项目根目录 `.env` 中设置以下变量，替换示例密码：

```dotenv
DB_TYPE=postgres
DATABASE_URL=postgres://flux_panel:replace_with_password@postgres:5432/flux_panel?sslmode=disable
POSTGRES_DB=flux_panel
POSTGRES_USER=flux_panel
POSTGRES_PASSWORD=replace_with_password
```

先启动数据库，待 `docker compose ... ps` 显示健康后启动面板：

```bash
docker compose -f docker-compose-v4.yml -f compose.source.yml up -d postgres
docker compose -f docker-compose-v4.yml -f compose.source.yml ps postgres
docker compose -f docker-compose-v4.yml -f compose.source.yml up -d --build backend frontend
```

若使用外部 PostgreSQL，将 `DATABASE_URL` 指向外部地址，按服务端要求配置 TLS，并仅启动 backend/frontend。连接字符串中的特殊字符需进行 URL 编码。

## 备份

SQLite 使用 `sqlite_data` 卷。复制数据库前应停止写入，或使用 SQLite 的在线备份能力，以保持 WAL 数据一致。

PostgreSQL 可通过 Compose 服务执行逻辑备份：

```bash
docker compose -f docker-compose-v4.yml -f compose.source.yml exec -T postgres pg_dump -U flux_panel flux_panel > flux-backup.sql
```

如果修改了数据库用户名或名称，请同步替换命令参数。备份文件应保存到独立位置，并检查可恢复性。

## 从 SQLite 迁移

修改 `DB_TYPE` 只会切换数据库连接，不会自动搬运数据。

1. 保留原 SQLite 数据库的完整备份，并从面板导出需要迁移的业务配置。
2. 准备空的 PostgreSQL 数据库，使用新连接启动后端完成表结构初始化。
3. 将业务备份导入新实例，核对用户、节点、隧道、规则、分组、权限和流量字段。
4. 在切换代理连接之前验证新实例。需要保留监控历史等数据库级数据时，另行执行并核对数据库迁移。

仓库保留的安装脚本可能有原有部署方式的迁移菜单。源码 Compose 部署使用不同的配置文件组合，迁移前应核对实际卷名、网络名和部署路径。

## 密码与已有数据卷

`POSTGRES_PASSWORD` 用于首次初始化。更改 `.env` 后，已有数据库的角色密码不会自动改变；应先在数据库中更新实际凭据，再同步 `DATABASE_URL`。已有数据卷不应因认证失败而被删除。
