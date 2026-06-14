-- 005_preset_admin.sql
-- 预置超级管理员账号（密码: 123456，bcrypt hash）
-- hash: $2b$12$LJ3mFGDwHFNDOxlJ.6YYsOzH0MdN4O4fKSTQpHdC/JfOXD5n0sRWe

INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at)
VALUES (
    'admin-preset-001',
    '13459730010',
    '$2b$12$GCsrCf3yeh/GKQ1wnTibkuf089IuZ4/t.9.sx6BCTt1dhAOcgBtja',
    'admin',
    datetime('now'),
    datetime('now')
);
