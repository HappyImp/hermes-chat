//! 权限管理模块集成测试
//! 覆盖：授权码CRUD、用户管理、权限修改、审计日志

use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

use hermes_chat_backend::db::pool::run_migrations;
use hermes_chat_backend::services::admin::AdminService;
use hermes_chat_backend::services::auth::AuthService;
use hermes_chat_backend::models::invitation_code::CreateInvitationCode;
use hermes_chat_backend::models::user::CreateUser;

/// 创建测试用内存数据库（每个测试独立）
async fn setup_db() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect("sqlite::memory:")
        .await
        .expect("创建测试数据库失败");

    run_migrations(&pool).await.expect("迁移失败");
    pool
}

/// 创建管理员用户（用于操作）
async fn create_admin(pool: &SqlitePool) -> String {
    let id = "admin-test-001".to_string();
    let password_hash = bcrypt::hash("admin123", bcrypt::DEFAULT_COST).unwrap();
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT OR REPLACE INTO users (id, username, password_hash, role, enabled, created_at, updated_at)
         VALUES (?, 'admin', ?, 'admin', 1, ?, ?)"
    )
    .bind(&id)
    .bind(&password_hash)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .expect("创建管理员失败");
    id
}

/// 创建普通用户
async fn create_user(pool: &SqlitePool, username: &str) -> String {
    let id = uuid::Uuid::new_v4().to_string();
    let password_hash = bcrypt::hash("pass123", bcrypt::DEFAULT_COST).unwrap();
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, enabled, created_at, updated_at)
         VALUES (?, ?, ?, 'user', 1, ?, ?)"
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

/// 创建授权码（返回 code 字符串）
async fn create_code(pool: &SqlitePool, admin_id: &str, employees: Vec<&str>) -> String {
    let svc = AdminService::new();
    let input = CreateInvitationCode {
        allowed_employees: employees.into_iter().map(String::from).collect(),
        count: 1,
        expires_in_hours: Some(24),
        note: Some("测试码".to_string()),
    };
    let codes = svc.create_invitation_codes(pool, admin_id, input).await.unwrap();
    codes[0].code.clone()
}

// ==================== 授权码 CRUD 测试 ====================

#[tokio::test]
async fn test_create_invitation_code() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let code = create_code(&pool, &admin_id, vec!["老财", "铁壳"]).await;

    // 验证码格式
    assert!(code.starts_with("HC-"), "授权码应以 HC- 开头");
    assert_eq!(code.len(), 12, "授权码长度应为 12 (HC-XXXX-XXXX)");

    // 验证数据库记录
    let row: (String, String, String) = sqlx::query_as(
        "SELECT code, status, allowed_employees FROM invitation_codes WHERE code = ?"
    )
    .bind(&code)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(row.0, code);
    assert_eq!(row.1, "active");
    let employees: Vec<String> = serde_json::from_str(&row.2).unwrap();
    assert_eq!(employees, vec!["老财", "铁壳"]);
}

#[tokio::test]
async fn test_create_code_empty_employees_rejected() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let svc = AdminService::new();

    let input = CreateInvitationCode {
        allowed_employees: vec![],
        count: 1,
        expires_in_hours: None,
        note: None,
    };

    let result = svc.create_invitation_codes(&pool, &admin_id, input).await;
    assert!(result.is_err(), "空员工列表应被拒绝");
}

#[tokio::test]
async fn test_list_invitation_codes() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;

    // 创建 3 个码
    for _ in 0..3 {
        create_code(&pool, &admin_id, vec!["老财"]).await;
    }

    let svc = AdminService::new();
    let result = svc.list_invitation_codes(&pool, "all", 1, 10).await.unwrap();
    let total = result["total"].as_i64().unwrap();
    assert_eq!(total, 3);
    let codes = result["codes"].as_array().unwrap();
    assert_eq!(codes.len(), 3);
}

#[tokio::test]
async fn test_disable_invitation_code() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let code = create_code(&pool, &admin_id, vec!["老财"]).await;

    // 获取 code id
    let code_id: String = sqlx::query_scalar("SELECT id FROM invitation_codes WHERE code = ?")
        .bind(&code)
        .fetch_one(&pool)
        .await
        .unwrap();

    let svc = AdminService::new();
    svc.disable_invitation_code(&pool, &admin_id, &code_id).await.unwrap();

    // 验证状态
    let status: String = sqlx::query_scalar("SELECT status FROM invitation_codes WHERE id = ?")
        .bind(&code_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, "disabled");
}

#[tokio::test]
async fn test_delete_invitation_code() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let code = create_code(&pool, &admin_id, vec!["铁壳"]).await;

    let code_id: String = sqlx::query_scalar("SELECT id FROM invitation_codes WHERE code = ?")
        .bind(&code)
        .fetch_one(&pool)
        .await
        .unwrap();

    let svc = AdminService::new();
    svc.delete_invitation_code(&pool, &admin_id, &code_id).await.unwrap();

    // 验证删除
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM invitation_codes WHERE id = ?")
        .bind(&code_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
}

// ==================== 用户管理测试 ====================

