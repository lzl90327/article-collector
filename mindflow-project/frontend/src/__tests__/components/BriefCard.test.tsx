/**
 * BriefCard 组件单元测试
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BriefCard } from '../../pages/workflow/components/BriefCard';

describe('BriefCard 组件', () => {
  const mockOnConfirm = jest.fn();

  const createMockBrief = (overrides = {}) => ({
    thesis: '测试核心主张',
    target_audience: '测试目标读者',
    existing_belief: '测试读者现状',
    change_goal: '测试改变目标',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确渲染 Brief 数据', () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证标题
    expect(screen.getByText('写作 Brief (可微调)')).toBeInTheDocument();

    // 验证各个字段标签
    expect(screen.getByText('核心主张 (Thesis)')).toBeInTheDocument();
    expect(screen.getByText('目标读者')).toBeInTheDocument();
    expect(screen.getByText('读者现状')).toBeInTheDocument();
    expect(screen.getByText('改变目标')).toBeInTheDocument();

    // 验证内容（使用 getByText 替代 getByDisplayValue）
    expect(screen.getByText(mockBrief.thesis)).toBeInTheDocument();
    expect(screen.getByText(mockBrief.target_audience)).toBeInTheDocument();
    expect(screen.getByText(mockBrief.existing_belief)).toBeInTheDocument();
    expect(screen.getByText(mockBrief.change_goal)).toBeInTheDocument();
  });

  it('应该允许编辑 Brief 内容', async () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 点击编辑按钮打开弹窗
    const editButtons = screen.getAllByText('点击编辑');
    fireEvent.click(editButtons[0]);

    // 等待弹窗出现
    await waitFor(() => {
      expect(screen.getByText('编辑: 核心主张 (Thesis)')).toBeInTheDocument();
    });

    // 验证弹窗中的 textarea 有正确的值
    const textarea = document.querySelector('.edit-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe(mockBrief.thesis);

    // 关闭弹窗
    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);
  });

  it('应该在点击确认按钮时调用 onConfirm', () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 点击确认按钮
    const confirmButton = screen.getByText('确认并生成切入点');
    fireEvent.click(confirmButton);

    // 验证 onConfirm 被调用
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).toHaveBeenCalledWith(mockBrief);
  });

  it('应该在确认时传递更新后的数据', async () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 点击编辑按钮
    const editButtons = screen.getAllByText('点击编辑');
    fireEvent.click(editButtons[0]);

    // 等待弹窗
    await waitFor(() => {
      expect(screen.getByText('编辑: 核心主张 (Thesis)')).toBeInTheDocument();
    });

    // 修改 textarea 的值
    const textarea = document.querySelector('.edit-textarea') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: '更新后的主张' } });

    // 点击保存
    const saveButton = screen.getByText('保存');
    fireEvent.click(saveButton);

    // 等待弹窗关闭
    await waitFor(() => {
      expect(screen.queryByText('编辑: 核心主张 (Thesis)')).not.toBeInTheDocument();
    });

    // 点击确认按钮
    const confirmButton = screen.getByText('确认并生成切入点');
    fireEvent.click(confirmButton);

    // 验证传递的数据包含更新
    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        thesis: '更新后的主张',
        target_audience: mockBrief.target_audience,
        existing_belief: mockBrief.existing_belief,
        change_goal: mockBrief.change_goal,
      })
    );
  });

  it('应该在 loading 状态时禁用按钮', () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={true}
      />
    );

    // 验证按钮被禁用
    const confirmButton = screen.getByText('确认并生成切入点');
    expect(confirmButton).toBeDisabled();
  });

  it('应该在 loading 时显示加载状态', () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={true}
      />
    );

    // 验证按钮显示加载状态
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('应该在 data 为 null 时返回 null', () => {
    const { container } = render(
      <BriefCard
        data={null as any}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 组件应该返回 null
    expect(container.firstChild).toBeNull();
  });

  it('应该在 data 变化时更新表单', () => {
    const mockBrief = createMockBrief();

    const { rerender } = render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证初始值
    expect(screen.getByText(mockBrief.thesis)).toBeInTheDocument();

    // 更新 props
    const updatedBrief = createMockBrief({
      thesis: '更新后的核心主张',
    });

    rerender(
      <BriefCard
        data={updatedBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 验证表单已更新
    expect(screen.getByText('更新后的核心主张')).toBeInTheDocument();
  });

  it('应该正确处理所有字段的编辑', async () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 编辑第一个字段（核心主张）
    const editButtons = screen.getAllByText('点击编辑');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('编辑: 核心主张 (Thesis)')).toBeInTheDocument();
    });

    const textarea = document.querySelector('.edit-textarea') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: '新主张' } });

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(screen.queryByText('编辑: 核心主张 (Thesis)')).not.toBeInTheDocument();
    });

    // 点击确认
    fireEvent.click(screen.getByText('确认并生成切入点'));

    // 验证字段被更新
    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        thesis: '新主张',
      })
    );
  });
});
