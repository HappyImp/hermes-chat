//! Kanban 模块集成测试
//! 覆盖：tenant 隔离、service 层方法、handler 鉴权、WebSocket 事件

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

/// 创建测试用 kanban 内存数据库（含 tasks/comments/events 表）
async fn setup_kanban_db() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect("sqlite::memory:")
        .await
        .expect("创建 kanban 测试数据库失败");

    // 创建 kanban 表结构
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT,
            status TEXT NOT NULL DEFAULT 'todo',
            assignee TEXT,
            tenant TEXT,
            priority INTEGER DEFAULT 0,
            workspace_kind TEXT,
            workspace_path TEXT,
            created_by TEXT,
            created_at INTEGER NOT NULL,
            started_at INTEGER,
            completed_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            payload TEXT,
            created_at INTEGER NOT NULL,
            run_id INTEGER
        );

        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            profile TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'running',
            outcome TEXT,
            summary TEXT,
            error TEXT,
            metadata TEXT,
            started_at INTEGER NOT NULL,
            ended_at INTEGER
        );",
    )
    .execute(&pool)
    .await
    .expect("创建 kanban 表失败");

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

/// 插入测试任务到 kanban DB
async fn insert_kanban_task(
    pool: &SqlitePool,
    id: &str,
    title: &str,
    status: &str,
    tenant: Option<&str>,
    assignee: Option<&str>,
) {
    sqlx::query(
        "INSERT INTO tasks (id, title, status, tenant, assignee, created_at) VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))",
    )
    .bind(id)
    .bind(title)
    .bind(status)
    .bind(tenant)
    .bind(assignee)
    .execute(pool)
    .await
    .expect("插入测试任务失败");
}

/// 插入测试事件到 kanban DB
async fn insert_kanban_event(pool: &SqlitePool, task_id: &str, kind: &str) -> i64 {
    let result = sqlx::query(
        "INSERT INTO events (task_id, kind, created_at) VALUES (?, ?, strftime('%s', 'now'))",
    )
    .bind(task_id)
    .bind(kind)
    .execute(pool)
    .await
    .expect("插入测试事件失败");

    result.last_insert_rowid()
}

