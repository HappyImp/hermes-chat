//! Kanban 模块集成测试
//! 覆盖：tenant 隔离、service 层方法、handler 鉴权

use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

use hermes_chat_backend::db::pool::run_migrations;
use hermes_chat_backend::models::kanban::EmployeeInfo;
use hermes_chat_backend::services::kanban::KanbanService;

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

/// 创建测试用户（返回 user_id）
async fn create_test_user(pool: &SqlitePool, username: &str) -> String {
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

/// 给用户分配 tenant
async fn assign_tenant(pool: &SqlitePool, user_id: &str, tenant_id: &str) {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO user_tenants (id, user_id, tenant_id) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(user_id)
        .bind(tenant_id)
        .execute(pool)
        .await
        .expect("分配 tenant 失败");
}

// ==================== get_tenant_for_user 测试 ====================

#[tokio::test]
async fn test_get_tenant_for_user_with_mapping() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "tenant_user").await;
    assign_tenant(&pool, &user_id, "my-board").await;

    let tenant = KanbanService::get_tenant_for_user(&pool, &user_id)
        .await
        .unwrap();

    assert_eq!(tenant, "my-board", "应返回用户的 tenant_id");
}

#[tokio::test]
async fn test_get_tenant_for_user_no_mapping_returns_default() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "no_tenant_user").await;

    // 不分配 tenant，应返回 "default"
    let tenant = KanbanService::get_tenant_for_user(&pool, &user_id)
        .await
        .unwrap();

    assert_eq!(tenant, "default", "无映射时应返回 default");
}

#[tokio::test]
async fn test_get_tenant_for_user_multiple_tenants_returns_first() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "multi_tenant_user").await;
    assign_tenant(&pool, &user_id, "board-a").await;
    assign_tenant(&pool, &user_id, "board-b").await;

    // 应返回其中一个（LIMIT 1），不确定顺序但不报错
    let tenant = KanbanService::get_tenant_for_user(&pool, &user_id)
        .await
        .unwrap();

    assert!(
        tenant == "board-a" || tenant == "board-b",
        "多 tenant 时应返回其中之一，实际: {}",
        tenant
    );
}

// ==================== service 层 stub 方法测试 ====================

#[tokio::test]
async fn test_list_tasks_stub_returns_empty() {
    let svc = KanbanService::new();
    let tasks = svc.list_tasks("any-tenant").await.unwrap();
    assert!(tasks.is_empty(), "stub 应返回空列表");
}

#[tokio::test]
async fn test_get_task_stub_returns_not_found() {
    let svc = KanbanService::new();
    let result = svc.get_task("any-task-id", "any-tenant").await;
    assert!(result.is_err(), "stub 应返回 NotFound 错误");

    // 验证是 NotFound 类型
    match result.unwrap_err() {
        hermes_chat_backend::errors::AppError::NotFound(_) => {} // 期望
        other => panic!("期望 NotFound，实际: {:?}", other),
    }
}

#[tokio::test]
async fn test_get_stats_stub_returns_zero_stats() {
    let svc = KanbanService::new();
    let stats = svc.get_stats("any-tenant").await.unwrap();
    assert_eq!(stats.total, 0, "stub total 应为 0");
    assert_eq!(stats.todo, 0, "stub todo 应为 0");
    assert_eq!(stats.doing, 0, "stub doing 应为 0");
    assert_eq!(stats.done, 0, "stub done 应为 0");
}

#[tokio::test]
async fn test_get_employees_returns_profiles() {
    let pool = setup_db().await;
    let svc = KanbanService::new();
    // filter_by_tenant 需要 permissions 表有数据，无权限时返回空列表
    let employees = svc.get_employees(&pool, "any-tenant").await.unwrap();
    // 无 permissions 记录，严格隔离应返回空
    assert!(employees.is_empty(), "无 permissions 记录时应返回空列表");
}

// ==================== Default / new 测试 ====================

#[test]
fn test_kanban_service_default() {
    let svc = KanbanService::default();
    // 验证 Default 实现正常工作（空结构体，只要不 panic 即可）
    let _: KanbanService = svc;
}

#[test]
fn test_kanban_service_new() {
    let svc = KanbanService::new();
    let _: KanbanService = svc;
}

