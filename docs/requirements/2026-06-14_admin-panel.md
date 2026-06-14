# hermes-chat 后台管理面板需求文档

- 文档版本：v1.1（用户确认版）
- 创建时间：2026-06-14
- 更新时间：2026-06-15
- 作者：小P（产品经理）
- 状态：**已开发** → 404 完成

---

## 一、背景与目标

### 1.1 现状问题

当前 hermes-chat 注册接口 `/api/auth/register` 完全公开，任何人都能注册账号。缺乏：
- 注册准入控制
- 集中式后台管理界面
- 粒度化的员工访问权限管理

### 1.2 目标

1. 注册必须凭**授权码**，一人一码，用后失效
2. 授权码生成时即绑定「可用员工列表」，注册时自动继承权限
3. 提供独立部署的后台管理页面（`/admin/` 路径）
4. 管理员账号预置，JWT 认证复用现有系统

---

## 二、用户角色定义

| 角色 | 说明 | 登录方式 |
|------|------|----------|
| 超级管理员 | 预置账号，拥有全部权限 | 13459730010 / 123456 |
| 普通用户 | 通过授权码注册 | 注册时填写授权码 |

---

## 三、功能模块详细设计

### 3.1 模块一：授权码管理

#### 3.1.1 数据模型（新增 `invitation_codes` 表）

```sql
CREATE TABLE IF NOT EXISTS invitation_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,           -- 授权码（随机生成，如 HC-A8K3-M2X9）
    allowed_employees TEXT NOT NULL,     -- JSON数组，如 '["404","铁壳","老财"]'
    max_uses INTEGER NOT NULL DEFAULT 1, -- 最大使用次数（一人一码=1）
    used_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- active / used / disabled
    created_by TEXT NOT NULL,            -- 创建者user_id
    used_by TEXT,                        -- 使用者user_id（注册时填入）
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,                     -- 过期时间（可选）
    note TEXT                            -- 备注（如分配给谁）
);
```

#### 3.1.2 API 接口

**① 生成授权码**

```
POST /api/admin/invitation-codes
Authorization: Bearer <admin_token>

请求体：
{
    "allowed_employees": ["404", "铁壳", "老财"],
    "count": 1,                        // 批量生成数量，默认1
    "expires_in_hours": null,          // 过期时间（小时），null=永不过期
    "note": "分配给张三"
}

响应：
{
    "codes": [
        {
            "id": "uuid",
            "code": "HC-A8K3-M2X9",
            "allowed_employees": ["404", "铁壳", "老财"],
            "status": "active",
            "created_at": "2026-06-14T10:00:00Z",
            "expires_at": null,
            "note": "分配给张三"
        }
    ]
}
```

**② 查询授权码列表**

```
GET /api/admin/invitation-codes?status=all&page=1&limit=20
Authorization: Bearer <admin_token>

响应：
{
    "total": 50,
    "page": 1,
    "limit": 20,
    "codes": [
        {
            "id": "uuid",
            "code": "HC-A8K3-M2X9",
            "allowed_employees": ["404", "铁壳"],
            "max_uses": 1,
            "used_count": 0,
            "status": "active",
            "created_by": "admin_user_id",
            "used_by": null,
            "created_at": "2026-06-14T10:00:00Z",
            "expires_at": null,
            "note": "分配给张三"
        }
    ]
}
```

**③ 禁用授权码**

```
POST /api/admin/invitation-codes/:id/disable
Authorization: Bearer <admin_token>

响应：
{ "message": "已禁用" }
```

**④ 删除授权码**

```
DELETE /api/admin/invitation-codes/:id
Authorization: Bearer <admin_token>

响应：
{ "message": "已删除" }
```

#### 3.1.3 交互流程

```
管理员登录后台
    ↓
进入「授权码管理」页面
    ↓
点击「生成授权码」
    ↓
填写：选择可用员工（多选checkbox）+ 备注 + 数量 + 有效期
    ↓
提交 → 后端生成随机码，写入数据库
    ↓
页面显示授权码列表（可复制、禁用、删除）
    ↓
将授权码告知目标用户
    ↓
用户注册时填写授权码 → 后端验证 → 自动创建用户 + 写入权限
```

#### 3.1.4 验收标准

- [ ] 授权码格式：`HC-XXXX-XXXX`（8位随机，含大写字母+数字）
- [ ] 生成时必须指定至少一个可用员工
- [ ] 一个授权码只能使用一次（used_count >= max_uses 后自动标记为 used）
- [ ] 已过期/已禁用/已用完的码无法再使用
- [ ] 管理员可查看所有授权码及其使用状态
- [ ] 授权码使用后记录 `used_by` 和使用时间

---

### 3.2 模块二：注册流程改造

#### 3.2.1 现有接口修改

**修改 `POST /api/auth/register`**

