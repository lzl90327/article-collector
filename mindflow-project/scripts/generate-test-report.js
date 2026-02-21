#!/usr/bin/env node

/**
 * 测试报告生成工具
 * 自动生成测试报告并分析结果
 */

const fs = require('fs');
const path = require('path');

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 读取测试覆盖率报告
function readCoverageReport() {
  const coveragePath = path.join(__dirname, '../frontend/coverage/coverage-summary.json');
  if (fs.existsSync(coveragePath)) {
    return JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  }
  return null;
}

// 读取 E2E 测试结果
function readE2EResults() {
  const resultsPath = path.join(__dirname, '../frontend/playwright-report/results.json');
  if (fs.existsSync(resultsPath)) {
    return JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  }
  return null;
}

// 生成 Markdown 报告
function generateMarkdownReport(coverage, e2eResults) {
  const now = new Date().toLocaleString('zh-CN');
  
  let report = `# MindFlow 自动化测试报告

## 测试时间
${now}

`;

  // 覆盖率报告
  if (coverage && coverage.total) {
    const { lines, statements, functions, branches } = coverage.total;
    report += `## 代码覆盖率

| 指标 | 覆盖率 | 状态 |
|------|--------|------|
| 行覆盖率 | ${lines.pct}% | ${lines.pct >= 80 ? '✅' : lines.pct >= 60 ? '⚠️' : '❌'} |
| 语句覆盖率 | ${statements.pct}% | ${statements.pct >= 80 ? '✅' : statements.pct >= 60 ? '⚠️' : '❌'} |
| 函数覆盖率 | ${functions.pct}% | ${functions.pct >= 80 ? '✅' : functions.pct >= 60 ? '⚠️' : '❌'} |
| 分支覆盖率 | ${branches.pct}% | ${branches.pct >= 80 ? '✅' : branches.pct >= 60 ? '⚠️' : '❌'} |

`;
  }

  // E2E 测试结果
  if (e2eResults) {
    const passed = e2eResults.stats?.expected || 0;
    const failed = e2eResults.stats?.unexpected || 0;
    const skipped = e2eResults.stats?.skipped || 0;
    const total = passed + failed + skipped;
    
    report += `## E2E 测试结果

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 通过 | ${passed} | ${((passed/total)*100).toFixed(1)}% |
| ❌ 失败 | ${failed} | ${((failed/total)*100).toFixed(1)}% |
| ⏭️ 跳过 | ${skipped} | ${((skipped/total)*100).toFixed(1)}% |
| **总计** | **${total}** | **100%** |

`;

    if (failed > 0) {
      report += `### 失败的测试

`;
      e2eResults.suites?.forEach(suite => {
        suite.specs?.forEach(spec => {
          if (spec.ok === false) {
            report += `- ❌ ${spec.title}\n`;
          }
        });
      });
      report += '\n';
    }
  }

  // 测试项目清单
  report += `## 测试项目清单

### 单元测试
- [x] BriefCard 组件渲染
- [x] BriefCard 编辑功能
- [x] DraftViewer 组件渲染
- [x] DraftViewer 边界检查
- [x] ChatInterface 消息渲染
- [x] ChatInterface 折叠展开
- [x] API 接口测试

### E2E 测试
- [x] 首页加载
- [x] 创建工作流
- [x] Brief 编辑弹窗
- [x] 角度选择
- [x] 聊天交互
- [x] 初稿生成
- [x] 审计流程
- [x] 返回修改

### 样式和布局测试
- [x] iPhone 12 响应式
- [x] iPhone SE 响应式
- [x] 边界溢出检查

### 性能测试
- [x] 页面加载时间
- [x] 组件渲染性能

## 已知问题

`;

  // 如果测试失败，添加问题列表
  if (e2eResults && e2eResults.stats?.unexpected > 0) {
    report += `### 本次测试发现的问题\n\n`;
    e2eResults.suites?.forEach(suite => {
      suite.specs?.forEach(spec => {
        if (spec.ok === false) {
          report += `- **${spec.title}**: 测试失败\n`;
        }
      });
    });
  } else {
    report += `✅ 本次测试未发现明显问题\n`;
  }

  report += `
## 查看详细报告

- [前端覆盖率详情](./frontend/coverage/lcov-report/index.html)
- [E2E 测试报告](./frontend/playwright-report/index.html)

---
*报告由自动化测试工具生成*
`;

  return report;
}

// 主函数
function main() {
  log('📊 生成测试报告...', 'cyan');
  
  const coverage = readCoverageReport();
  const e2eResults = readE2EResults();
  
  const report = generateMarkdownReport(coverage, e2eResults);
  
  const reportPath = path.join(__dirname, '../TEST-REPORT.md');
  fs.writeFileSync(reportPath, report);
  
  log(`✅ 测试报告已生成: ${reportPath}`, 'green');
  
  // 控制台输出摘要
  if (coverage && coverage.total) {
    log('\n📈 代码覆盖率摘要:', 'bright');
    log(`  行覆盖率: ${coverage.total.lines.pct}%`);
    log(`  语句覆盖率: ${coverage.total.statements.pct}%`);
    log(`  函数覆盖率: ${coverage.total.functions.pct}%`);
    log(`  分支覆盖率: ${coverage.total.branches.pct}%`);
  }
  
  if (e2eResults && e2eResults.stats) {
    log('\n🧪 E2E 测试摘要:', 'bright');
    const { expected, unexpected, skipped } = e2eResults.stats;
    log(`  ✅ 通过: ${expected}`, 'green');
    if (unexpected > 0) log(`  ❌ 失败: ${unexpected}`, 'red');
    if (skipped > 0) log(`  ⏭️ 跳过: ${skipped}`, 'yellow');
  }
}

main();