#[test]
fn test_kanban_service_clone() {
    let svc = KanbanService::new();
    let svc2 = svc.clone();
    let _: KanbanService = svc2;
}

// ==================== tenant 隔离语义测试 ====================

#[tokio::test]
async fn test_tenant_isolation_different_users_different_tenants() {
    let pool = setup_db().await;
    let user_a = create_test_user(&pool, "alice").await;
    let user_b = create_test_user(&pool, "bob").await;

    assign_tenant(&pool, &user_a, "tenant-alice").await;
    assign_tenant(&pool, &user_b, "tenant-bob").await;

    let tenant_a = KanbanService::get_tenant_for_user(&pool, &user_a)
        .await
        .unwrap();
    let tenant_b = KanbanService::get_tenant_for_user(&pool, &user_b)
        .await
        .unwrap();

    assert_ne!(tenant_a, tenant_b, "不同用户的 tenant 应该不同");
    assert_eq!(tenant_a, "tenant-alice");
    assert_eq!(tenant_b, "tenant-bob");
}

#[tokio::test]
async fn test_tenant_isolation_same_tenant_shared() {
    let pool = setup_db().await;
    let user_a = create_test_user(&pool, "team_a").await;
    let user_b = create_test_user(&pool, "team_b").await;

    // 两人属于同一 tenant
    assign_tenant(&pool, &user_a, "shared-board").await;
    assign_tenant(&pool, &user_b, "shared-board").await;

    let tenant_a = KanbanService::get_tenant_for_user(&pool, &user_a)
        .await
        .unwrap();
    let tenant_b = KanbanService::get_tenant_for_user(&pool, &user_b)
        .await
        .unwrap();

    assert_eq!(tenant_a, tenant_b, "同 tenant 的用户应返回相同 tenant_id");
    assert_eq!(tenant_a, "shared-board");
}

// ==================== KAN-207: get_user_tenants / check_tenant_access ====================

#[tokio::test]
async fn test_get_user_tenants_returns_mapped_tenants() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "tenant_list_user").await;
    assign_tenant(&pool, &user_id, "board-x").await;
    assign_tenant(&pool, &user_id, "board-y").await;

    let tenants = KanbanService::get_user_tenants(&pool, &user_id)
        .await
        .unwrap();

    assert_eq!(tenants.len(), 2, "应返回 2 个 tenant");
    let ids: Vec<&str> = tenants.iter().map(|t| t.tenant_id.as_str()).collect();
    assert!(ids.contains(&"board-x"), "应包含 board-x");
    assert!(ids.contains(&"board-y"), "应包含 board-y");
}

#[tokio::test]
async fn test_get_user_tenants_empty_for_no_mapping() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "no_tenants_user").await;

    let tenants = KanbanService::get_user_tenants(&pool, &user_id)
        .await
        .unwrap();

    assert!(tenants.is_empty(), "无映射应返回空列表");
}

#[tokio::test]
async fn test_check_tenant_access_allowed() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "access_user").await;
    assign_tenant(&pool, &user_id, "my-board").await;

    let has_access = KanbanService::check_tenant_access(&pool, &user_id, "my-board")
        .await
        .unwrap();

    assert!(has_access, "已映射的 tenant 应有访问权限");
}

#[tokio::test]
async fn test_check_tenant_access_denied() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "denied_user").await;

    let has_access = KanbanService::check_tenant_access(&pool, &user_id, "no-such-board")
        .await
        .unwrap();

    assert!(!has_access, "未映射的 tenant 应无访问权限");
}

// ==================== filter_by_tenant 测试 ====================

/// 辅助函数：给 tenant 添加员工权限
async fn grant_employee_permission(pool: &SqlitePool, user_id: &str, employee: &str, tenant: &str) {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO permissions (id, user_id, employee, allowed, tenant) VALUES (?, ?, ?, 1, ?)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(employee)
    .bind(tenant)
    .execute(pool)
    .await
    .expect("授予权限失败");
}

