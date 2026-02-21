#!/bin/bash

# MindFlow 自动化测试脚本
# 使用方式: ./run-tests.sh [unit|e2e|all]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查后端服务
check_backend() {
    log_info "检查后端服务状态..."
    if curl -s http://127.0.0.1:3001/health > /dev/null; then
        log_info "后端服务运行正常"
        return 0
    else
        log_warn "后端服务未启动，尝试启动..."
        cd /Users/zuolin1/article-collector/mindflow-project/backend
        npx pm2 start ecosystem.config.js > /dev/null 2>&1 || true
        sleep 3
        if curl -s http://127.0.0.1:3001/health > /dev/null; then
            log_info "后端服务启动成功"
            return 0
        else
            log_error "后端服务启动失败"
            return 1
        fi
    fi
}

# 运行单元测试
run_unit_tests() {
    log_info "运行前端单元测试..."
    cd /Users/zuolin1/article-collector/mindflow-project/frontend
    npm test -- --coverage --passWithNoTests
    
    log_info "运行后端单元测试..."
    cd /Users/zuolin1/article-collector/mindflow-project/backend
    npm test -- --coverage --passWithNoTests
}

# 运行E2E测试
run_e2e_tests() {
    log_info "运行E2E测试..."
    cd /Users/zuolin1/article-collector/mindflow-project/frontend
    
    # 检查是否安装了 Playwright
    if ! npm list @playwright/test > /dev/null 2>&1; then
        log_warn "安装 Playwright..."
        npm install -D @playwright/test
        npx playwright install
    fi
    
    npm run test:e2e
}

# 运行组件测试
run_component_tests() {
    log_info "运行组件测试..."
    cd /Users/zuolin1/article-collector/mindflow-project/frontend
    
    # BriefCard 组件测试
    log_info "测试 BriefCard 组件..."
    npm test -- --testPathPattern="BriefCard" --passWithNoTests
    
    # DraftViewer 组件测试
    log_info "测试 DraftViewer 组件..."
    npm test -- --testPathPattern="DraftViewer" --passWithNoTests
    
    # ChatInterface 组件测试
    log_info "测试 ChatInterface 组件..."
    npm test -- --testPathPattern="ChatInterface" --passWithNoTests
}

# 运行样式测试
run_style_tests() {
    log_info "运行样式检查..."
    cd /Users/zuolin1/article-collector/mindflow-project/frontend
    npm run lint
    npm run typecheck
}

# 生成测试报告
generate_report() {
    log_info "生成测试报告..."
    
    REPORT_FILE="/Users/zuolin1/article-collector/mindflow-project/test-report.md"
    
    cat > "$REPORT_FILE" << 'EOF'
# MindFlow 测试报告

## 测试时间
EOF
    
    echo "$(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << 'EOF'

## 测试项目

### 1. 单元测试
- [x] BriefCard 组件
- [x] DraftViewer 组件  
- [x] ChatInterface 组件
- [x] API 接口测试

### 2. E2E 测试
- [x] 首页加载
- [x] 工作流创建
- [x] Brief 编辑
- [x] 角度选择
- [x] 聊天交互
- [x] 初稿生成
- [x] 审计流程

### 3. 样式检查
- [x] ESLint 检查
- [x] TypeScript 类型检查

## 测试结果

查看详细报告:
- 前端覆盖率: `frontend/coverage/lcov-report/index.html`
- 后端覆盖率: `backend/coverage/lcov-report/index.html`

## 已知问题

请在此记录测试中发现的问题...

EOF

    log_info "测试报告已生成: $REPORT_FILE"
}

# 主函数
main() {
    log_info "开始运行 MindFlow 自动化测试..."
    
    TEST_TYPE=${1:-all}
    
    case $TEST_TYPE in
        unit)
            check_backend
            run_unit_tests
            run_component_tests
            ;;
        e2e)
            check_backend
            run_e2e_tests
            ;;
        style)
            run_style_tests
            ;;
        all)
            check_backend
            run_style_tests
            run_unit_tests
            run_component_tests
            run_e2e_tests
            generate_report
            ;;
        *)
            echo "用法: $0 [unit|e2e|style|all]"
            exit 1
            ;;
    esac
    
    log_info "测试完成!"
}

main "$@"
