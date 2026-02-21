/**
 * Jobs Routes 集成测试
 */

import request from 'supertest';
import app from '../../server';
import { prisma } from '../../lib/prisma';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    session: {
      findUnique: jest.fn(),
    },
    job: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    artifact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Jobs Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/jobs', () => {
    it('应该创建 Job', async () => {
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
      };

      (prisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);
      (prisma.job.create as jest.Mock).mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/jobs')
        .send({
          session_id: 'session-1',
          task: 'generate_draft',
          phase: '4',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job.job_id).toBe('job-1');
      expect(response.body.data.job.status).toBe('queued');
    });

    it('缺少必填字段应该返回 400', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          session_id: 'session-1',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('Brief 未确认应该返回 409', async () => {
      const mockSession = {
        id: 'session-1',
        brief_confirmed: false,
        phase: '2',
      };

      (prisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);

      const response = await request(app)
        .post('/api/jobs')
        .send({
          session_id: 'session-1',
          task: 'generate_draft',
          phase: '4',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('BRIEF_NOT_CONFIRMED');
    });
  });

  describe('GET /api/jobs/:jobId', () => {
    it('应该返回 Job 详情', async () => {
      const mockJob = {
        id: 'job-1',
        session_id: 'session-1',
        task: 'generate_draft',
        phase: '4',
        status: 'running',
        seq: 10,
        snapshot: '部分内容',
        progress_json: { step: 'drafting', percent: 0.5 },
        error_json: null,
        updated_at: new Date(),
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const response = await request(app).get('/api/jobs/job-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job.job_id).toBe('job-1');
      expect(response.body.data.job.status).toBe('running');
      expect(response.body.data.job.snapshot).toBe('部分内容');
    });

    it('Job 不存在应该返回 404', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/jobs/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('JOB_NOT_FOUND');
    });
  });

  describe('POST /api/jobs/:jobId/commit', () => {
    it('应该固化为 Artifact', async () => {
      const mockJob = {
        id: 'job-1',
        session_id: 'session-1',
        status: 'completed',
        snapshot: '生成的内容',
        task: 'generate_draft',
      };

      const mockArtifact = {
        id: 'artifact-1',
        session_id: 'session-1',
        kind: 'draft',
        version: 1,
        title: '测试标题',
        content: '生成的内容',
        meta_json: {},
        source_job_id: 'job-1',
        created_at: new Date(),
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.artifact.create as jest.Mock).mockResolvedValue(mockArtifact);
      (prisma.job.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        status: 'committed',
      });

      const response = await request(app)
        .post('/api/jobs/job-1/commit')
        .send({
          artifact_kind: 'draft',
          mode: 'new_version',
          title: '测试标题',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.artifact.artifact_id).toBe('artifact-1');
      expect(response.body.data.artifact.kind).toBe('draft');
    });

    it('缺少必填字段应该返回 400', async () => {
      const response = await request(app)
        .post('/api/jobs/job-1/commit')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /api/jobs/:jobId/cancel', () => {
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

      const response = await request(app).post('/api/jobs/job-1/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });
  });

  describe('GET /api/jobs/:jobId/poll', () => {
    it('应该返回 Job 状态和事件', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'running',
        seq: 10,
        updated_at: new Date(),
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/jobs/job-1/poll')
        .query({ afterSeq: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job.job_id).toBe('job-1');
      expect(Array.isArray(response.body.data.events)).toBe(true);
    });

    it('Job 不存在应该返回 404', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/jobs/non-existent/poll');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('JOB_NOT_FOUND');
    });
  });
});
