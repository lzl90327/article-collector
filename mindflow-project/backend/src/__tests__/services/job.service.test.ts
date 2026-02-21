/**
 * Job Service 单元测试
 */

import {
  createJob,
  getJob,
  updateJobStatus,
  updateJobSnapshot,
  commitJob,
  cancelJob,
} from '../../services/job.service';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    session: {
      findUnique: jest.fn(),
    },
    job: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    artifact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Job Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    it('应该成功创建 Job', async () => {
      const mockSession = {
        id: 'session-1',
        brief_confirmed: true,
        phase: '3',
      };

      const mockJob = {
        id: 'job-1',
        session_id: 'session-1',
        task: 'generate_draft',
        phase: '4',
        status: 'queued',
        seq: 0,
        snapshot: '',
        inputs_json: {},
        progress_json: null,
        error_json: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (prisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);
      (prisma.job.create as jest.Mock).mockResolvedValue(mockJob);

      const result = await createJob({
        session_id: 'session-1',
        task: 'generate_draft',
        phase: '4',
      });

      expect(result.id).toBe('job-1');
      expect(result.status).toBe('queued');
      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          session_id: 'session-1',
          task: 'generate_draft',
          phase: '4',
          status: 'queued',
          seq: 0,
          snapshot: '',
          inputs_json: {},
        },
      });
    });

    it('Brief 未确认时应该抛出 BRIEF_NOT_CONFIRMED 错误', async () => {
      const mockSession = {
        id: 'session-1',
        brief_confirmed: false,
        phase: '2',
      };

      (prisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);

      await expect(
        createJob({
          session_id: 'session-1',
          task: 'generate_draft',
          phase: '4',
        })
      ).rejects.toThrow(AppError);

      await expect(
        createJob({
          session_id: 'session-1',
          task: 'generate_draft',
          phase: '4',
        })
      ).rejects.toMatchObject({
        message: 'BRIEF_NOT_CONFIRMED',
        statusCode: 409,
      });
    });

    it('Session 不存在时应该抛出 SESSION_NOT_FOUND 错误', async () => {
      (prisma.session.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        createJob({
          session_id: 'non-existent',
          task: 'generate_draft',
          phase: '4',
        })
      ).rejects.toMatchObject({
        message: 'SESSION_NOT_FOUND',
        statusCode: 500,
      });
    });
  });

  describe('getJob', () => {
    it('应该返回 Job', async () => {
      const mockJob = {
        id: 'job-1',
        session_id: 'session-1',
        task: 'generate_draft',
        phase: '4',
        status: 'running',
        seq: 10,
        snapshot: '部分内容',
        inputs_json: {},
        progress_json: { step: 'drafting', percent: 0.5 },
        error_json: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const result = await getJob('job-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('job-1');
      expect(result?.status).toBe('running');
      expect(result?.snapshot).toBe('部分内容');
    });

    it('Job 不存在时应该返回 null', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getJob('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateJobStatus', () => {
    it('应该更新 Job 状态', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'queued',
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.job.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        status: 'running',
      });

      await updateJobStatus('job-1', 'running');

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'running' },
      });
    });

    it('Job 不存在时应该抛出错误', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(updateJobStatus('non-existent', 'running')).rejects.toThrow(
        AppError
      );
    });
  });

  describe('updateJobSnapshot', () => {
    it('应该更新 Job snapshot 和 seq', async () => {
      (prisma.job.update as jest.Mock).mockResolvedValue({
        id: 'job-1',
        seq: 20,
        snapshot: '更新后的内容',
      });

      await updateJobSnapshot('job-1', 20, '更新后的内容');

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { seq: 20, snapshot: '更新后的内容' },
      });
    });
  });

  describe('commitJob', () => {
    it('应该将 Job 固化为 Artifact', async () => {
      const mockJob = {
        id: 'job-1',
        session_id: 'session-1',
        status: 'completed',
        snapshot: '生成的内容',
        task: 'generate_draft',
      };

      const mockLatestArtifact = {
        version: 2,
      };

      const mockArtifact = {
        id: 'artifact-1',
        session_id: 'session-1',
        kind: 'draft',
        version: 3,
        title: '测试标题',
        content: '生成的内容',
        meta_json: { source_task: 'generate_draft' },
        source_job_id: 'job-1',
        created_at: new Date(),
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.artifact.findFirst as jest.Mock).mockResolvedValue(mockLatestArtifact);
      (prisma.artifact.create as jest.Mock).mockResolvedValue(mockArtifact);
      (prisma.job.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        status: 'committed',
      });

      const result = await commitJob('job-1', 'draft', '测试标题');

      expect(result.id).toBe('artifact-1');
      expect(result.kind).toBe('draft');
      expect(result.version).toBe(3);
      expect(result.content).toBe('生成的内容');
    });

    it('Job 未完成时应该抛出错误', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'running',
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);

      await expect(commitJob('job-1', 'draft')).rejects.toMatchObject({
        message: 'JOB_NOT_COMPLETED',
        statusCode: 409,
      });
    });

    it('brief_card 类型不应该有版本号', async () => {
      const mockJob = {
        id: 'job-1',
        session_id: 'session-1',
        status: 'completed',
        snapshot: 'Brief 内容',
        task: 'generate_brief',
      };

      const mockArtifact = {
        id: 'artifact-1',
        session_id: 'session-1',
        kind: 'brief_card',
        version: null,
        title: 'Brief',
        content: 'Brief 内容',
        meta_json: {},
        source_job_id: 'job-1',
        created_at: new Date(),
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.artifact.create as jest.Mock).mockResolvedValue(mockArtifact);
      (prisma.job.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        status: 'committed',
      });

      const result = await commitJob('job-1', 'brief_card');

      expect(result.version).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('应该取消 Job', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'running',
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.job.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        status: 'cancelled',
      });

      await cancelJob('job-1');

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'cancelled' },
      });
    });

    it('已 committed 的 Job 不能取消', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'committed',
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);

      await expect(cancelJob('job-1')).rejects.toMatchObject({
        message: 'JOB_CANNOT_CANCEL',
        statusCode: 409,
      });
    });
  });
});
