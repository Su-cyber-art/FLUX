# 常见问题

## 为什么克隆后仍能看到 FLVX 名称？

FLUX 基于 FLVX 开发，部分界面默认名称、目录、环境变量和协议标识继续保留，以兼容既有实现。个人维护范围和上游来源见仓库 README 与 NOTICE。

## 为什么运行旧安装脚本后没有 Mantine 界面？

根目录脚本和原有 Compose 文件继承自上游发布流程，可能使用上游镜像。部署本分支请按 [源码部署](install.md) 合并 `compose.source.yml`，或使用本仓库实际发布的匹配资源。

## 本地页面正常，但接口失败？

先确认 Go API 正在运行。默认开发代理目标是 `http://127.0.0.1:6365`；使用其他地址时设置 `VITE_API_PROXY`。设置 `VITE_API_BASE` 时不要重复添加 `/api/v1`。

## 面板无法访问？

检查 `.env` 中的端口、容器健康状态、监听地址及反向代理。源码部署可运行：

```bash
docker compose -f docker-compose-v4.yml -f compose.source.yml ps
docker compose -f docker-compose-v4.yml -f compose.source.yml logs --tail=100 backend frontend
```

## 节点一直离线？

核对代理 `config.json` 中的面板地址和节点密钥、代理进程日志，以及节点到面板的网络连通性。通过域名连接时，代理还需正确转发 `/system-info` WebSocket 和流量上报接口。

## TCP 正常，UDP 或 IPv6 不通？

分别检查目标服务、节点防火墙/安全组、宿主机路由和 Docker 网络是否支持对应协议。界面配置成功不代表网络路径已经放行。

## 看不到监控或管理页面？

节点、隧道、用户及系统配置等功能需要管理员权限。普通用户的监控访问需要单独授权；授权后重新聚焦窗口或切换页面会刷新导航权限。

## PostgreSQL 修改密码后连接失败？

`POSTGRES_PASSWORD` 的初始化值不会自动修改已有数据卷中的数据库角色密码。应同步数据库实际凭据和 `DATABASE_URL`，不要通过删除已有数据卷解决认证问题。详见 [数据库指南](postgresql.md)。

## 为什么版本检查没有可用更新？

仓库标签、GitHub Release 和容器镜像是不同的发布资源。版本查询以相应仓库实际发布的内容为准，个人分支在发布产物准备好之前可继续从源码构建更新。
