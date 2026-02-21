/**
 * ChatInterface 组件单元测试
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatInterface } from '../../pages/workflow/components/ChatInterface';

describe('ChatInterface 组件', () => {
  const mockOnSend = jest.fn();

  const createMockMessage = (overrides = {}) => ({
    role: 'user' as const,
    content: '测试消息内容',
    timestamp: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确渲染聊天界面', () => {
    const history = [
      createMockMessage({ role: 'system', content: '系统提示' }), // 会被过滤
      createMockMessage({ role: 'user', content: '用户消息' }), // index=1，会显示
      createMockMessage({ role: 'assistant', content: '助手回复' }),
    ];

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={false}
      />
    );

    // 验证消息显示（系统消息被过滤）
    expect(screen.getByText('用户消息')).toBeInTheDocument();
    expect(screen.getByText('助手回复')).toBeInTheDocument();
    // 系统消息不应该显示
    expect(screen.queryByText('系统提示')).not.toBeInTheDocument();
  });

  it('应该显示选中的角度', () => {
    const history = [createMockMessage({ role: 'user', content: '测试' })];
    const selectedAngle = '测试角度标题';

    render(
      <ChatInterface
        history={history}
        selectedAngle={selectedAngle}
        onSend={mockOnSend}
        loading={false}
      />
    );

    // 验证角度标题显示
    expect(screen.getByText('当前探讨切入点：')).toBeInTheDocument();
    expect(screen.getByText(selectedAngle)).toBeInTheDocument();
  });

  it('应该允许输入和发送消息', async () => {
    const history: ReturnType<typeof createMockMessage>[] = [];
    mockOnSend.mockResolvedValue(undefined);

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={false}
      />
    );

    // 输入消息
    const input = screen.getByPlaceholderText('输入你的想法...');
    fireEvent.change(input, { target: { value: '新消息' } });

    // 点击发送按钮
    const sendButton = screen.getByText('发送');
    fireEvent.click(sendButton);

    // 验证 onSend 被调用
    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith('新消息');
    });
  });

  it('应该在 loading 时禁用发送按钮', () => {
    const history: ReturnType<typeof createMockMessage>[] = [];

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={true}
      />
    );

    // 验证发送按钮被禁用
    const sendButton = screen.getByText('发送');
    expect(sendButton).toBeDisabled();
  });

  it('应该过滤掉系统消息和第一条用户消息', () => {
    const history = [
      createMockMessage({ role: 'system', content: '系统消息' }),
      createMockMessage({ role: 'user', content: '第一条用户消息' }), // index=1，会显示
      createMockMessage({ role: 'user', content: '第二条用户消息' }), // index=2，会显示
      createMockMessage({ role: 'assistant', content: '助手消息' }),
    ];

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={false}
      />
    );

    // 验证系统消息不显示
    expect(screen.queryByText('系统消息')).not.toBeInTheDocument();
    // 验证用户消息显示
    expect(screen.getByText('第一条用户消息')).toBeInTheDocument();
    expect(screen.getByText('第二条用户消息')).toBeInTheDocument();
    expect(screen.getByText('助手消息')).toBeInTheDocument();
  });

  it('应该区分用户和助手消息样式', () => {
    const history = [
      createMockMessage({ role: 'system', content: '系统提示' }), // 被过滤
      createMockMessage({ role: 'user', content: '用户问题' }), // index=1，显示
      createMockMessage({ role: 'assistant', content: '助手回答' }),
    ];

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={false}
      />
    );

    // 验证消息存在
    const userMessage = screen.getByText('用户问题');
    const assistantMessage = screen.getByText('助手回答');

    expect(userMessage).toBeInTheDocument();
    expect(assistantMessage).toBeInTheDocument();
  });

  it('应该在空输入时不发送消息', async () => {
    const history: ReturnType<typeof createMockMessage>[] = [];

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={false}
      />
    );

    // 不输入内容直接点击发送
    const sendButton = screen.getByText('发送');
    fireEvent.click(sendButton);

    // 验证 onSend 没有被调用
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('应该在发送后清空输入框', async () => {
    const history: ReturnType<typeof createMockMessage>[] = [];
    mockOnSend.mockResolvedValue(undefined);

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={false}
      />
    );

    // 输入消息
    const input = screen.getByPlaceholderText('输入你的想法...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '测试消息' } });

    // 发送消息
    const sendButton = screen.getByText('发送');
    fireEvent.click(sendButton);

    // 等待并验证输入框被清空
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('应该支持多行输入', () => {
    const history: ReturnType<typeof createMockMessage>[] = [];

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={false}
      />
    );

    // 验证输入框是 textarea
    const input = screen.getByPlaceholderText('输入你的想法...');
    expect(input.tagName.toLowerCase()).toBe('textarea');
  });

  it('应该过滤包含特定关键词的消息', () => {
    const history = [
      createMockMessage({ role: 'user', content: '请选择一个切入点' }), // 被过滤
      createMockMessage({ role: 'user', content: '调试模式' }), // 被过滤
      createMockMessage({ role: 'user', content: 'Selected Angles: 角度1' }), // 被过滤
      createMockMessage({ role: 'user', content: '正常用户消息' }), // index=3，显示
      createMockMessage({ role: 'assistant', content: '助手回复' }),
    ];

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={false}
      />
    );

    // 验证被过滤的消息不显示
    expect(screen.queryByText('请选择一个切入点')).not.toBeInTheDocument();
    expect(screen.queryByText('调试模式')).not.toBeInTheDocument();
    // 验证正常消息显示
    expect(screen.getByText('正常用户消息')).toBeInTheDocument();
    expect(screen.getByText('助手回复')).toBeInTheDocument();
  });

  it('应该显示深度思考中状态', () => {
    const history = [
      createMockMessage({ role: 'assistant', content: '' }), // 空内容助手消息
    ];

    render(
      <ChatInterface
        history={history}
        onSend={mockOnSend}
        loading={true}
      />
    );

    // 验证显示思考中状态
    expect(screen.getByText('深度思考中...')).toBeInTheDocument();
  });

});
