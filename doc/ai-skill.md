# API Skill 接入

仓库保留了 `skills/flvx-api/`，用于向支持本地技能的 AI 工具提供面板 API 说明。`flvx-api` 与 `FLVX_*` 名称作为兼容标识继续使用。

## 从当前仓库安装

先克隆本仓库，按所用工具的技能目录规则链接或复制 `skills/flvx-api/`。下面使用通用的本地技能目录，已有同名技能时请先核对来源：

```bash
git clone https://github.com/Su-cyber-art/FLUX.git
cd FLUX
mkdir -p ~/.agents/skills
ln -s "$PWD/skills/flvx-api" ~/.agents/skills/flvx-api
```

上游 npm 包 `@flvx/skill-api` 与本仓库源码是不同的分发渠道，不能据此判断当前个人分支已发布 npm 版本。

## 连接配置

按照技能说明提供面板地址与凭据：

```bash
export FLVX_BASE_URL="https://panel.example.com"
export FLVX_USERNAME="your_username"
export FLVX_PASSWORD="your_password"
```

本地凭据文件应放在仓库外，并限制读取权限。使用能够安全保存凭据的客户端配置方式，不将真实密码或令牌写入版本库。

## 接口约定

- 管理 API 位于 `/api/v1/`。
- `Authorization` 头发送原始 JWT，不加 `Bearer`。
- 响应使用 `{code, msg, data, ts}`，`code` 为 `0` 表示成功。
- 具体 HTTP 方法按对应接口说明使用；监控接口包含 GET，不能将所有接口一律作为 POST。
- 可用操作受登录账号的服务端权限约束。

常用功能包括节点、隧道、转发、用户、分组、限速、面板共享和备份。先用查询操作确认目标面板与资源，再执行创建、修改或删除。

接口参考保存在 [技能目录](https://github.com/Su-cyber-art/FLUX/tree/main/skills/flvx-api)。
