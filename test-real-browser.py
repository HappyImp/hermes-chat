#!/usr/bin/env python3
"""
Hermes Chat 线上测试脚本 - 使用 Playwright 连接 Obscura CDP
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright

# 测试配置
TEST_URL = "http://43.249.192.131:7960/chat/"
CDP_URL = "http://localhost:9222"

# 测试结果存储
test_results = []
bugs_found = []

class TestResult:
    def __init__(self, test_id, test_name, status, details="", bug_info=None):
        self.test_id = test_id
        self.test_name = test_name
        self.status = status  # PASS, FAIL, SKIP
        self.details = details
        self.bug_info = bug_info
        self.timestamp = datetime.now().isoformat()
        
    def to_dict(self):
        return {
            "test_id": self.test_id,
            "test_name": self.test_name,
            "status": self.status,
            "details": self.details,
            "bug_info": self.bug_info,
            "timestamp": self.timestamp
        }

class Bug:
    def __init__(self, bug_id, severity, title, steps, expected, actual, environment=""):
        self.bug_id = bug_id
        self.severity = severity  # 严重, 一般
        self.title = title
        self.steps = steps
        self.expected = expected
        self.actual = actual
        self.environment = environment
        
    def to_dict(self):
        return {
            "bug_id": self.bug_id,
            "severity": self.severity,
            "title": self.title,
            "steps": self.steps,
            "expected": self.expected,
            "actual": self.actual,
            "environment": self.environment
        }

async def test_page_loading(page):
    """测试页面加载功能"""
    print("=== 开始测试页面加载 ===")
    
    # TC-1.1.1: 页面可访问性
    try:
        response = await page.goto(TEST_URL, wait_until="networkidle")
        if response and response.status == 200:
            test_results.append(TestResult(
                "TC-1.1.1",
                "页面可访问性",
                "PASS",
                f"HTTP {response.status}，页面正常加载"
            ))
            print(f"✅ TC-1.1.1: 页面可访问性 - PASS (HTTP {response.status})")
        else:
            status = response.status if response else "无响应"
            test_results.append(TestResult(
                "TC-1.1.1",
                "页面可访问性",
                "FAIL",
                f"HTTP 状态码异常: {status}",
                Bug("BUG-001", "严重", "页面无法访问", 
                    "1. 访问 http://43.249.192.131:7960/chat/\n2. 检查 HTTP 状态码",
                    "HTTP 200，页面正常加载",
                    f"HTTP 状态码异常: {status}",
                    "Obscura CDP")
            ))
            print(f"❌ TC-1.1.1: 页面可访问性 - FAIL (HTTP {status})")
    except Exception as e:
        test_results.append(TestResult(
            "TC-1.1.1",
            "页面可访问性",
            "FAIL",
            f"页面加载失败: {str(e)}",
            Bug("BUG-001", "严重", "页面无法访问", 
                "1. 访问 http://43.249.192.131:7960/chat/\n2. 检查 HTTP 状态码",
                "HTTP 200，页面正常加载",
                f"页面加载失败: {str(e)}",
                "Obscura CDP")
        ))
        print(f"❌ TC-1.1.1: 页面可访问性 - FAIL: {e}")
    
    # TC-1.1.2: 静态资源加载
    try:
        # 检查是否有资源加载错误
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        
        # 等待页面完全加载
        await page.wait_for_load_state("networkidle")
        
        if not console_errors:
            test_results.append(TestResult(
                "TC-1.1.2",
                "静态资源加载",
                "PASS",
                "所有静态资源加载成功，无 404 错误"
            ))
            print("✅ TC-1.1.2: 静态资源加载 - PASS")
        else:
            test_results.append(TestResult(
                "TC-1.1.2",
                "静态资源加载",
                "FAIL",
                f"发现 {len(console_errors)} 个控制台错误",
                Bug("BUG-002", "严重", "静态资源加载失败",
                    "1. 检查 JS/CSS 文件是否可访问\n2. 查看控制台是否有资源加载错误",
                    "所有静态资源加载成功，无 404 错误",
                    f"发现控制台错误: {console_errors[:3]}",
                    "Obscura CDP")
            ))
            print(f"❌ TC-1.1.2: 静态资源加载 - FAIL: 发现 {len(console_errors)} 个错误")
    except Exception as e:
        test_results.append(TestResult(
            "TC-1.1.2",
            "静态资源加载",
            "FAIL",
            f"静态资源加载测试失败: {str(e)}",
            Bug("BUG-002", "严重", "静态资源加载失败",
                "1. 检查 JS/CSS 文件是否可访问\n2. 查看控制台是否有资源加载错误",
                "所有静态资源加载成功，无 404 错误",
                f"静态资源加载测试失败: {str(e)}",
                "Obscura CDP")
        ))
        print(f"❌ TC-1.1.2: 静态资源加载 - FAIL: {e}")
    
    # TC-1.1.3: 初始界面显示
    try:
        # 检查关键元素是否存在
        sidebar = await page.query_selector('[class*="sidebar"]')
        input_box = await page.query_selector('textarea, input[type="text"]')
        
        if sidebar and input_box:
            test_results.append(TestResult(
                "TC-1.1.3",
                "初始界面显示",
                "PASS",
                "显示欢迎界面，侧边栏可见，输入框可用"
            ))
            print("✅ TC-1.1.3: 初始界面显示 - PASS")
        else:
            missing = []
            if not sidebar:
                missing.append("侧边栏")
            if not input_box:
                missing.append("输入框")
            
            test_results.append(TestResult(
                "TC-1.1.3",
                "初始界面显示",
                "FAIL",
                f"缺少关键界面元素: {', '.join(missing)}",
                Bug("BUG-003", "一般", "初始界面显示异常",
                    "1. 首次访问页面\n2. 检查界面元素",
                    "显示欢迎界面，侧边栏可见，输入框可用",
                    f"缺少关键界面元素: {', '.join(missing)}",
                    "Obscura CDP")
            ))
            print(f"❌ TC-1.1.3: 初始界面显示 - FAIL: 缺少 {', '.join(missing)}")
    except Exception as e:
        test_results.append(TestResult(
            "TC-1.1.3",
            "初始界面显示",
            "FAIL",
            f"初始界面显示测试失败: {str(e)}",
            Bug("BUG-003", "一般", "初始界面显示异常",
                "1. 首次访问页面\n2. 检查界面元素",
                "显示欢迎界面，侧边栏可见，输入框可用",
                f"初始界面显示测试失败: {str(e)}",
                "Obscura CDP")
        ))
        print(f"❌ TC-1.1.3: 初始界面显示 - FAIL: {e}")

async def test_chat_functionality(page):
    """测试聊天功能"""
    print("\n=== 开始测试聊天功能 ===")
    
    # TC-1.2.1: Enter 发送消息
    try:
        # 查找输入框
        input_box = await page.wait_for_selector('textarea, input[type="text"]')
        if input_box:
            # 输入测试消息
            await input_box.fill("Hello, this is a test message from Ditto!")
            await input_box.press("Enter")
            
            # 等待消息显示
            await page.wait_for_timeout(1000)
            
            # 检查消息是否显示
            message_elements = await page.query_selector_all('[class*="message"]')
            if len(message_elements) > 0:
                test_results.append(TestResult(
                    "TC-1.2.1",
                    "Enter 发送消息",
                    "PASS",
                    "消息发送成功，显示在聊天区域"
                ))
                print("✅ TC-1.2.1: Enter 发送消息 - PASS")
            else:
                test_results.append(TestResult(
                    "TC-1.2.1",
                    "Enter 发送消息",
                    "FAIL",
                    "消息未显示在聊天区域",
                    Bug("BUG-004", "严重", "无法发送消息",
                        "1. 在输入框输入 'Hello'\n2. 按 Enter 键",
                        "消息发送成功，显示在聊天区域",
                        "消息未显示在聊天区域",
                        "Obscura CDP")
                ))
                print("❌ TC-1.2.1: Enter 发送消息 - FAIL: 消息未显示")
        else:
            test_results.append(TestResult(
                "TC-1.2.1",
                "Enter 发送消息",
                "FAIL",
                "未找到输入框",
                Bug("BUG-004", "严重", "无法发送消息",
                    "1. 在输入框输入 'Hello'\n2. 按 Enter 键",
                    "消息发送成功，显示在聊天区域",
                    "未找到输入框",
                    "Obscura CDP")
            ))
            print("❌ TC-1.2.1: Enter 发送消息 - FAIL: 未找到输入框")
    except Exception as e:
        test_results.append(TestResult(
            "TC-1.2.1",
            "Enter 发送消息",
            "FAIL",
            f"消息发送测试失败: {str(e)}",
            Bug("BUG-004", "严重", "无法发送消息",
                "1. 在输入框输入 'Hello'\n2. 按 Enter 键",
                "消息发送成功，显示在聊天区域",
                f"消息发送测试失败: {str(e)}",
                "Obscura CDP")
        ))
        print(f"❌ TC-1.2.1: Enter 发送消息 - FAIL: {e}")

async def test_api_proxy(page):
    """测试 API 代理"""
    print("\n=== 开始测试 API 代理 ===")
    
    # TC-8.1.1: 聊天 API
    try:
        # 测试 API 端点
        api_response = await page.evaluate("""
            async () => {
                try {
                    const response = await fetch('/chat/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: 'gpt-3.5-turbo',
                            messages: [{role: 'user', content: 'test'}],
                            stream: false
                        })
                    });
                    const text = await response.text();
                    return {
                        status: response.status,
                        contentType: response.headers.get('content-type'),
                        isJson: text.startsWith('{') || text.startsWith('['),
                        body: text.substring(0, 200)
                    };
                } catch (error) {
                    return { error: error.message };
                }
            }
        """)
        
        if 'error' not in api_response and api_response.get('isJson'):
            test_results.append(TestResult(
                "TC-8.1.1",
                "聊天 API",
                "PASS",
                f"返回 JSON 格式响应 (HTTP {api_response.get('status')})"
            ))
            print(f"✅ TC-8.1.1: 聊天 API - PASS (HTTP {api_response.get('status')})")
        else:
            error_msg = api_response.get('error', '响应不是 JSON 格式')
            test_results.append(TestResult(
                "TC-8.1.1",
                "聊天 API",
                "FAIL",
                f"API 测试失败: {error_msg}",
                Bug("BUG-009", "严重", "聊天 API 返回 HTML 而不是 JSON",
                    "1. 发送 POST 请求到 /chat/v1/chat/completions\n2. 检查响应",
                    "返回 JSON 格式响应，不是 HTML",
                    f"API 测试失败: {error_msg}",
                    "Obscura CDP")
            ))
            print(f"❌ TC-8.1.1: 聊天 API - FAIL: {error_msg}")
    except Exception as e:
        test_results.append(TestResult(
            "TC-8.1.1",
            "聊天 API",
            "FAIL",
            f"API 测试异常: {str(e)}",
            Bug("BUG-009", "严重", "聊天 API 返回 HTML 而不是 JSON",
                "1. 发送 POST 请求到 /chat/v1/chat/completions\n2. 检查响应",
                "返回 JSON 格式响应，不是 HTML",
                f"API 测试异常: {str(e)}",
                "Obscura CDP")
        ))
        print(f"❌ TC-8.1.1: 聊天 API - FAIL: {e}")

def generate_test_report():
    """生成测试报告"""
    print("\n" + "="*50)
    print("=== Ditto 测试报告 ===")
    print("="*50)
    
    total_tests = len(test_results)
    passed_tests = len([t for t in test_results if t.status == "PASS"])
    failed_tests = len([t for t in test_results if t.status == "FAIL"])
    
    print(f"📋 测试用例：{total_tests} 条")
    print(f"✅ 通过：{passed_tests} 条")
    print(f"❌ 失败：{failed_tests} 条")
    print(f"🐛 发现 bug：{len(bugs_found)} 个")
    
    if bugs_found:
        print("\n=== Bug 列表 ===")
        for bug in bugs_found:
            print(f"{bug.bug_id}. [{bug.severity}] {bug.title}")
            print(f"   复现步骤：")
            for i, step in enumerate(bug.steps.split('\n'), 1):
                print(f"   {i}. {step}")
            print(f"   预期：{bug.expected}")
            print(f"   实际：{bug.actual}")
            print()
    
    print("=== 结论 ===")
    if failed_tests == 0:
        print("✅ 通过 - 所有测试用例通过，可以上线")
    else:
        print("❌ 需修复 - 发现失败测试用例，需要修复后重新测试")
    
    # 保存测试结果到文件
    report_data = {
        "test_summary": {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "bugs_found": len(bugs_found),
            "test_date": datetime.now().isoformat(),
            "test_environment": TEST_URL,
            "test_tool": "Playwright + Obscura CDP"
        },
        "test_results": [t.to_dict() for t in test_results],
        "bugs": [b.to_dict() for b in bugs_found]
    }
    
    report_path = Path("/root/hermes-chat/docs/test/test-report-real-2026-06-14.json")
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 详细测试报告已保存到: {report_path}")

async def main():
    """主测试函数"""
    print("🚀 开始 Hermes Chat 线上测试 (真实浏览器测试)")
    print(f"⏰ 测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 测试环境: {TEST_URL}")
    print(f"🔧 测试工具: Playwright + Obscura CDP ({CDP_URL})")
    print("="*50)
    
    async with async_playwright() as p:
        try:
            # 连接到 Obscura CDP
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = await context.new_page()
            
            print("✅ 已连接到 Obscura CDP")
            
            # 执行所有测试
            await test_page_loading(page)
            await test_chat_functionality(page)
            await test_api_proxy(page)
            
            # 关闭页面
            await page.close()
            
        except Exception as e:
            print(f"❌ 连接 Obscura CDP 失败: {e}")
            print("请确保 Obscura 容器正在运行: docker start obscura-cdp")
            return
    
    # 生成测试报告
    generate_test_report()

if __name__ == "__main__":
    asyncio.run(main())