```diff
请求体：
{
    "username": "zhangsan",
    "password": "password123",
+   "invitation_code": "HC-A8K3-M2X9"   // 新增必填字段
}
```

#### 3.2.2 注册流程

```
用户访问注册页面
    ↓
填写：用户名 + 密码 + 授权码
    ↓
提交 → 后端验证：
    1. 授权码是否存在且有效（status=active, 未过期, used_count < max_uses）
    2. 用户名是否已存在
    3. 密码格式校验
    ↓
验证通过：
    1. 创建用户（role='user'）
    2. 将授权码的 allowed_employees 写入 permissions 表
    3. 更新授权码状态（used_count+1, used_by=user_id, status='used'）
    4. 返回 JWT token
    ↓
验证失败：
    - 授权码无效 → "授权码无效或已过期"
    - 用户名已存在 → "用户名已被注册"
```

#### 3.2.3 验收标准

- [ ] 注册时必须提供有效授权码，否则拒绝注册
- [ ] 授权码验证失败返回明确错误信息
- [ ] 注册成功后用户自动获得授权码绑定的员工权限
- [ ] 授权码使用后标记为已用，不可重复使用
- [ ] 前端注册页面增加授权码输入框

---

### 3.3 模块三：用户管理

#### 3.3.1 API 接口（扩展现有）

**① 用户列表（增强）**

```
GET /api/admin/users?page=1&limit=20&search=zhang
Authorization: Bearer <admin_token>

响应：
{
    "total": 100,
    "page": 1,
    "limit": 20,
    "users": [
        {
            "id": "uuid",
            "username": "zhangsan",
            "role": "user",
            "created_at": "2026-06-14T10:00:00Z",
            "invitation_code": "HC-A8K3-M2X9",  // 注册时使用的授权码
            "allowed_employees": ["404", "铁壳"]  // 当前拥有的员工权限
        }
    ]
}
```

**② 查看用户详情**

```
GET /api/admin/users/:id
Authorization: Bearer <admin_token>

响应：
{
    "id": "uuid",
    "username": "zhangsan",
    "role": "user",
    "created_at": "2026-06-14T10:00:00Z",
    "invitation_code": "HC-A8K3-M2X9",
    "allowed_employees": ["404", "铁壳"],
    "session_count": 15,      // 会话数量
    "last_active": "2026-06-14T09:30:00Z"  // 最后活跃时间
}
```

**③ 修改用户权限**

```
PUT /api/admin/users/:id/permissions
Authorization: Bearer <admin_token>

请求体：
{
    "allowed_employees": ["404", "铁壳", "老财"]  // 完整替换
}

响应：
{ "message": "权限已更新" }
```

**④ 禁用/启用用户**

```
POST /api/admin/users/:id/toggle-status
Authorization: Bearer <admin_token>

请求体：
{
    "enabled": false   // false=禁用, true=启用
}

响应：
{ "message": "用户已禁用" }
```

**⑤ 删除用户**

```
DELETE /api/admin/users/:id
Authorization: Bearer <admin_token>

响应：
{ "message": "用户已删除" }
```

#### 3.3.2 交互流程

```
管理员登录后台
    ↓
进入「用户管理」页面
    ↓
查看用户列表（分页、搜索）
    ↓
点击某用户 → 查看详情：
    - 基本信息（用户名、角色、注册时间）
    - 注册使用的授权码
    - 当前员工权限列表
    - 会话数量、最后活跃时间
    ↓
操作：
    - 修改权限 → 弹窗选择可用员工 → 提交
    - 禁用/启用用户
    - 删除用户（二次确认）
```

#### 3.3.3 验收标准

- [ ] 用户列表支持分页、搜索（按用户名）
- [ ] 用户详情显示注册授权码和当前权限
- [ ] 可在线修改用户员工权限
- [ ] 禁用后用户无法登录（token 失效）
- [ ] 删除用户需二次确认
- [ ] 删除用户时级联删除：会话、消息、权限、授权码使用记录

---

### 3.4 模块四：管理员登录与后台前端

#### 3.4.1 管理员账号初始化

**数据库迁移：预置超级管理员**

```sql
-- 在 migrations 中添加
INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at)
VALUES (
    'admin-preset-001',
    '13459730010',
    '$2b$12$<bcrypt_hash_of_123456>',  -- bcrypt 哈希后的密码
    'admin',
    datetime('now'),
    datetime('now')
);
```

#### 3.4.2 后台前端部署

**技术方案：Vue 3 SPA，部署在 `/admin/` 路径**

