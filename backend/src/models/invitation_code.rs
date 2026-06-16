use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct InvitationCode {
    pub id: String,
    pub code: String,
    pub allowed_employees: String, // JSON array string
    pub allowed_tenants: Option<String>, // JSON array string (KAN-404: tenant 映射)
    pub max_uses: i32,
    pub used_count: i32,
    pub status: String, // active / used / disabled
    pub created_by: String,
    pub used_by: Option<String>,
    pub created_at: String,
    pub expires_at: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvitationCode {
    pub allowed_employees: Vec<String>,
    /// 可选的 tenant 列表（KAN-404: tenant 映射方式）
    #[serde(default)]
    pub allowed_tenants: Option<Vec<String>>,
    #[serde(default = "default_count")]
    pub count: i32,
    pub expires_in_hours: Option<i64>,
    pub note: Option<String>,
}

fn default_count() -> i32 {
    1
}

#[derive(Debug, Serialize)]
pub struct InvitationCodeResponse {
    pub id: String,
    pub code: String,
    pub allowed_employees: Vec<String>,
    pub allowed_tenants: Vec<String>,
    pub max_uses: i32,
    pub used_count: i32,
    pub status: String,
    pub created_by: String,
    pub used_by: Option<String>,
    pub created_at: String,
    pub expires_at: Option<String>,
    pub note: Option<String>,
}

impl InvitationCode {
    pub fn to_response(&self) -> InvitationCodeResponse {
        let employees: Vec<String> =
            serde_json::from_str(&self.allowed_employees).unwrap_or_default();
        let tenants: Vec<String> = self
            .allowed_tenants
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_else(|| vec!["default".to_string()]);
        InvitationCodeResponse {
            id: self.id.clone(),
            code: self.code.clone(),
            allowed_employees: employees,
            allowed_tenants: tenants,
            max_uses: self.max_uses,
            used_count: self.used_count,
            status: self.status.clone(),
            created_by: self.created_by.clone(),
            used_by: self.used_by.clone(),
            created_at: self.created_at.clone(),
            expires_at: self.expires_at.clone(),
            note: self.note.clone(),
        }
    }

    /// 检查授权码是否可用
    #[allow(dead_code)]
    pub fn is_valid(&self) -> bool {
        if self.status != "active" {
            return false;
        }
        if self.used_count >= self.max_uses {
            return false;
        }
        if let Some(ref expires) = self.expires_at {
            if let Ok(exp) = chrono::DateTime::parse_from_rfc3339(expires) {
                if exp < chrono::Utc::now() {
                    return false;
                }
            }
        }
        true
    }
}
