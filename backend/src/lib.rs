pub mod config;
pub mod db;
pub mod errors;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod services;
pub mod utils;

use db::DbPool;
use services::auth::AuthService;
use services::employee::EmployeeService;
use services::hermes::HermesClient;
use services::kanban::KanbanService;
use services::profile::ProfileService;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    pub auth_service: AuthService,
    pub employee_service: EmployeeService,
    pub hermes_client: HermesClient,
    pub kanban_service: KanbanService,
    pub profile_service: ProfileService,
    pub jwt_secret: String,
}
