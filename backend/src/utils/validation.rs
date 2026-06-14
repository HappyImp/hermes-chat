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
    if password.len() < 8 || password.len() > 128 {
        return Err("密码长度必须在 8-128 字符之间".to_string());
    }

    let has_upper = password.chars().any(|c| c.is_uppercase());
    let has_lower = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_numeric());

    if !has_upper || !has_lower || !has_digit {
        return Err("密码必须包含大小写字母和数字".to_string());
    }

    Ok(())
}