/// 插入测试评论到 kanban DB
async fn insert_kanban_comment(pool: &SqlitePool, task_id: &str, body: &str) {
    sqlx::query(
        "INSERT INTO comments (task_id, body, created_at) VALUES (?, ?, strftime('%s', 'now'))",
    )
    .bind(task_id)
    .bind(body)
    .execute(pool)
    .await
    .expect("插入测试评论失败");
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

// ==================== list_tasks 测试 ====================

#[tokio::test]
async fn test_list_tasks_no_pool_returns_error() {
    let svc = KanbanService::new();
    let result = svc.list_tasks("any-tenant").await;
    assert!(result.is_err(), "无 kanban pool 应返回错误");
}

#[tokio::test]
async fn test_list_tasks_empty_db_returns_empty() {
    let kanban_pool = setup_kanban_db().await;
    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let tasks = svc.list_tasks("any-tenant").await.unwrap();
    assert!(tasks.is_empty(), "空数据库应返回空列表");
}

#[tokio::test]
async fn test_list_tasks_returns_matching_tenant() {
    let kanban_pool = setup_kanban_db().await;
    insert_kanban_task(&kanban_pool, "t1", "任务1", "todo", Some("my-board"), None).await;
    insert_kanban_task(
        &kanban_pool,
        "t2",
        "任务2",
        "done",
        Some("other-board"),
        None,
    )
    .await;
    insert_kanban_task(&kanban_pool, "t3", "任务3", "running", None, Some("alice")).await;

    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let tasks = svc.list_tasks("my-board").await.unwrap();

    // t1 (tenant=my-board) + t3 (tenant=null，全局可见)
    assert_eq!(tasks.len(), 2, "应返回 tenant 匹配 + null tenant 的任务");
    assert!(tasks.iter().any(|t| t.id == "t1"));
    assert!(tasks.iter().any(|t| t.id == "t3"));
}

// ==================== get_task 测试 ====================

#[tokio::test]
async fn test_get_task_no_pool_returns_error() {
    let svc = KanbanService::new();
    let result = svc.get_task("any-task", "any-tenant").await;
    assert!(result.is_err(), "无 kanban pool 应返回错误");
}

#[tokio::test]
async fn test_get_task_not_found() {
    let kanban_pool = setup_kanban_db().await;
    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let result = svc.get_task("nonexistent", "any-tenant").await;
    assert!(result.is_err(), "不存在的任务应返回错误");

    match result.unwrap_err() {
        hermes_chat_backend::errors::AppError::NotFound(_) => {} // 期望
        other => panic!("期望 NotFound，实际: {:?}", other),
    }
}

#[tokio::test]
async fn test_get_task_returns_detail_with_comments_and_events() {
    let kanban_pool = setup_kanban_db().await;
    insert_kanban_task(
        &kanban_pool,
        "t-detail",
        "详情测试",
        "running",
        Some("board-x"),
        Some("bob"),
    )
    .await;
    insert_kanban_comment(&kanban_pool, "t-detail", "这是评论").await;
    insert_kanban_event(&kanban_pool, "t-detail", "created").await;
    insert_kanban_event(&kanban_pool, "t-detail", "claimed").await;

    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let detail = svc.get_task("t-detail", "board-x").await.unwrap();

    // 验证 task 字段
    let task = detail.get("task").expect("应有 task 字段");
    assert_eq!(task["id"], "t-detail");
    assert_eq!(task["title"], "详情测试");
    assert_eq!(task["status"], "running");
    assert_eq!(task["assignee"], "bob");
    assert_eq!(task["tenant"], "board-x");

    // 验证 comments
    let comments = detail
        .get("comments")
        .expect("应有 comments 字段")
        .as_array()
        .unwrap();
    assert_eq!(comments.len(), 1, "应有 1 条评论");
    assert_eq!(comments[0]["body"], "这是评论");

    // 验证 events
    let events = detail
        .get("events")
        .expect("应有 events 字段")
        .as_array()
        .unwrap();
    assert_eq!(events.len(), 2, "应有 2 个事件");
    assert_eq!(events[0]["kind"], "created");
    assert_eq!(events[1]["kind"], "claimed");
}

#[tokio::test]
async fn test_get_task_tenant_isolation_rejects_other_tenant() {
    let kanban_pool = setup_kanban_db().await;
    insert_kanban_task(
        &kanban_pool,
        "t-isolated",
        "隔离测试",
        "todo",
        Some("tenant-a"),
        None,
    )
    .await;

    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let result = svc.get_task("t-isolated", "tenant-b").await;

    assert!(result.is_err(), "不同 tenant 应被拒绝");
    match result.unwrap_err() {
        hermes_chat_backend::errors::AppError::Forbidden(_) => {} // 期望
        other => panic!("期望 Forbidden，实际: {:?}", other),
    }
}

#[tokio::test]
async fn test_get_task_null_tenant_accessible_by_any() {
    let kanban_pool = setup_kanban_db().await;
    insert_kanban_task(&kanban_pool, "t-global", "全局任务", "todo", None, None).await;

    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let detail = svc.get_task("t-global", "any-tenant").await.unwrap();

    assert_eq!(
        detail["task"]["id"], "t-global",
        "null tenant 任务应可被任何 tenant 访问"
    );
}

// ==================== get_stats 测试 ====================

#[tokio::test]
async fn test_get_stats_no_pool_returns_error() {
    let svc = KanbanService::new();
    let result = svc.get_stats("any-tenant").await;
    assert!(result.is_err(), "无 kanban pool 应返回错误");
}

#[tokio::test]
async fn test_get_stats_empty_db_returns_zeros() {
    let kanban_pool = setup_kanban_db().await;
    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let stats = svc.get_stats("any-tenant").await.unwrap();
    assert_eq!(stats.total, 0);
    assert_eq!(stats.todo, 0);
    assert_eq!(stats.doing, 0);
    assert_eq!(stats.done, 0);
}

#[tokio::test]
async fn test_get_stats_counts_by_status() {
    let kanban_pool = setup_kanban_db().await;
    insert_kanban_task(&kanban_pool, "s1", "A", "todo", Some("board"), None).await;
    insert_kanban_task(&kanban_pool, "s2", "B", "ready", Some("board"), None).await;
    insert_kanban_task(&kanban_pool, "s3", "C", "running", Some("board"), None).await;
    insert_kanban_task(&kanban_pool, "s4", "D", "blocked", Some("board"), None).await;
    insert_kanban_task(&kanban_pool, "s5", "E", "done", Some("board"), None).await;
    insert_kanban_task(&kanban_pool, "s6", "F", "done", Some("board"), None).await;
    // 不同 tenant，不应计入
    insert_kanban_task(&kanban_pool, "s7", "G", "done", Some("other"), None).await;

    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let stats = svc.get_stats("board").await.unwrap();

    assert_eq!(
        stats.total, 6,
        "total = todo + ready + running + blocked + done"
    );
    assert_eq!(stats.todo, 2, "todo = 1(todo) + 1(ready)");
    assert_eq!(stats.doing, 2, "doing = 1(running) + 1(blocked)");
    assert_eq!(stats.done, 2, "done = 2");
}

#[tokio::test]
async fn test_get_stats_null_tenant_included() {
    let kanban_pool = setup_kanban_db().await;
    insert_kanban_task(&kanban_pool, "sn1", "X", "todo", Some("board"), None).await;
    insert_kanban_task(&kanban_pool, "sn2", "Y", "done", None, None).await;

    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let stats = svc.get_stats("board").await.unwrap();

    assert_eq!(stats.total, 2, "null tenant 任务也应被计入");
}

// ==================== get_latest_event_id / poll_new_events 测试 ====================

#[tokio::test]
async fn test_get_latest_event_id_empty() {
    let kanban_pool = setup_kanban_db().await;
    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let id = svc.get_latest_event_id("any-tenant").await.unwrap();
    assert_eq!(id, 0, "空事件表应返回 0");
}

#[tokio::test]
async fn test_get_latest_event_id_returns_max() {
    let kanban_pool = setup_kanban_db().await;
    insert_kanban_task(&kanban_pool, "t-ev", "任务", "todo", Some("board"), None).await;
    insert_kanban_event(&kanban_pool, "t-ev", "created").await;
    insert_kanban_event(&kanban_pool, "t-ev", "claimed").await;
    let last_id = insert_kanban_event(&kanban_pool, "t-ev", "heartbeat").await;

    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let id = svc.get_latest_event_id("board").await.unwrap();
    assert_eq!(id, last_id, "应返回最大事件 ID");
}

#[tokio::test]
async fn test_poll_new_events_returns_after_specified_id() {
    let kanban_pool = setup_kanban_db().await;
    insert_kanban_task(&kanban_pool, "t-poll", "任务", "todo", Some("board"), None).await;
    let id1 = insert_kanban_event(&kanban_pool, "t-poll", "created").await;
    let _id2 = insert_kanban_event(&kanban_pool, "t-poll", "claimed").await;
    let _id3 = insert_kanban_event(&kanban_pool, "t-poll", "heartbeat").await;

    let svc = KanbanService::with_kanban_pool(kanban_pool);

    // 从 id1 之后查询，应返回 2 个事件
    let events = svc.poll_new_events("board", id1).await.unwrap();
    assert_eq!(events.len(), 2, "应返回 id1 之后的 2 个事件");
    assert_eq!(events[0]["kind"], "claimed");
    assert_eq!(events[1]["kind"], "heartbeat");
}

#[tokio::test]
async fn test_poll_new_events_respects_tenant_isolation() {
    let kanban_pool = setup_kanban_db().await;
    insert_kanban_task(&kanban_pool, "t-a", "A", "todo", Some("tenant-a"), None).await;
    insert_kanban_task(&kanban_pool, "t-b", "B", "todo", Some("tenant-b"), None).await;
    insert_kanban_event(&kanban_pool, "t-a", "created").await;
    insert_kanban_event(&kanban_pool, "t-b", "created").await;

    let svc = KanbanService::with_kanban_pool(kanban_pool);
    let events_a = svc.poll_new_events("tenant-a", 0).await.unwrap();
    let events_b = svc.poll_new_events("tenant-b", 0).await.unwrap();

    assert_eq!(events_a.len(), 1, "tenant-a 只应看到自己的事件");
    assert_eq!(events_a[0]["task_id"], "t-a");
    assert_eq!(events_b.len(), 1, "tenant-b 只应看到自己的事件");
    assert_eq!(events_b[0]["task_id"], "t-b");
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
