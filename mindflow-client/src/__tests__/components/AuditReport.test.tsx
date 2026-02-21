/**
 * AuditReport 组件单元测试
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditReport } from '../../pages/workflow/components/AuditReport';

describe('AuditReport 组件', () => {
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // 清除 console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('应该正确渲染单个审计报告', () => {
    const report = {
      auditor_role: '技术审查员',
      score: 8.5,
      criticisms: ['代码结构需要优化', '缺少注释'],
      suggestions: ['使用更清晰的命名', '添加单元测试']
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证标题
    expect(screen.getByText('赛博编辑部审计报告')).toBeInTheDocument();

    // 验证评分显示（使用 getAllByText 因为评分可能在多个地方显示）
    const scores = screen.getAllByText('8.5');
    expect(scores.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('综合评分')).toBeInTheDocument();

    // 验证审计员角色
    expect(screen.getByText('技术审查员')).toBeInTheDocument();

    // 验证批评意见
    expect(screen.getByText('批评意见:')).toBeInTheDocument();
    expect(screen.getByText('• 代码结构需要优化')).toBeInTheDocument();
    expect(screen.getByText('• 缺少注释')).toBeInTheDocument();

    // 验证改进建议
    expect(screen.getByText('改进建议:')).toBeInTheDocument();
    expect(screen.getByText('👉 使用更清晰的命名')).toBeInTheDocument();
    expect(screen.getByText('👉 添加单元测试')).toBeInTheDocument();
  });

  it('应该正确渲染多个审计报告', () => {
    const reports = [
      {
        auditor_role: '技术审查员',
        score: 8.5,
        criticisms: ['代码问题'],
        suggestions: ['改进建议1']
      },
      {
        auditor_role: '内容审查员',
        score: 9.0,
        criticisms: ['内容问题'],
        suggestions: ['改进建议2']
      }
    ];

    render(
      <AuditReport
        report={reports}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证平均评分 (8.5 + 9.0) / 2 = 8.75
    expect(screen.getByText('8.8')).toBeInTheDocument();

    // 验证两个审计员都显示
    expect(screen.getByText('技术审查员')).toBeInTheDocument();
    expect(screen.getByText('内容审查员')).toBeInTheDocument();
  });

  it('应该在点击确认按钮时调用 onConfirm', () => {
    const report = {
      auditor_role: '审查员',
      score: 8.0,
      criticisms: [],
      suggestions: []
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 点击确认按钮
    const confirmButton = screen.getByText('采纳建议并润色');
    fireEvent.click(confirmButton);

    // 验证 onConfirm 被调用
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('应该在 loading 时禁用按钮', () => {
    const report = {
      auditor_role: '审查员',
      score: 8.0,
      criticisms: [],
      suggestions: []
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={true}
      />
    );

    // 验证按钮被禁用
    const confirmButton = screen.getByText('处理中...');
    expect(confirmButton).toBeDisabled();
  });

  it('应该在 loading 时显示加载状态', () => {
    const report = {
      auditor_role: '审查员',
      score: 8.0,
      criticisms: [],
      suggestions: []
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={true}
      />
    );

    // 验证加载状态显示
    expect(screen.getByText('处理中...')).toBeInTheDocument();
  });

  it('应该在 report 为 null 时显示加载状态', () => {
    render(
      <AuditReport
        report={null as any}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证加载提示
    expect(screen.getByText('审计报告数据加载中...')).toBeInTheDocument();
  });

  it('应该在 report 为 undefined 时显示加载状态', () => {
    render(
      <AuditReport
        report={undefined as any}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证加载提示
    expect(screen.getByText('审计报告数据加载中...')).toBeInTheDocument();
  });

  it('应该在 reports 数组为空时显示提示', () => {
    render(
      <AuditReport
        report={[]}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证空报告提示
    expect(screen.getByText('暂无审计报告')).toBeInTheDocument();
  });

  it('应该处理没有批评意见的情况', () => {
    const report = {
      auditor_role: '审查员',
      score: 9.5,
      criticisms: [],
      suggestions: ['很好的工作']
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证"暂无批评意见"提示
    expect(screen.getByText('暂无批评意见')).toBeInTheDocument();
  });

  it('应该处理没有建议的情况', () => {
    const report = {
      auditor_role: '审查员',
      score: 9.5,
      criticisms: ['小问题'],
      suggestions: []
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证"暂无建议"提示
    expect(screen.getByText('暂无建议')).toBeInTheDocument();
  });

  it('应该处理 criticisms 为 undefined 的情况', () => {
    const report = {
      auditor_role: '审查员',
      score: 8.0,
      criticisms: undefined as any,
      suggestions: ['建议']
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证"暂无批评意见"提示
    expect(screen.getByText('暂无批评意见')).toBeInTheDocument();
  });

  it('应该处理 suggestions 为 undefined 的情况', () => {
    const report = {
      auditor_role: '审查员',
      score: 8.0,
      criticisms: ['批评'],
      suggestions: undefined as any
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证"暂无建议"提示
    expect(screen.getByText('暂无建议')).toBeInTheDocument();
  });

  it('应该处理 score 为 undefined 的情况', () => {
    const report = {
      auditor_role: '审查员',
      score: undefined as any,
      criticisms: [],
      suggestions: []
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证评分显示为 0.0
    expect(screen.getByText('0.0')).toBeInTheDocument();
  });

  it('应该处理 auditor_role 为 undefined 的情况', () => {
    const report = {
      auditor_role: undefined as any,
      score: 8.0,
      criticisms: [],
      suggestions: []
    };

    render(
      <AuditReport
        report={report}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证显示默认角色"审计员"
    expect(screen.getByText('审计员')).toBeInTheDocument();
  });

  it('应该正确计算平均分数', () => {
    const reports = [
      { auditor_role: '审查员1', score: 7.0, criticisms: [], suggestions: [] },
      { auditor_role: '审查员2', score: 9.0, criticisms: [], suggestions: [] },
      { auditor_role: '审查员3', score: 8.0, criticisms: [], suggestions: [] }
    ];

    render(
      <AuditReport
        report={reports}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 平均分数 (7.0 + 9.0 + 8.0) / 3 = 8.0
    expect(screen.getByText('8.0')).toBeInTheDocument();
  });

  it('应该正确处理 report 变化', () => {
    const { rerender } = render(
      <AuditReport
        report={{
          auditor_role: '初始审查员',
          score: 5.0,
          criticisms: ['初始批评'],
          suggestions: ['初始建议']
        }}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证初始内容
    expect(screen.getByText('初始审查员')).toBeInTheDocument();
    expect(screen.getByText('5.0')).toBeInTheDocument();

    // 更新 report
    rerender(
      <AuditReport
        report={{
          auditor_role: '更新审查员',
          score: 9.0,
          criticisms: ['更新批评'],
          suggestions: ['更新建议']
        }}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证更新后的内容
    expect(screen.getByText('更新审查员')).toBeInTheDocument();
    expect(screen.getByText('9.0')).toBeInTheDocument();
  });
});
