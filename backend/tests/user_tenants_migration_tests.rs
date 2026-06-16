//! KAN-105: user_tenants 表迁移测试
//! 覆盖：表结构、索引、约束、数据迁移、级联删除

use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

use hermes_chat_backend::db::pool::run_migrations;

/// 创建测试用内存数据库
async fn setup_db() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect("sqlite::memory:")
        .await
        .expect("创建测试数据库失败");

    run_migrations(&pool).await.expect("迁移失败");
    pool
}

/// 创建测试用户
async fn create_user(pool: &SqlitePool, username: &str) -> String {
    let id = uuid::Uuid::new_v4().to_string();
    let password_hash = bcrypt::hash("test123", bcrypt::DEFAULT_COST).unwrap();
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, enabled, created_at, updated_at)
         VALUES (?, ?, ?, 'user', 1, ?, ?)",
    )
    .bind(&id)
    .bind(username)
    .bind(&password_hash)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .expect("创建用户失败");
    id
}

/// 创建带权限的用户（触发数据迁移逻辑）
async fn create_user_with_permission(pool: &SqlitePool, username: &str, employee: &str) -> String {
    let user_id = create_user(pool, username).await;
    let perm_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO permissions (id, user_id, employee, allowed, tenant) VALUES (?, ?, ?, 1, 'default')",
    )
    .bind(&perm_id)
    .bind(&user_id)
    .bind(employee)
    .execute(pool)
    .await
    .expect("创建权限失败");
    user_id
}

// ==================== 表结构测试 ====================

#[tokio::test]
async fn test_user_tenants_table_exists() {
    let pool = setup_db().await;
    // 如果表不存在，查询会报错
    let result: Result<Vec<(String,)>, _> =
        sqlx::query_as("SELECT id FROM user_tenants LIMIT 1")
            .fetch_all(&pool)
            .await;
    assert!(result.is_ok(), "user_tenants 表应存在");
}

#[tokio::test]
async fn test_user_tenants_table_schema() {
    let pool = setup_db().await;
    // PRAGMA table_info 返回列信息
    let columns: Vec<(i32, String, String, i32, Option<String>, i32)> =
        sqlx::query_as("PRAGMA table_info(user_tenants)")
            .fetch_all(&pool)
            .await
            .unwrap();

    let col_names: Vec<&str> = columns.iter().map(|(_, name, _, _, _, _)| name.as_str()).collect();
    assert!(col_names.contains(&"id"), "应有 id 列");
    assert!(col_names.contains(&"user_id"), "应有 user_id 列");
    assert!(col_names.contains(&"tenant_id"), "应有 tenant_id 列");
    assert!(col_names.contains(&"created_at"), "应有 created_at 列");
    assert_eq!(col_names.len(), 4, "应有 4 列");
}

#[tokio::test]
async fn test_user_tenants_indexes_exist() {
    let pool = setup_db().await;
    // 查询索引列表
    let indexes: Vec<(String,)> =
        sqlx::query_as("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='user_tenants'")
            .fetch_all(&pool)
            .await
            .unwrap();

    let index_names: Vec<&str> = indexes.iter().map(|(name,)| name.as_str()).collect();
    assert!(
        index_names.contains(&"idx_user_tenants_user_id"),
        "应有 user_id 索引"
    );
    assert!(
        index_names.contains(&"idx_user_tenants_tenant_id"),
        "应有 tenant_id 索引"
    );
}

// ==================== 约束测试 ====================

#[tokio::test]
async fn test_unique_constraint_user_tenant() {
    let pool = setup_db().await;
    let user_id = create_user(&pool, "unique_test").await;

    // 第一次插入
    let id1 = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO user_tenants (id, user_id, tenant_id) VALUES (?, ?, ?)")
        .bind(&id1)
        .bind(&user_id)
        .bind("board-a")
        .execute(&pool)
        .await
        .unwrap();

    // 第二次插入相同 (user_id, tenant_id) 应违反 UNIQUE 约束
    let id2 = uuid::Uuid::new_v4().to_string();
    let result = sqlx::query("INSERT INTO user_tenants (id, user_id, tenant_id) VALUES (?, ?, ?)")
        .bind(&id2)
        .bind(&user_id)
        .bind("board-a")
        .execute(&pool)
        .await;

    assert!(result.is_err(), "重复的 (user_id, tenant_id) 应被 UNIQUE 约束拒绝");
}

#[tokio::test]
async fn test_same_user_different_tenants_allowed() {
    let pool = setup_db().await;
    let user_id = create_user(&pool, "multi_tenant").await;

    for tenant in &["board-a", "board-b", "board-c"] {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO user_tenants (id, user_id, tenant_id) VALUES (?, ?, ?)")
            .bind(&id)
            .bind(&user_id)
            .bind(tenant)
            .execute(&pool)
            .await
            .unwrap();
    }

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM user_tenants WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count, 3, "同一用户应可拥有多个 tenant");
}

#[tokio::test]
async fn test_same_tenant_different_users_allowed() {
    let pool = setup_db().await;
    let user_a = create_user(&pool, "team_a").await;
    let user_b = create_user(&pool, "team_b").await;

    for uid in &[&user_a, &user_b] {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO user_tenants (id, user_id, tenant_id) VALUES (?, ?, ?)")
            .bind(&id)
            .bind(*uid)
            .bind("shared-board")
            .execute(&pool)
            .await
            .unwrap();
    }

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM user_tenants WHERE tenant_id = ?")
            .bind("shared-board")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count, 2, "同一 tenant 应可被多个用户共享");
}

