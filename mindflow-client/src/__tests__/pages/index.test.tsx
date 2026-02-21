/**
 * 工作台首页测试
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import IndexPage from '../../pages/index/index';

// Mock Taro
jest.mock('@tarojs/taro', () => ({
  getCurrentInstance: () => ({
    router: { params: {} },
  }),
  navigateTo: jest.fn(),
  navigateBack: jest.fn(),
  showToast: jest.fn(),
  showModal: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  request: jest.fn(),
}));

// Mock API
jest.mock('../../api/sessions', () => ({
  listSessions: jest.fn(),
  createSession: jest.fn(),
}));

import { listSessions, createSession } from '../../api/sessions';
import Taro from '@tarojs/taro';

describe('IndexPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该显示加载状态', () => {
    (listSessions as jest.Mock).mockImplementation(() => new Promise(() => {}));
    
    render(<IndexPage />);
    
    expect(screen.getByText('工作台')).toBeInTheDocument();
  });

  it('应该显示 Session 列表', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        title: '测试任务1',
        mode: 'scratch',
        phase: '2',
        substate: 'brief_confirmed',
        brief_confirmed: true,
        meta_json: { topic: '测试话题' },
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'session-2',
        title: '测试任务2',
        mode: 'scratch',
        phase: '4',
        substate: 'draft_pending',
        brief_confirmed: true,
        meta_json: {},
        updated_at: '2024-01-02T00:00:00Z',
      },
    ];

    (listSessions as jest.Mock).mockResolvedValue(mockSessions);

    render(<IndexPage />);

    await waitFor(() => {
      expect(screen.getByText('测试任务1')).toBeInTheDocument();
      expect(screen.getByText('测试任务2')).toBeInTheDocument();
    });
  });

  it('应该显示空状态', async () => {
    (listSessions as jest.Mock).mockResolvedValue([]);

    render(<IndexPage />);

    await waitFor(() => {
      expect(screen.getByText('还没有写作任务')).toBeInTheDocument();
    });
  });

  it('点击新建任务应该创建 Session', async () => {
    (listSessions as jest.Mock).mockResolvedValue([]);
    (createSession as jest.Mock).mockResolvedValue({
      id: 'new-session',
      title: '新写作任务',
    });

    render(<IndexPage />);

    await waitFor(() => {
      expect(screen.getByText('还没有写作任务')).toBeInTheDocument();
    });

    // 点击"开始第一个任务"按钮
    const createButton = screen.getByText('开始第一个任务');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        title: '新写作任务',
        mode: 'scratch',
      });
    });
  });
});
