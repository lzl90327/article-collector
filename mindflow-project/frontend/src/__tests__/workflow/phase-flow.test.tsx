/**
 * 完整流程测试
 * 测试从 Brief 到最终发布的完整流程
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkflowPage from '../../pages/workflow/index';

// Mock Taro
jest.mock('@tarojs/taro', () => ({
  useRouter: () => ({ params: { id: 'test-workflow-id' } }),
  showToast: jest.fn(),
  showModal: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  setClipboardData: jest.fn(),
  navigateTo: jest.fn(),
  redirectTo: jest.fn(),
}));

// Mock API
jest.mock('../../api', () => ({
  getWorkflowState: jest.fn(),
  triggerPhase: jest.fn(),
  sendChatMessage: jest.fn(),
  sendChatMessageStream: jest.fn(),
}));

import { getWorkflowState, triggerPhase, sendChatMessage } from '../../api';

describe('MindFlow 完整流程测试', () => {
  const mockGetWorkflowState = getWorkflowState as jest.MockedFunction<typeof getWorkflowState>;
  const mockTriggerPhase = triggerPhase as jest.MockedFunction<typeof triggerPhase>;
  const mockSendChatMessage = sendChatMessage as jest.MockedFunction<typeof sendChatMessage>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 测试 Phase -1: Brief 阶段
  describe('Phase -1: Brief', () => {
    it('应该显示 Brief 卡片', async () => {
      // 模拟后端返回的数据结构
      mockGetWorkflowState.mockResolvedValue({
        workflowId: 'test-workflow-id',
        currentPhase: -1,
        mode: 'argument_mode',
        fields: {},
        artifacts: {},
        completedActions: [],
        pendingInput: null,
        metadata: { version: 1 },
        context: {
          brief: {
            thesis: '测试核心主张',
            target_audience: '测试目标读者',
            existing_belief: '测试读者现状',
            change_goal: '测试改变目标',
          }
        },
        history: []
      });

      render(<WorkflowPage />);

      await waitFor(() => {
        expect(screen.getByText('写作 Brief (可微调)')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('应该能确认 Brief 并进入角度选择', async () => {
      mockGetWorkflowState.mockResolvedValue({
        workflowId: 'test-workflow-id',
        currentPhase: -1,
        mode: 'argument_mode',
        fields: {},
        artifacts: {},
        completedActions: [],
        pendingInput: null,
        metadata: { version: 1 },
        context: {
          brief: { thesis: '测试', target_audience: '测试', existing_belief: '测试', change_goal: '测试' }
        },
        history: []
      });

      mockSendChatMessage.mockResolvedValue({});
      mockTriggerPhase.mockResolvedValue({
        workflowId: 'test-workflow-id',
        currentPhase: 1.5,
        mode: 'argument_mode',
        fields: {},
        artifacts: {},
        completedActions: ['brief_confirmed'],
        pendingInput: null,
        metadata: { version: 1 },
        context: {
          angles: ['角度1', '角度2', '角度3']
        },
        history: []
      });

      render(<WorkflowPage />);

      await waitFor(() => {
        expect(screen.getByText('确认并生成切入点')).toBeInTheDocument();
      }, { timeout: 3000 });

      fireEvent.click(screen.getByText('确认并生成切入点'));

      await waitFor(() => {
        expect(mockTriggerPhase).toHaveBeenCalledWith('test-workflow-id', expect.any(Object));
      }, { timeout: 3000 });
    });
  });

  // 测试 Phase 1.5: 角度选择
  describe('Phase 1.5: 角度选择', () => {
    it('应该显示角度选择器', async () => {
      mockGetWorkflowState.mockResolvedValue({
        workflowId: 'test-workflow-id',
        currentPhase: 1.5,
        mode: 'argument_mode',
        fields: {},
        artifacts: {},
        completedActions: [],
        pendingInput: null,
        metadata: { version: 1 },
        context: {
          angles: ['角度1', '角度2', '角度3']
        },
        history: []
      });

      render(<WorkflowPage />);

      await waitFor(() => {
        expect(screen.getByText(/选择切入角度/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  // 测试 Phase 4: 初稿阶段
  describe('Phase 4: 初稿', () => {
    it('应该显示文章初稿', async () => {
      mockGetWorkflowState.mockResolvedValue({
        workflowId: 'test-workflow-id',
        currentPhase: 4,
        mode: 'argument_mode',
        fields: {},
        artifacts: {},
        completedActions: [],
        pendingInput: null,
        metadata: { version: 1 },
        context: {
          draft: '这是测试文章初稿内容'
        },
        history: []
      });

      render(<WorkflowPage />);

      await waitFor(() => {
        expect(screen.getByText(/文章初稿/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  // 测试 Phase 4.5: 审计阶段
  describe('Phase 4.5: 审计', () => {
    it('应该显示审计报告', async () => {
      mockGetWorkflowState.mockResolvedValue({
        workflowId: 'test-workflow-id',
        currentPhase: 4.5,
        mode: 'argument_mode',
        fields: {},
        artifacts: {},
        completedActions: [],
        pendingInput: null,
        metadata: { version: 1 },
        context: {
          audit: {
            score: 85,
            issues: []
          }
        },
        history: []
      });

      render(<WorkflowPage />);

      await waitFor(() => {
        expect(screen.getByText(/审计报告/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  // 测试 Phase ID 类型转换
  describe('Phase ID 类型处理', () => {
    it('应该正确处理数值类型的 currentPhase', async () => {
      mockGetWorkflowState.mockResolvedValue({
        workflowId: 'test-workflow-id',
        currentPhase: -1,  // 数值类型
        mode: 'argument_mode',
        fields: {},
        artifacts: {},
        completedActions: [],
        pendingInput: null,
        metadata: { version: 1 },
        context: {
          brief: { thesis: '测试', target_audience: '测试', existing_belief: '测试', change_goal: '测试' }
        },
        history: []
      });

      render(<WorkflowPage />);

      await waitFor(() => {
        // 应该显示 Brief 阶段的内容，而不是 "未知阶段"
        expect(screen.getByText('写作 Brief (可微调)')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('应该正确处理字符串类型的 currentPhaseId', async () => {
      mockGetWorkflowState.mockResolvedValue({
        workflowId: 'test-workflow-id',
        currentPhaseId: '-1',  // 字符串类型
        mode: 'argument_mode',
        fields: {},
        artifacts: {},
        completedActions: [],
        pendingInput: null,
        metadata: { version: 1 },
        context: {
          brief: { thesis: '测试', target_audience: '测试', existing_belief: '测试', change_goal: '测试' }
        },
        history: []
      });

      render(<WorkflowPage />);

      await waitFor(() => {
        // 应该显示 Brief 阶段的内容
        expect(screen.getByText('写作 Brief (可微调)')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
