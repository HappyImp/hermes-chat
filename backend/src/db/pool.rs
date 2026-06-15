use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

pub type DbPool = SqlitePool;

pub async fn create_pool(database_url: &str, max_connections: u32) -> Result<DbPool, sqlx::Error> {
    let pool = SqlitePoolOptions::new()
        .max_connections(max_connections)
        .connect(database_url)
        .await?;

    Ok(pool)
}

pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    // 基础表
    sqlx::query(
        "
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '新会话',
            channel TEXT NOT NULL DEFAULT 'default',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            deleted_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );

        CREATE TABLE IF NOT EXISTS permissions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            employee TEXT NOT NULL,
            allowed INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(user_id, employee),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS token_blacklist (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
        CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);
        ",
    )
    .execute(pool)
    .await?;

    // 授权码表（003）
    sqlx::query(
        "
        CREATE TABLE IF NOT EXISTS invitation_codes (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            allowed_employees TEXT NOT NULL,
            max_uses INTEGER NOT NULL DEFAULT 1,
            used_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            created_by TEXT NOT NULL,
            used_by TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            expires_at TEXT,
            note TEXT,
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (used_by) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
        CREATE INDEX IF NOT EXISTS idx_invitation_codes_status ON invitation_codes(status);
        ",
    )
    .execute(pool)
    .await?;

    // 审计日志表（004）
    sqlx::query(
        "
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            operator_id TEXT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT,
            detail TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
        ",
    )
    .execute(pool)
    .await?;

    // tenant 映射表（KAN-105）
    sqlx::query(
        "
        CREATE TABLE IF NOT EXISTS user_tenants (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, tenant_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants(tenant_id);
        ",
    )
    .execute(pool)
    .await?;

    // 迁移现有权限数据到 user_tenants
    sqlx::query(
        "INSERT OR IGNORE INTO user_tenants (id, user_id, tenant_id)
         SELECT lower(hex(randomblob(16))), user_id, 'default'
         FROM permissions WHERE allowed = 1
         GROUP BY user_id",
    )
    .execute(pool)
    .await?;

    // 预置管理员（005）— 密码: 123456
    sqlx::query(
        "INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at)
         VALUES ('admin-preset-001', '13459730010', '$2b$12$GCsrCf3yeh/GKQ1wnTibkuf089IuZ4/t.9.sx6BCTt1dhAOcgBtja', 'admin', datetime('now'), datetime('now'))"
    )
    .execute(pool)
    .await?;

    // 兼容旧数据库：尝试添加 enabled 字段（已存在的表会失败，忽略）
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1")
        .execute(pool)
        .await;

    Ok(())
}
