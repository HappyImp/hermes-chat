# KAN-205: 员工列表接口（从 profiles 推导）

## 背景
现有的员工列表仅从 `permissions` 表获取，缺少一个全局可用的员工目录。
需要一个接口从 Hermes profiles 目录推导出所有可用的 agent profiles。

## 需求
1. 新增 `GET /api/employees/profiles` 接口
2. 从 `~/.hermes/profiles/` 目录读取所有可用 profile
3. 每个 profile 返回：name、description、profile_path
4. description 从 SKILL.md 的 YAML frontmatter 或 README.md 推导
5. 需要认证（AuthUser）

## 响应格式
```json
{
  "employees": [
    {
      "name": "coder-404",
      "description": "全栈码农「404」",
      "profile_path": "/root/.hermes/profiles/coder-404"
    }
  ],
  "total": 7
}
```

## 验收标准
- [ ] 接口返回所有非隐藏目录的 profile
- [ ] description 优先从 SKILL.md 读取
- [ ] 无 description 时返回空字符串
- [ ] 需要认证