#[tokio::test]
async fn test_register_user_with_invitation_code() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let code = create_code(&pool, &admin_id, vec!["老财", "小K"]).await;

    let auth_svc = AuthService::new("test-secret".to_string(), 24);
    let input = CreateUser {
        username: "newuser".to_string(),
        password: "password123".to_string(),
        invitation_code: code,
    };

    let (user, token) = auth_svc.register(&pool, input).await.unwrap();

    assert_eq!(user.username, "newuser");
    assert_eq!(user.role, "user");
    assert!(!token.is_empty());

    // 验证权限继承
    let perms: Vec<String> = sqlx::query_scalar(
        "SELECT employee FROM permissions WHERE user_id = ? AND allowed = 1"
    )
    .bind(&user.id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(perms.len(), 2);
    assert!(perms.contains(&"老财".to_string()));
    assert!(perms.contains(&"小K".to_string()));
}

#[tokio::test]
async fn test_register_with_invalid_code_rejected() {
    let pool = setup_db().await;
    let auth_svc = AuthService::new("test-secret".to_string(), 24);

    let input = CreateUser {
        username: "user2".to_string(),
        password: "password123".to_string(),
        invitation_code: "INVALID-CODE".to_string(),
    };

    let result = auth_svc.register(&pool, input).await;
    assert!(result.is_err(), "无效授权码应被拒绝");
}

#[tokio::test]
async fn test_register_duplicate_username_rejected() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let auth_svc = AuthService::new("test-secret".to_string(), 24);

    // 第一次注册
    let code1 = create_code(&pool, &admin_id, vec!["老财"]).await;
    let input1 = CreateUser {
        username: "dupeuser".to_string(),
        password: "password123".to_string(),
        invitation_code: code1,
    };
    auth_svc.register(&pool, input1).await.unwrap();

    // 第二次注册同名用户
    let code2 = create_code(&pool, &admin_id, vec!["老财"]).await;
    let input2 = CreateUser {
        username: "dupeuser".to_string(),
        password: "password456".to_string(),
        invitation_code: code2,
    };
    let result = auth_svc.register(&pool, input2).await;
    assert!(result.is_err(), "重复用户名应被拒绝");
}

#[tokio::test]
async fn test_register_used_code_rejected() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    // max_uses=1 的码，用一次就废
    let code = create_code(&pool, &admin_id, vec!["老财"]).await;

    let auth_svc = AuthService::new("test-secret".to_string(), 24);

    // 第一次用
    let input1 = CreateUser {
        username: "user_a".to_string(),
        password: "password123".to_string(),
        invitation_code: code.clone(),
    };
    auth_svc.register(&pool, input1).await.unwrap();

    // 第二次用同一个码
    let input2 = CreateUser {
        username: "user_b".to_string(),
        password: "password123".to_string(),
        invitation_code: code,
    };
    let result = auth_svc.register(&pool, input2).await;
    assert!(result.is_err(), "已使用的授权码应被拒绝");
}

#[tokio::test]
async fn test_list_users_with_join() {
    let pool = setup_db().await;
    let _admin_id = create_admin(&pool).await;

    // 创建几个用户
    create_user(&pool, "alice").await;
    create_user(&pool, "bob").await;

    let svc = AdminService::new();
    let result = svc.list_users(&pool, "", 1, 10).await.unwrap();

    // admin + alice + bob = 3（预置管理员也算）
    let total = result["total"].as_i64().unwrap();
    assert!(total >= 3, "至少应有 3 个用户，实际 {}", total);

    let users = result["users"].as_array().unwrap();
    assert!(users.len() >= 3);

    // 验证字段完整性
    for u in users {
        assert!(u["id"].is_string());
        assert!(u["username"].is_string());
        assert!(u["role"].is_string());
        assert!(u["enabled"].is_boolean());
        assert!(u["created_at"].is_string());
        assert!(u["allowed_employees"].is_array());
    }
}

#[tokio::test]
async fn test_list_users_search() {
    let pool = setup_db().await;
    create_user(&pool, "search_target").await;
    create_user(&pool, "other_user").await;

    let svc = AdminService::new();
    let result = svc.list_users(&pool, "search_target", 1, 10).await.unwrap();

    let users = result["users"].as_array().unwrap();
    assert_eq!(users.len(), 1);
    assert_eq!(users[0]["username"].as_str().unwrap(), "search_target");
}

// ==================== 权限修改测试 ====================

