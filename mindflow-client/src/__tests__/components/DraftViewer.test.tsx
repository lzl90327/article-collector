/**
 * DraftViewer 组件单元测试
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DraftViewer } from '../../pages/workflow/components/DraftViewer';

describe('DraftViewer 组件', () => {
  const mockOnConfirm = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确渲染草稿内容', () => {
    const draft = '这是文章草稿内容。\n\n这是第二段。';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证标题（带emoji）
    expect(screen.getByText('📝 文章初稿')).toBeInTheDocument();

    // 验证草稿内容显示
    expect(screen.getByText('这是文章草稿内容。')).toBeInTheDocument();
    expect(screen.getByText('这是第二段。')).toBeInTheDocument();
  });

  it('应该在点击确认按钮时调用 onConfirm', () => {
    const draft = '测试草稿';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 点击确认按钮
    const confirmButton = screen.getByText('确认并审计');
    fireEvent.click(confirmButton);

    // 验证 onConfirm 被调用
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('应该在点击返回按钮时调用 onBack', () => {
    const draft = '测试草稿';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
        loading={false}
      />
    );

    // 点击返回按钮
    const backButton = screen.getByText('返回修改');
    fireEvent.click(backButton);

    // 验证 onBack 被调用
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('应该在 loading 时禁用按钮', () => {
    const draft = '测试草稿';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={true}
      />
    );

    // 验证确认按钮被禁用
    const confirmButton = screen.getByText('提交中...');
    expect(confirmButton).toBeDisabled();
  });

  it('应该在 loading 时显示加载状态', () => {
    const draft = '测试草稿';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={true}
      />
    );

    // 验证加载状态显示（按钮显示"提交中..."）
    expect(screen.getByText('提交中...')).toBeInTheDocument();
  });

  it('应该处理长文本内容', () => {
    const draft = '第一段内容。\n\n第二段内容。\n\n第三段内容。\n\n第四段内容。';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证所有段落都显示
    expect(screen.getByText('第一段内容。')).toBeInTheDocument();
    expect(screen.getByText('第二段内容。')).toBeInTheDocument();
    expect(screen.getByText('第三段内容。')).toBeInTheDocument();
    expect(screen.getByText('第四段内容。')).toBeInTheDocument();
  });

  it('应该处理特殊字符', () => {
    const draft = '特殊字符：!@#$%^&*()_+{}|:"<>?~`';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证特殊字符正确显示
    expect(screen.getByText(/特殊字符/)).toBeInTheDocument();
  });

  it('应该处理中文字符', () => {
    const draft = '这是一篇中文文章。\n\n包含多行内容。';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证中文内容显示
    expect(screen.getByText('这是一篇中文文章。')).toBeInTheDocument();
    expect(screen.getByText('包含多行内容。')).toBeInTheDocument();
  });

  it('应该在 draft 为空时正确渲染', () => {
    const draft = '';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证标题仍然显示
    expect(screen.getByText('📝 文章初稿')).toBeInTheDocument();
    // 验证按钮仍然显示
    expect(screen.getByText('确认并审计')).toBeInTheDocument();
  });

  it('应该在 draft 变化时更新内容', () => {
    const { rerender } = render(
      <DraftViewer
        draft="初始内容"
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证初始内容
    expect(screen.getByText('初始内容')).toBeInTheDocument();

    // 更新 draft
    rerender(
      <DraftViewer
        draft="更新后的内容"
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证更新后的内容
    expect(screen.getByText('更新后的内容')).toBeInTheDocument();
  });

  it('应该正确渲染 Markdown 标题', () => {
    const draft = '# 一级标题\n\n## 二级标题\n\n### 三级标题';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证标题内容显示（去掉markdown标记）
    expect(screen.getByText('一级标题')).toBeInTheDocument();
    expect(screen.getByText('二级标题')).toBeInTheDocument();
    expect(screen.getByText('三级标题')).toBeInTheDocument();
  });

  it('应该正确渲染列表项', () => {
    const draft = '- 列表项1\n\n- 列表项2\n\n1. 数字列表';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证列表项内容显示（组件会在列表项前添加 • 符号）
    expect(screen.getByText('• 列表项1')).toBeInTheDocument();
    expect(screen.getByText('• 列表项2')).toBeInTheDocument();
    expect(screen.getByText('1. 数字列表')).toBeInTheDocument();
  });

  it('应该正确渲染引用', () => {
    const draft = '> 这是一段引用';

    render(
      <DraftViewer
        draft={draft}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证引用内容显示（去掉引用标记）
    expect(screen.getByText('这是一段引用')).toBeInTheDocument();
  });
});
