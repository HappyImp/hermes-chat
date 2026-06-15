# KAN-207/208: 扩展权限模型 + Tenant 权限过滤中间件

## 背景
现有权限模型没有 tenant 隔离，所有权限都是全局的。
需要支持多 tenant 场景，不同 tenant 下的权限独立管理。

## KAN-207: 扩展权限模型（tenant 映射）

### 需求
1. `permissions` 表新增 `tenant` 列（TEXT NOT NULL DEFAULT 'default'）
2. 唯一约束变为 `(user_id, employee, tenant)`
3. 所有权限写入操作必须指定 tenant
4. 向后兼容：现有数据自动迁移到 `default` tenant

### 数据库变更
```sql
ALTER TABLE permissions ADD COLUMN tenant TEXT NOT NULL DEFAULT 'default';
```

## KAN-208: Tenant 权限过滤中间件

### 需求
1. 新增 `TenantScope` 提取器
2. 从请求中读取 tenant 上下文：
   - 优先：`X-Tenant-ID` header
   - 回退：`?tenant=xxx` 查询参数
   - 默认：`default`
3. 验证 tenant ID 格式（字母、数字、下划线、连字符，≤64字符）
4. 员工列表接口自动按 tenant 过滤

### 用法
```rust
// 在 handler 中使用
async fn list(
    auth: AuthUser,
    tenant: TenantScope,  // 自动提取
) -> Result<Json<Value>, AppError> {
    let tenant_id = tenant.as_str();
    // ...
}
```

## 验收标准
- [ ] permissions 表有 tenant 列
- [ ] 现有数据自动迁移到 default tenant
- [ ] TenantScope 正确提取 header/query/default
- [ ] 无效 tenant ID 返回 400
- [ ] 员工列表按 tenant 过滤
- [ ] 管理员权限更新支持指定 tenant
- [ ] 注册时默认写入 default tenant
