use std::path::PathBuf;

use serde::Serialize;
use serde_json::{json, Value};

use crate::errors::AppError;

/// 从 Hermes profiles 目录推导出的员工信息
#[derive(Debug, Serialize)]
pub struct EmployeeProfile {
    pub name: String,
    pub description: String,
    pub profile_path: String,
}

/// 员工 Profiles 服务
///
/// 从 ~/.hermes/profiles/ 目录读取所有可用的 agent profile，
/// 作为员工列表的权威数据源。
#[derive(Clone)]
pub struct ProfileService {
    profiles_dir: PathBuf,
}

impl ProfileService {
    /// 创建 ProfileService
    ///
    /// # Arguments
    /// * `profiles_dir` — profiles 目录路径，默认 ~/.hermes/profiles/
    pub fn new(profiles_dir: Option<PathBuf>) -> Self {
        let dir = profiles_dir.unwrap_or_else(|| {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_string());
            PathBuf::from(home).join(".hermes").join("profiles")
        });
        Self { profiles_dir: dir }
    }

    /// 列出所有可用的 employee profiles
    pub async fn list_profiles(&self) -> Result<Vec<EmployeeProfile>, AppError> {
        let mut profiles = Vec::new();

        let entries = tokio::fs::read_dir(&self.profiles_dir).await.map_err(|e| {
            tracing::warn!("读取 profiles 目录失败: {}", e);
            AppError::Internal("无法读取 profiles 目录".to_string())
        })?;

        let mut entries = entries;
        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| AppError::Internal(format!("读取目录条目失败: {}", e)))?
        {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let name = entry.file_name().to_string_lossy().to_string();

            // 跳过隐藏目录
            if name.starts_with('.') {
                continue;
            }

            // 尝试读取 SKILL.md 或 README.md 获取描述
            let description = self.read_profile_description(&path).await;

            profiles.push(EmployeeProfile {
                name,
                description,
                profile_path: path.to_string_lossy().to_string(),
            });
        }

        // 按名称排序
        profiles.sort_by(|a, b| a.name.cmp(&b.name));

        Ok(profiles)
    }

    /// 列出 profiles，返回 JSON 格式
    pub async fn list_profiles_json(&self) -> Result<Value, AppError> {
        let profiles = self.list_profiles().await?;

        let items: Vec<Value> = profiles
            .iter()
            .map(|p| {
                json!({
                    "name": p.name,
                    "description": p.description,
                    "profile_path": p.profile_path,
                })
            })
            .collect();

        Ok(json!({
            "employees": items,
            "total": items.len(),
        }))
    }

    /// 从 profile 目录中读取描述信息
    /// 优先读 SKILL.md 的 description 字段，其次读 README.md 第一段
    async fn read_profile_description(&self, dir: &std::path::Path) -> String {
        // 尝试 SKILL.md
        let skill_path = dir.join("skills").join("coder-404").join("SKILL.md");
        if let Ok(content) = tokio::fs::read_to_string(&skill_path).await {
            if let Some(desc) = extract_yaml_description(&content) {
                return desc;
            }
        }

        // 尝试 README.md
        let readme_path = dir.join("README.md");
        if let Ok(content) = tokio::fs::read_to_string(&readme_path).await {
            if let Some(desc) = extract_first_paragraph(&content) {
                return desc;
            }
        }

        String::new()
    }
}

/// 从 YAML frontmatter 中提取 description
pub fn extract_yaml_description(content: &str) -> Option<String> {
    let content = content.trim();
    if !content.starts_with("---") {
        return None;
    }

    let after_first = content[3..].trim_start();
    let end = after_first.find("---")?;
    let frontmatter = &after_first[..end];

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(value) = line.strip_prefix("description:") {
            let value = value.trim().trim_matches('"').trim_matches('\'');
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }

    None
}

/// 提取 markdown 第一段文本（跳过标题）
pub fn extract_first_paragraph(content: &str) -> Option<String> {
    for line in content.lines() {
        let line = line.trim();
        // 跳过空行、标题行、分隔线
        if line.is_empty() || line.starts_with('#') || line.starts_with("---") {
            continue;
        }
        // 去掉 markdown 格式符号
        let clean = line.trim_start_matches('>').trim_start_matches('-').trim();
        if !clean.is_empty() {
            // 截断到 200 字符
            let desc = if clean.len() > 200 {
                format!("{}...", &clean[..200])
            } else {
                clean.to_string()
            };
            return Some(desc);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_yaml_description() {
        let content = r#"---
name: coder-404
description: 全栈码农「404」— 二次元神秘代号，代码洁癖
tags: [dev]
---

# 404
Some content"#;

        let desc = extract_yaml_description(content);
        assert_eq!(
            desc,
            Some("全栈码农「404」— 二次元神秘代号，代码洁癖".to_string())
        );
    }

    #[test]
    fn test_extract_yaml_description_none() {
        assert_eq!(extract_yaml_description("no yaml here"), None);
        assert_eq!(extract_yaml_description("---\n---\n"), None);
    }

    #[test]
    fn test_extract_first_paragraph() {
        let content = r#"# Title

Some description text here.

## Section
More content"#;

        let desc = extract_first_paragraph(content);
        assert_eq!(desc, Some("Some description text here.".to_string()));
    }

    #[test]
    fn test_extract_first_paragraph_with_quote() {
        let content = "# Title\n\n> A quoted description\n\nMore";
        let desc = extract_first_paragraph(content);
        assert_eq!(desc, Some("A quoted description".to_string()));
    }

    #[test]
    fn test_extract_first_paragraph_empty() {
        let content = "# Title\n\n\n## Section";
        assert_eq!(extract_first_paragraph(content), None);
    }
}