#[tokio::test]
async fn test_update_user_permissions() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let user_id = create_user(&pool, "perm_user").await;

    let svc = AdminService::new();

    // 设置权限
    svc.update_user_permissions(
        &pool, &admin_id, &user_id, vec!["老财".to_string(), "404".to_string()]
    ).await.unwrap();

    let perms: Vec<String> = sqlx::query_scalar(
        "SELECT employee FROM permissions WHERE user_id = ? AND allowed = 1"
    )
    .bind(&user_id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(perms.len(), 2);

    // 修改权限（替换为新列表）
    svc.update_user_permissions(
        &pool, &admin_id, &user_id, vec!["铁壳".to_string()]
    ).await.unwrap();

    let perms2: Vec<String> = sqlx::query_scalar(
        "SELECT employee FROM permissions WHERE user_id = ? AND allowed = 1"
    )
    .bind(&user_id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(perms2.len(), 1);
    assert_eq!(perms2[0], "铁壳");
}

#[tokio::test]
async fn test_toggle_user_status() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let user_id = create_user(&pool, "toggle_user").await;

    let svc = AdminService::new();

    // 禁用
    svc.toggle_user_status(&pool, &admin_id, &user_id, false).await.unwrap();
    let enabled: i32 = sqlx::query_scalar("SELECT enabled FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(enabled, 0);

    // 重新启用
    svc.toggle_user_status(&pool, &admin_id, &user_id, true).await.unwrap();
    let enabled: i32 = sqlx::query_scalar("SELECT enabled FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(enabled, 1);
}

#[tokio::test]
async fn test_delete_user_cascade() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let user_id = create_user(&pool, "delete_me").await;

    // 给用户加权限
    let svc = AdminService::new();
    svc.update_user_permissions(
        &pool, &admin_id, &user_id, vec!["老财".to_string()]
    ).await.unwrap();

    // 删除用户
    svc.delete_user(&pool, &admin_id, &user_id).await.unwrap();

    // 验证用户已删
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(user_count, 0);

    // 验证权限已删
    let perm_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM permissions WHERE user_id = ?")
        .bind(&user_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(perm_count, 0);
}

#[tokio::test]
async fn test_delete_nonexistent_user_rejected() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;

    let svc = AdminService::new();
    let result = svc.delete_user(&pool, &admin_id, "nonexistent-id").await;
    assert!(result.is_err(), "删除不存在的用户应报错");
}

// ==================== 审计日志测试 ====================

#[tokio::test]
async fn test_audit_log_created_on_operations() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let user_id = create_user(&pool, "audit_user").await;

    let svc = AdminService::new();

    // 创建授权码
    create_code(&pool, &admin_id, vec!["老财"]).await;

    // 修改权限
    svc.update_user_permissions(
        &pool, &admin_id, &user_id, vec!["铁壳".to_string()]
    ).await.unwrap();

    // 禁用用户
    svc.toggle_user_status(&pool, &admin_id, &user_id, false).await.unwrap();

    // 验证审计日志
    let logs: Vec<(String, String)> = sqlx::query_as(
        "SELECT action, target_type FROM audit_logs WHERE operator_id = ? ORDER BY created_at"
    )
    .bind(&admin_id)
    .fetch_all(&pool)
    .await
    .unwrap();

    assert!(logs.len() >= 3, "至少应有 3 条审计日志，实际 {}", logs.len());

    let actions: Vec<&str> = logs.iter().map(|(a, _)| a.as_str()).collect();
    assert!(actions.contains(&"create_code"), "应有 create_code 日志");
    assert!(actions.contains(&"modify_permission"), "应有 modify_permission 日志");
    assert!(actions.contains(&"disable_user"), "应有 disable_user 日志");
}

#[tokio::test]
async fn test_audit_log_on_delete_user() {
    let pool = setup_db().await;
    let admin_id = create_admin(&pool).await;
    let user_id = create_user(&pool, "will_delete").await;

    let svc = AdminService::new();
    svc.delete_user(&pool, &admin_id, &user_id).await.unwrap();

    // 审计日志应在用户删除后依然存在（operator 是 admin）
    let action: String = sqlx::query_scalar(
        "SELECT action FROM audit_logs WHERE target_id = ? AND action = 'delete_user'"
    )
    .bind(&user_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(action, "delete_user");
}

// ==================== 认证服务测试 ====================

#[tokio::test]
async fn test_login_success() {
    let pool = setup_db().await;
    // 预置管理员已通过 migration 创建
    let auth_svc = AuthService::new("test-secret".to_string(), 24);

    let input = hermes_chat_backend::models::user::LoginUser {
        username: "13459730010".to_string(),
        password: "123456".to_string(),
    };

    let token = auth_svc.login(&pool, input).await.unwrap();
    assert!(!token.is_empty());
}

#[tokio::test]
async fn test_login_wrong_password() {
    let pool = setup_db().await;
    let auth_svc = AuthService::new("test-secret".to_string(), 24);

    let input = hermes_chat_backend::models::user::LoginUser {
        username: "13459730010".to_string(),
        password: "wrong_password".to_string(),
    };

    let result = auth_svc.login(&pool, input).await;
    assert!(result.is_err(), "错误密码应被拒绝");
}

#[tokio::test]
async fn test_token_blacklist() {
    let pool = setup_db().await;
    let auth_svc = AuthService::new("test-secret".to_string(), 24);

    let token = auth_svc.generate_token("user-123", "user").unwrap();

    // 未拉黑
    assert!(!auth_svc.is_token_blacklisted(&pool, &token).await.unwrap());

    // 拉黑
    let exp = chrono::Utc::now().timestamp() as usize + 3600;
    auth_svc.logout(&pool, &token, "user-123", exp).await.unwrap();

    // 已拉黑
    assert!(auth_svc.is_token_blacklisted(&pool, &token).await.unwrap());
}
