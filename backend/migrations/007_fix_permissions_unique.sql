-- 007_fix_permissions_unique.sql
-- KAN-207: 修复 permissions 表 UNIQUE 约束，支持多 tenant 隔离
-- 旧约束 UNIQUE(user_id, employee) 阻止同一用户在不同 tenant 下对同一员工有不同权限
-- 新约束 UNIQUE(user_id, employee, tenant) 允许跨 tenant 差异化权限

-- SQLite 不支持 ALTER TABLE DROP CONSTRAINT，需要重建表

-- 1. 创建新表（正确约束）
CREATE TABLE IF NOT EXISTS permissions_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    employee TEXT NOT NULL,
    tenant TEXT NOT NULL DEFAULT 'default',
    allowed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, employee, tenant),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 2. 复制数据
INSERT INTO permissions_new (id, user_id, employee, tenant, allowed, created_at)
SELECT id, user_id, employee, COALESCE(tenant, 'default'), allowed, created_at
FROM permissions;

-- 3. 删除旧表
DROP TABLE permissions;

-- 4. 重命名新表
ALTER TABLE permissions_new RENAME TO permissions;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_tenant ON permissions(tenant);
CREATE INDEX IF NOT EXISTS idx_permissions_user_tenant ON permissions(user_id, tenant);