// ==================== 级联删除测试 ====================

#[tokio::test]
async fn test_cascade_delete_on_user_removal() {
    let pool = setup_db().await;
    let user_id = create_user(&pool, "delete_me").await;

    // 分配 tenant
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO user_tenants (id, user_id, tenant_id) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&user_id)
        .bind("my-board")
        .execute(&pool)
        .await
        .unwrap();

    // 确认记录存在
    let count_before: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM user_tenants WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count_before, 1);

    // 删除用户
    sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(&user_id)
        .execute(&pool)
        .await
        .unwrap();

    // user_tenants 记录应被级联删除
    let count_after: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM user_tenants WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count_after, 0, "删除用户后 user_tenants 应被级联删除");
}

// ==================== 数据迁移测试 ====================

#[tokio::test]
async fn test_migration_creates_default_tenant_for_existing_permissions() {
    let pool = setup_db().await;

    // create_user_with_permission 会创建用户 + 权限
    // run_migrations 中的 INSERT OR IGNORE 会在建表时迁移数据
    // 但因为 run_migrations 已经执行过了，需要手动验证迁移逻辑

    // 创建一个有权限的用户（模拟迁移前状态）
    let user_id = create_user_with_permission(&pool, "migrated_user", "老财").await;

    // 手动执行迁移 SQL（模拟 run_migrations 中的逻辑）
    sqlx::query(
        "INSERT OR IGNORE INTO user_tenants (id, user_id, tenant_id)
         SELECT lower(hex(randomblob(16))), user_id, 'default'
         FROM permissions WHERE allowed = 1
         GROUP BY user_id",
    )
    .execute(&pool)
    .await
    .unwrap();

    // 验证迁移结果
    let tenants: Vec<(String,)> =
        sqlx::query_as("SELECT tenant_id FROM user_tenants WHERE user_id = ?")
            .bind(&user_id)
            .fetch_all(&pool)
            .await
            .unwrap();

    assert_eq!(tenants.len(), 1, "迁移后应有 1 条 tenant 记录");
    assert_eq!(tenants[0].0, "default", "迁移的 tenant_id 应为 'default'");
}

#[tokio::test]
async fn test_migration_idempotent_with_insert_or_ignore() {
    let pool = setup_db().await;
    let user_id = create_user_with_permission(&pool, "idempotent_user", "铁壳").await;

    // 第一次迁移
    sqlx::query(
        "INSERT OR IGNORE INTO user_tenants (id, user_id, tenant_id)
         SELECT lower(hex(randomblob(16))), user_id, 'default'
         FROM permissions WHERE allowed = 1
         GROUP BY user_id",
    )
    .execute(&pool)
    .await
    .unwrap();

    // 第二次迁移（应幂等，不报错不重复）
    sqlx::query(
        "INSERT OR IGNORE INTO user_tenants (id, user_id, tenant_id)
         SELECT lower(hex(randomblob(16))), user_id, 'default'
         FROM permissions WHERE allowed = 1
         GROUP BY user_id",
    )
    .execute(&pool)
    .await
    .unwrap();

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM user_tenants WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count, 1, "INSERT OR IGNORE 应保证幂等，不产生重复记录");
}

#[tokio::test]
async fn test_migration_skips_disabled_permissions() {
    let pool = setup_db().await;

    // 创建用户但权限设为 allowed=0
    let user_id = create_user(&pool, "disabled_perm_user").await;
    let perm_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO permissions (id, user_id, employee, allowed, tenant) VALUES (?, ?, ?, 0, 'default')",
    )
    .bind(&perm_id)
    .bind(&user_id)
    .bind("老财")
    .execute(&pool)
    .await
    .unwrap();

    // 执行迁移
    sqlx::query(
        "INSERT OR IGNORE INTO user_tenants (id, user_id, tenant_id)
         SELECT lower(hex(randomblob(16))), user_id, 'default'
         FROM permissions WHERE allowed = 1
         GROUP BY user_id",
    )
    .execute(&pool)
    .await
    .unwrap();

    // allowed=0 的用户不应被迁移
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM user_tenants WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count, 0, "allowed=0 的权限不应触发 tenant 迁移");
}

// ==================== permissions 表 tenant 列测试 ====================

#[tokio::test]
async fn test_permissions_has_tenant_column() {
    let pool = setup_db().await;

    let columns: Vec<(i32, String, String, i32, Option<String>, i32)> =
        sqlx::query_as("PRAGMA table_info(permissions)")
            .fetch_all(&pool)
            .await
            .unwrap();

    let col_names: Vec<&str> = columns.iter().map(|(_, name, _, _, _, _)| name.as_str()).collect();
    assert!(col_names.contains(&"tenant"), "permissions 表应有 tenant 列");
}

#[tokio::test]
async fn test_permissions_tenant_default_value() {
    let pool = setup_db().await;
    let user_id = create_user(&pool, "tenant_default").await;

    // 不指定 tenant 值插入（应使用默认值 'default'）
    let perm_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO permissions (id, user_id, employee, allowed) VALUES (?, ?, ?, 1)",
    )
    .bind(&perm_id)
    .bind(&user_id)
    .bind("老财")
    .execute(&pool)
    .await
    .unwrap();

    let tenant: String =
        sqlx::query_scalar("SELECT tenant FROM permissions WHERE id = ?")
            .bind(&perm_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(tenant, "default", "tenant 默认值应为 'default'");
}
