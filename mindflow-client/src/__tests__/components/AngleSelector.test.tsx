/**
 * AngleSelector 组件单元测试
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AngleSelector } from '../../pages/workflow/components/AngleSelector';

describe('AngleSelector 组件', () => {
  const mockOnConfirm = jest.fn();
  const mockOnRefresh = jest.fn();

  const createMockAngles = (overrides = {}) => ({
    mainstream: [
      {
        title: '主流角度1',
        argument: '主流论证1',
        score: { R: 8, N: 7, C: 9 },
      },
      {
        title: '主流角度2',
        argument: '主流论证2',
        score: { R: 7, N: 8, C: 8 },
      },
    ],
    contrarian: [
      {
        title: '异见角度1',
        argument: '异见论证1',
        score: { R: 6, N: 9, C: 7 },
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确渲染角度列表', () => {
    const mockAngles = createMockAngles();

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    // 验证标题
    expect(screen.getByText('请选择切入点 (可多选)')).toBeInTheDocument();

    // 验证分类标题
    expect(screen.getByText('主流派 (Blue)')).toBeInTheDocument();
    expect(screen.getByText('异见派 (Red)')).toBeInTheDocument();

    // 验证角度卡片
    mockAngles.mainstream.forEach(angle => {
      expect(screen.getByText(angle.title)).toBeInTheDocument();
      expect(screen.getByText(angle.argument)).toBeInTheDocument();
    });

    mockAngles.contrarian.forEach(angle => {
      expect(screen.getByText(angle.title)).toBeInTheDocument();
      expect(screen.getByText(angle.argument)).toBeInTheDocument();
    });
  });

  it('应该允许选择角度', () => {
    const mockAngles = createMockAngles();

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    // 点击第一个主流角度
    const firstAngle = screen.getByText(mockAngles.mainstream[0].title);
    fireEvent.click(firstAngle);

    // 验证选中标记出现
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('应该允许多选角度', () => {
    const mockAngles = createMockAngles();

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    // 选择两个角度
    fireEvent.click(screen.getByText(mockAngles.mainstream[0].title));
    fireEvent.click(screen.getByText(mockAngles.mainstream[1].title));

    // 验证确认按钮显示选中数量
    expect(screen.getByText('确认选择 (2)')).toBeInTheDocument();
  });

  it('应该允许取消选择', () => {
    const mockAngles = createMockAngles();

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    // 选择角度
    fireEvent.click(screen.getByText(mockAngles.mainstream[0].title));
    expect(screen.getByText('确认选择 (1)')).toBeInTheDocument();

    // 再次点击取消选择
    fireEvent.click(screen.getByText(mockAngles.mainstream[0].title));
    expect(screen.getByText('确认选择 (0)')).toBeInTheDocument();
  });

  it('应该在点击确认时调用 onConfirm', () => {
    const mockAngles = createMockAngles();

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    // 选择角度
    fireEvent.click(screen.getByText(mockAngles.mainstream[0].title));

    // 输入补充想法
    const thoughtsInput = screen.getByPlaceholderText('关于这个切入点，我还有些想法...');
    fireEvent.input(thoughtsInput, { target: { value: '我的补充想法' } });

    // 点击确认
    fireEvent.click(screen.getByText('确认选择 (1)'));

    // 验证 onConfirm 被调用
    expect(mockOnConfirm).toHaveBeenCalledWith({
      selectedAngles: [mockAngles.mainstream[0].title],
      thoughts: '我的补充想法',
    });
  });

  it('应该在未选择时禁用确认按钮', () => {
    const mockAngles = createMockAngles();

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    // 验证确认按钮被禁用
    const confirmButton = screen.getByText('确认选择 (0)');
    expect(confirmButton).toBeDisabled();
  });

  it('应该在点击刷新时调用 onRefresh', () => {
    const mockAngles = createMockAngles();

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    // 点击刷新按钮
    fireEvent.click(screen.getByText('🔄 换一批'));

    // 验证 onRefresh 被调用
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('应该在 loading 时禁用确认按钮', () => {
    const mockAngles = createMockAngles();

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={true}
      />
    );

    // 选择角度使确认按钮可用
    fireEvent.click(screen.getByText(mockAngles.mainstream[0].title));

    // 验证确认按钮在 loading 时被禁用
    const confirmButton = screen.getByText('确认选择 (1)');
    expect(confirmButton).toBeDisabled();
  });

  it('应该在 data 为 null 时返回 null', () => {
    const { container } = render(
      <AngleSelector
        data={null as any}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('应该显示角度评分', () => {
    const mockAngles = createMockAngles({
      mainstream: [{
        title: '测试角度',
        argument: '测试论证',
        score: { R: 8, N: 7, C: 9 },
      }],
    });

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    // 验证评分显示
    expect(screen.getByText('相关: 8')).toBeInTheDocument();
    expect(screen.getByText('新颖: 7')).toBeInTheDocument();
    expect(screen.getByText('可信: 9')).toBeInTheDocument();
  });

  it('应该区分主流和异见标签', () => {
    const mockAngles = createMockAngles();

    render(
      <AngleSelector
        data={mockAngles}
        onConfirm={mockOnConfirm}
        onRefresh={mockOnRefresh}
        loading={false}
      />
    );

    // 验证标签
    const tags = screen.getAllByText('主流');
    expect(tags.length).toBe(mockAngles.mainstream.length);

    const contrarianTags = screen.getAllByText('异见');
    expect(contrarianTags.length).toBe(mockAngles.contrarian.length);
  });
});
