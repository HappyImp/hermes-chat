-- 006_user_tenants.sql
-- KAN-105: 建立 tenant 映射表，user_id → tenant_id 映射关系
-- 后端已有 TenantPermission 模型（models/permission.rs），此迁移创建对应数据库表

CREATE TABLE IF NOT EXISTS user_tenants (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, tenant_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants(tenant_id);

-- KAN-207: permissions 表增加 tenant 列（兼容旧数据库）
ALTER TABLE permissions ADD COLUMN tenant TEXT NOT NULL DEFAULT 'default';

-- 迁移现有权限数据到 user_tenants（为已有用户创建默认 tenant 映射）
INSERT OR IGNORE INTO user_tenants (id, user_id, tenant_id)
SELECT lower(hex(randomblob(16))), user_id, 'default'
FROM permissions
WHERE allowed = 1
GROUP BY user_id;