#[tokio::test]
async fn test_filter_by_tenant_returns_only_allowed_employees() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "filter_user").await;

    // 授权 tenant-a 只能看到 alice 和 bob
    grant_employee_permission(&pool, &user_id, "alice", "tenant-a").await;
    grant_employee_permission(&pool, &user_id, "bob", "tenant-a").await;

    let employees = vec![
        EmployeeInfo {
            name: "alice".to_string(),
            role: "工程师".to_string(),
            status: "working".to_string(),
        },
        EmployeeInfo {
            name: "bob".to_string(),
            role: "设计师".to_string(),
            status: "standby".to_string(),
        },
        EmployeeInfo {
            name: "charlie".to_string(),
            role: "测试".to_string(),
            status: "working".to_string(),
        },
    ];

    let filtered = KanbanService::filter_by_tenant(&pool, &employees, "tenant-a").await;

    assert_eq!(filtered.len(), 2, "应只返回 alice 和 bob");
    assert!(filtered.iter().any(|e| e.name == "alice"));
    assert!(filtered.iter().any(|e| e.name == "bob"));
    assert!(!filtered.iter().any(|e| e.name == "charlie"));
}

#[tokio::test]
async fn test_filter_by_tenant_no_permissions_returns_empty() {
    let pool = setup_db().await;

    let employees = vec![EmployeeInfo {
        name: "alice".to_string(),
        role: "工程师".to_string(),
        status: "working".to_string(),
    }];

    let filtered = KanbanService::filter_by_tenant(&pool, &employees, "unknown-tenant").await;

    assert!(filtered.is_empty(), "无 permissions 记录应返回空列表");
}

#[tokio::test]
async fn test_filter_by_tenant_different_tenants_isolated() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "isolated_user").await;

    // tenant-a 只有 alice，tenant-b 只有 bob
    grant_employee_permission(&pool, &user_id, "alice", "tenant-a").await;
    grant_employee_permission(&pool, &user_id, "bob", "tenant-b").await;

    let employees = vec![
        EmployeeInfo {
            name: "alice".to_string(),
            role: "工程师".to_string(),
            status: "working".to_string(),
        },
        EmployeeInfo {
            name: "bob".to_string(),
            role: "设计师".to_string(),
            status: "standby".to_string(),
        },
    ];

    let filtered_a = KanbanService::filter_by_tenant(&pool, &employees, "tenant-a").await;
    let filtered_b = KanbanService::filter_by_tenant(&pool, &employees, "tenant-b").await;

    assert_eq!(filtered_a.len(), 1, "tenant-a 应只有 alice");
    assert_eq!(filtered_a[0].name, "alice");
    assert_eq!(filtered_b.len(), 1, "tenant-b 应只有 bob");
    assert_eq!(filtered_b[0].name, "bob");
}

#[tokio::test]
async fn test_filter_by_tenant_denied_employee_excluded() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "deny_user").await;

    // alice 允许，bob 拒绝
    grant_employee_permission(&pool, &user_id, "alice", "tenant-x").await;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO permissions (id, user_id, employee, allowed, tenant) VALUES (?, ?, ?, 0, ?)",
    )
    .bind(&id)
    .bind(&user_id)
    .bind("bob")
    .bind("tenant-x")
    .execute(&pool)
    .await
    .expect("插入拒绝权限失败");

    let employees = vec![
        EmployeeInfo {
            name: "alice".to_string(),
            role: "工程师".to_string(),
            status: "working".to_string(),
        },
        EmployeeInfo {
            name: "bob".to_string(),
            role: "设计师".to_string(),
            status: "standby".to_string(),
        },
    ];

    let filtered = KanbanService::filter_by_tenant(&pool, &employees, "tenant-x").await;

    assert_eq!(filtered.len(), 1, "allowed=0 的员工应被排除");
    assert_eq!(filtered[0].name, "alice");
}

#[tokio::test]
async fn test_filter_by_tenant_empty_employees_returns_empty() {
    let pool = setup_db().await;
    let user_id = create_test_user(&pool, "empty_user").await;
    grant_employee_permission(&pool, &user_id, "alice", "tenant-z").await;

    let employees: Vec<EmployeeInfo> = vec![];
    let filtered = KanbanService::filter_by_tenant(&pool, &employees, "tenant-z").await;

    assert!(filtered.is_empty(), "空员工列表应返回空");
}