```
/root/hermes-chat/admin/          # 后台前端源码
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    ├── src/
    │   ├── App.vue
    │   ├── main.ts
    │   ├── router/
    │   │   └── index.ts
    │   ├── pages/
    │   │   ├── Login.vue          # 管理员登录页
    │   │   ├── Dashboard.vue      # 仪表盘（概览）
    │   │   ├── InvitationCodes.vue # 授权码管理
    │   │   └── Users.vue          # 用户管理
    │   ├── components/
    │   │   ├── AdminLayout.vue    # 后台布局（侧边栏+内容区）
    │   │   ├── DataTable.vue      # 通用表格组件
    │   │   └── FormModal.vue      # 弹窗表单组件
    │   ├── api/
    │   │   └── admin.ts           # 后台API封装（Axios）
    │   └── stores/
    │       └── auth.ts            # 管理员认证状态（Pinia）
    └── tsconfig.json
```

**路由规划**

| 路径 | 页面 | 说明 |
|------|------|------|
| `/admin/` | 登录页 | 未登录时重定向到此 |
| `/admin/dashboard` | 仪表盘 | 用户数、授权码统计、今日注册 |
| `/admin/invitation-codes` | 授权码管理 | 列表、生成、禁用、删除 |
| `/admin/users` | 用户管理 | 列表、详情、权限编辑、禁用/删除 |

**Nginx 配置**

```nginx
# /admin/ 指向后台前端
location /admin/ {
    alias /var/www/hermes-chat-admin/;
    try_files $uri $uri/ /admin/index.html;
}

# /api/admin/ 指向后端（已有配置）
location /api/admin/ {
    proxy_pass http://127.0.0.1:3000;
}
```

#### 3.4.3 验收标准

- [ ] 管理员账号 `13459730010` 可正常登录
- [ ] 登录后显示后台管理界面（侧边栏导航 + 内容区）
- [ ] `/admin/` 路径独立部署，不影响主站
- [ ] JWT 认证复用现有系统，管理员 token 包含 `role: "admin"`
- [ ] 非管理员访问后台页面重定向到登录页
- [ ] 登录状态过期后自动跳转登录页

---

## 四、仪表盘概览（Dashboard）

管理员登录后首页展示（**每 10 秒自动轮询刷新**）：

| 指标 | 说明 |
|------|------|
| 总用户数 | 系统中的注册用户总数 |
| 今日新增 | 今日新注册用户数 |
| 有效授权码 | 状态为 active 的授权码数量 |
| 已用授权码 | 状态为 used 的授权码数量 |
| 活跃会话 | 最近24小时有消息的会话数 |

---

## 五、技术要点

### 5.1 认证复用

- 后台登录走现有 `POST /api/auth/login`
- 管理员 role='admin'，JWT Claims 中体现
- 后台 API 全部使用 `AdminUser` 提取器验证

### 5.2 授权码生成算法

```rust
fn generate_code() -> String {
    // 格式: HC-XXXX-XXXX
    // 字符集: 大写字母 + 数字（排除易混淆字符 O/0/I/1/L）
    let chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let part1: String = (0..4).map(|_| chars[random_index(chars.len())]).collect();
    let part2: String = (0..4).map(|_| chars[random_index(chars.len())]).collect();
    format!("HC-{}-{}", part1, part2)
}
```

### 5.3 权限继承逻辑

注册时：
1. 验证授权码有效
2. 创建用户
3. 遍历 `invitation_codes.allowed_employees`
4. 为每个员工插入 `permissions` 记录（allowed=1）
5. 更新授权码状态

### 5.4 数据库迁移

新增迁移文件：
- `migrations/003_invitation_codes.sql` — 创建 invitation_codes 表
- `migrations/004_audit_logs.sql` — 创建 audit_logs 表（管理员操作审计）
- `migrations/005_preset_admin.sql` — 预置管理员账号
- 修改 `users` 表增加 `enabled` 字段（默认 true）

