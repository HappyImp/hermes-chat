pub fn validate_username(username: &str) -> Result<(), String> {
    if username.len() < 3 || username.len() > 32 {
        return Err("用户名长度必须在 3-32 字符之间".to_string());
    }

    if !username.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("用户名只能包含字母、数字和下划线".to_string());
    }

    Ok(())
}

pub fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 6 || password.len() > 128 {
        return Err("密码长度必须在 6-128 字符之间".to_string());
    }

    Ok(())
}
