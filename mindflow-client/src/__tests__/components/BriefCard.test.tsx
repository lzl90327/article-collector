/**
 * BriefCard 组件单元测试
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

    // 验证内容
    expect(screen.getByDisplayValue(mockBrief.thesis)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockBrief.target_audience)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockBrief.existing_belief)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockBrief.change_goal)).toBeInTheDocument();
  });

  it('应该允许编辑 Brief 内容', () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 编辑核心主张
    const thesisInput = screen.getByDisplayValue(mockBrief.thesis);
    fireEvent.input(thesisInput, { target: { value: '新的核心主张' } });

    // 编辑目标读者
    const audienceInput = screen.getByDisplayValue(mockBrief.target_audience);
    fireEvent.input(audienceInput, { target: { value: '新的目标读者' } });

    // 验证输入已更新
    expect(screen.getByDisplayValue('新的核心主张')).toBeInTheDocument();
    expect(screen.getByDisplayValue('新的目标读者')).toBeInTheDocument();
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

  it('应该在确认时传递更新后的数据', () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 编辑内容
    const thesisInput = screen.getByDisplayValue(mockBrief.thesis);
    fireEvent.input(thesisInput, { target: { value: '更新后的主张' } });

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
    expect(screen.getByDisplayValue(mockBrief.thesis)).toBeInTheDocument();

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
    expect(screen.getByDisplayValue('更新后的核心主张')).toBeInTheDocument();
  });

  it('应该正确处理所有字段的编辑', () => {
    const mockBrief = createMockBrief();

    render(
      <BriefCard
        data={mockBrief}
        onConfirm={mockOnConfirm}
        loading={false}
      />
    );

    // 编辑所有字段
    fireEvent.input(screen.getByDisplayValue(mockBrief.thesis), {
      target: { value: '新主张' },
    });
    fireEvent.input(screen.getByDisplayValue(mockBrief.target_audience), {
      target: { value: '新读者' },
    });
    fireEvent.input(screen.getByDisplayValue(mockBrief.existing_belief), {
      target: { value: '新现状' },
    });
    fireEvent.input(screen.getByDisplayValue(mockBrief.change_goal), {
      target: { value: '新目标' },
    });

    // 点击确认
    fireEvent.click(screen.getByText('确认并生成切入点'));

    // 验证所有字段都被更新
    expect(mockOnConfirm).toHaveBeenCalledWith({
      thesis: '新主张',
      target_audience: '新读者',
      existing_belief: '新现状',
      change_goal: '新目标',
    });
  });
});