#### 5.6 审计日志数据模型

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL,         -- 操作者 user_id
    action TEXT NOT NULL,              -- 操作类型：create_code / disable_code / delete_code / modify_permission / disable_user / delete_user
    target_type TEXT NOT NULL,         -- 目标类型：invitation_code / user
    target_id TEXT,                    -- 目标 ID
    detail TEXT,                       -- 操作详情（JSON）
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_logs_operator ON audit_logs(operator_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

**审计日志记录的操作：**
- 生成/禁用/删除授权码
- 修改用户权限
- 禁用/启用/删除用户

### 5.5 前端技术栈（已确认）

> 用户确认采用 Vue 方案，React 方案作废。

| 项目 | 选型 |
|------|------|
| 框架 | Vue 3 (Composition API) |
| 构建工具 | Vite |
| 路由 | Vue Router 4 |
| 状态管理 | Pinia |
| HTTP 请求 | Axios |
| UI 组件库 | Element Plus |

---

## 六、非功能性需求

| 项目 | 要求 |
|------|------|
| 安全性 | 授权码不可枚举，使用后不可逆推 |
| 性能 | 授权码验证 < 50ms |
| 日志 | 管理员操作全部记录审计日志 |
| 兼容性 | 后台页面支持 Chrome/Firefox/Safari 最新版 |

---

## 七、用户确认记录（2026-06-15）

> 以下事项已与用户确认，结果如下：

| # | 待确认项 | 确认结果 |
|---|---------|---------|
| 1 | 授权码默认有效期 | **永久有效**（`expires_at` 默认 null，管理员可手动设置过期时间） |
| 2 | 批量生成上限 | **单次上限 100 个**（`count` 字段最大值 = 100） |
| 3 | 普通用户查看权限 | **不可查看**。普通用户无法查看自己的授权码和权限，仅管理员可见 |
| 4 | 审计日志存储 | **存数据库**。新增 `audit_logs` 表，记录所有管理员操作 |
| 5 | 仪表盘数据刷新 | **实时刷新**。采用轮询方案（每 10 秒刷新一次），后续可升级 WebSocket |

### 额外需求

| # | 需求 | 说明 |
|---|------|------|
| E1 | **权限过滤员工列表** | 管理员为用户分配员工时，员工列表根据该用户已有权限过滤，只显示其对应员工 |
| E2 | **后台前端使用 Vue** | 后台管理前端采用 Vue 3 + Vite 框架搭建（原建议 React 方案作废） |

#### E1 补充说明：权限过滤逻辑

```
管理员进入「用户详情」→ 修改权限
    ↓
后端 GET /api/admin/users/:id/permissions/available-employees
    ↓
返回：全量员工列表，每个员工标注该用户是否已有权限
    ↓
前端显示：checkbox 列表，已勾选的为该用户当前权限
    ↓
管理员修改 → PUT /api/admin/users/:id/permissions 提交完整替换
```

#### E2 补充说明：技术栈更新

**后台前端技术栈确定为：**

| 项目 | 选型 |
|------|------|
| 框架 | Vue 3 (Composition API) |
| 构建工具 | Vite |
| 路由 | Vue Router 4 |
| 状态管理 | Pinia |
| HTTP 请求 | Axios |
| UI 组件库 | Element Plus |

**目录结构调整：**

```
/root/hermes-chat/admin/
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    ├── src/
    │   ├── App.vue
    │   ├── main.ts
    │   ├── router/
    │   │   └── index.ts
    │   ├── pages/
    │   │   ├── Login.vue          # 管理员登录页
    │   │   ├── Dashboard.vue      # 仪表盘（概览）
    │   │   ├── InvitationCodes.vue # 授权码管理
    │   │   └── Users.vue          # 用户管理
    │   ├── components/
    │   │   ├── AdminLayout.vue    # 后台布局（侧边栏+内容区）
    │   │   ├── DataTable.vue      # 通用表格组件
    │   │   └── FormModal.vue      # 弹窗表单组件
    │   ├── api/
    │   │   └── admin.ts           # 后台API封装（Axios）
    │   └── stores/
    │       └── auth.ts            # 管理员认证状态（Pinia）
    └── tsconfig.json
```

---

## 八、开发优先级建议

| 优先级 | 模块 | 理由 |
|--------|------|------|
| P0 | 数据库迁移 + 授权码表 | 基础设施 |
| P0 | 授权码生成/验证 API | 核心功能 |
| P0 | 注册流程改造 | 核心功能 |
| P1 | 管理员账号初始化 | 后台入口 |
| P1 | 后台前端框架搭建 | UI 载体 |
| P2 | 用户管理 API + 页面 | 管理功能 |
| P2 | 仪表盘统计 | 增强体验 |

---

## 九、验收清单总览

### 授权码管理
- [ ] 授权码格式 HC-XXXX-XXXX
- [ ] 生成时指定可用员工
- [ ] 一人一码，用后失效
- [ ] 支持禁用/删除
- [ ] 支持分页查询

### 注册流程
- [ ] 注册必须填写授权码
- [ ] 授权码验证失败拒绝注册
- [ ] 注册成功自动继承权限

### 用户管理
- [ ] 用户列表（分页+搜索）
- [ ] 用户详情（权限+活跃信息）
- [ ] 在线修改权限（员工列表根据用户权限过滤）
- [ ] 禁用/启用/删除用户

### 后台前端
- [ ] 独立部署 /admin/（Vue 3 + Vite SPA）
- [ ] 管理员登录
- [ ] 侧边栏导航
- [ ] 响应式布局
- [ ] 仪表盘每 10 秒自动轮询刷新

### 技术
- [ ] JWT 认证复用
- [ ] AdminUser 提取器
- [ ] 数据库迁移脚本
- [ ] 审计日志记录

---

**文档状态：待开发（v1.1 用户确认版）**
**下一步：分配 404 开发 → 裁判君审查 → 铁壳部署 → Ditto 测试**
