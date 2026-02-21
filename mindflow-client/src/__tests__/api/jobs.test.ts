/**
 * Jobs API 测试
 */

import { createJob, getJob, commitJob, cancelJob } from '../../api/jobs';
import type { Job, CreateJobRequest } from '../../types/job';

// Mock Taro
jest.mock('@tarojs/taro', () => ({
  request: jest.fn(),
}));

import Taro from '@tarojs/taro';

describe('Jobs API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    it('应该创建 Job', async () => {
      (Taro.request as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: {
            job: {
              job_id: 'job-1',
              status: 'queued',
              seq: 0,
            },
          },
        },
      });

      const result = await createJob({
        session_id: 'session-1',
        task: 'generate_draft',
        phase: '4',
      });

      expect(result.job_id).toBe('job-1');
      expect(result.status).toBe('queued');
    });
  });

  describe('getJob', () => {
    it('应该返回 Job 详情', async () => {
      (Taro.request as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: {
            job: {
              job_id: 'job-1',
              session_id: 'session-1',
              task: 'generate_draft',
              status: 'completed',
              seq: 100,
              snapshot: '生成的内容',
              progress: null,
              error: null,
              updated_at: '2024-01-01T00:00:00Z',
            },
          },
        },
      });

      const result = await getJob('job-1');

      expect(result.job_id).toBe('job-1');
      expect(result.status).toBe('completed');
      expect(result.snapshot).toBe('生成的内容');
    });
  });

  describe('commitJob', () => {
    it('应该固化为 Artifact', async () => {
      (Taro.request as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: {
            artifact: {
              artifact_id: 'artifact-1',
              kind: 'draft',
              version: 1,
              title: '草稿标题',
              created_at: '2024-01-01T00:00:00Z',
            },
          },
        },
      });

      const result = await commitJob('job-1', {
        artifact_kind: 'draft',
        mode: 'new_version',
        title: '草稿标题',
      });

      expect(result.artifact_id).toBe('artifact-1');
      expect(result.version).toBe(1);
    });
  });

  describe('cancelJob', () => {
    it('应该取消 Job', async () => {
      (Taro.request as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: {
            success: true,
            job_id: 'job-1',
            status: 'cancelled',
          },
        },
      });

      const result = await cancelJob('job-1');

      expect(result.job_id).toBe('job-1');
      expect(result.status).toBe('cancelled');
    });
  });
});
