/**
 * Sessions API 测试
 */

import { createSession, listSessions, getSession, updateSession } from '../../api/sessions';
import type { Session, CreateSessionRequest } from '../../types/session';

// Mock Taro
jest.mock('@tarojs/taro', () => ({
  request: jest.fn(),
}));

import Taro from '@tarojs/taro';

describe('Sessions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('应该创建 Session', async () => {
      const mockSession: Session = {
        id: 'session-1',
        title: '测试任务',
        mode: 'scratch',
        phase: '1',
        substate: 'collecting',
        brief_confirmed: false,
        meta_json: { topic: '测试话题' },
        pending_input_def_json: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      (Taro.request as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: { session: mockSession },
        },
      });

      const result = await createSession({
        title: '测试任务',
        mode: 'scratch',
      });

      expect(result.id).toBe('session-1');
      expect(result.title).toBe('测试任务');
    });

    it('创建失败应该抛出错误', async () => {
      (Taro.request as jest.Mock).mockResolvedValue({
        data: {
          success: false,
          error: { message: '创建失败' },
        },
      });

      await expect(createSession({ title: '测试', mode: 'scratch' })).rejects.toThrow('创建失败');
    });
  });

  describe('listSessions', () => {
    it('应该返回 Session 列表', async () => {
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          title: '任务1',
          mode: 'scratch',
          phase: '1',
          substate: 'collecting',
          brief_confirmed: false,
          meta_json: {},
          pending_input_def_json: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      (Taro.request as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: { sessions: mockSessions, total: 1 },
        },
      });

      const result = await listSessions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
    });
  });

  describe('getSession', () => {
    it('应该返回单个 Session', async () => {
      const mockSession: Session = {
        id: 'session-1',
        title: '任务1',
        mode: 'scratch',
        phase: '2',
        substate: 'brief_confirmed',
        brief_confirmed: true,
        meta_json: { topic: '话题' },
        pending_input_def_json: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      (Taro.request as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: { session: mockSession },
        },
      });

      const result = await getSession('session-1');

      expect(result.id).toBe('session-1');
      expect(result.brief_confirmed).toBe(true);
    });
  });

  describe('updateSession', () => {
    it('应该更新 Session', async () => {
      const mockSession: Session = {
        id: 'session-1',
        title: '更新后的标题',
        mode: 'scratch',
        phase: '3',
        substate: 'outline_pending',
        brief_confirmed: true,
        meta_json: {},
        pending_input_def_json: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      (Taro.request as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: { session: mockSession },
        },
      });

      const result = await updateSession('session-1', { title: '更新后的标题' });

      expect(result.title).toBe('更新后的标题');
    });
  });
});
