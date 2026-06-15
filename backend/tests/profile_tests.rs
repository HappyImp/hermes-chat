#[cfg(test)]
mod profile_service_tests {
    use hermes_chat_backend::services::profile::{
        extract_first_paragraph, extract_yaml_description,
    };

    #[test]
    fn test_extract_yaml_description_basic() {
        let content = r#"---
name: coder-404
description: 全栈码农「404」— 二次元神秘代号
tags: [dev]
---

# 404
Some content"#;

        let desc = extract_yaml_description(content);
        assert_eq!(desc, Some("全栈码农「404」— 二次元神秘代号".to_string()));
    }

    #[test]
    fn test_extract_yaml_description_quoted() {
        let content = "---\ndescription: \"Quoted description\"\n---\n";
        let desc = extract_yaml_description(content);
        assert_eq!(desc, Some("Quoted description".to_string()));
    }

    #[test]
    fn test_extract_yaml_description_single_quoted() {
        let content = "---\ndescription: 'Single quoted'\n---\n";
        let desc = extract_yaml_description(content);
        assert_eq!(desc, Some("Single quoted".to_string()));
    }

    #[test]
    fn test_extract_yaml_description_no_yaml() {
        assert_eq!(extract_yaml_description("no yaml here"), None);
    }

    #[test]
    fn test_extract_yaml_description_no_description() {
        let content = "---\nname: test\n---\n";
        assert_eq!(extract_yaml_description(content), None);
    }

    #[test]
    fn test_extract_yaml_description_empty_value() {
        let content = "---\ndescription:\nname: test\n---\n";
        assert_eq!(extract_yaml_description(content), None);
    }

    #[test]
    fn test_extract_first_paragraph_basic() {
        let content = "# Title\n\nSome description text.\n\n## Section";
        let desc = extract_first_paragraph(content);
        assert_eq!(desc, Some("Some description text.".to_string()));
    }

    #[test]
    fn test_extract_first_paragraph_with_quote() {
        let content = "# Title\n\n> A quoted description\n\nMore";
        let desc = extract_first_paragraph(content);
        assert_eq!(desc, Some("A quoted description".to_string()));
    }

    #[test]
    fn test_extract_first_paragraph_with_list() {
        let content = "# Title\n\n- First list item\n\nMore";
        let desc = extract_first_paragraph(content);
        assert_eq!(desc, Some("First list item".to_string()));
    }

    #[test]
    fn test_extract_first_paragraph_empty() {
        let content = "# Title\n\n\n## Section";
        assert_eq!(extract_first_paragraph(content), None);
    }

    #[test]
    fn test_extract_first_paragraph_only_title() {
        let content = "# Just a title\n";
        assert_eq!(extract_first_paragraph(content), None);
    }

    #[test]
    fn test_extract_first_paragraph_long_text() {
        let long_text = "a".repeat(300);
        let content = format!("# Title\n\n{}\n\nMore", long_text);
        let desc = extract_first_paragraph(&content);
        assert!(desc.is_some());
        let desc = desc.unwrap();
        assert!(desc.ends_with("..."));
        assert!(desc.len() <= 204); // 200 + "..."
    }
}
