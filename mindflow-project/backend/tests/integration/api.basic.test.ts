/**
 * 基础 API 测试
 * Phase 4: 无需数据库的 API 测试
 */

import request from 'supertest';
import express from 'express';

// 创建测试应用
const app = express();
app.use(express.json());

// 模拟路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/echo', (req, res) => {
  res.json({ received: req.body });
});

app.get('/api/error', (req, res) => {
  res.status(500).json({ error: 'Test error' });
});

describe('基础 API 测试', () => {
  describe('GET /api/health', () => {
    it('应该返回健康状态', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });

    it('性能测试: 响应时间 < 100ms', async () => {
      const start = Date.now();
      await request(app).get('/api/health');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
    });
  });

  describe('POST /api/echo', () => {
    it('应该返回请求体', async () => {
      const testData = { message: 'Hello', count: 42 };
      
      const response = await request(app)
        .post('/api/echo')
        .send(testData);
      
      expect(response.status).toBe(200);
      expect(response.body.received).toEqual(testData);
    });

    it('应该处理空请求体', async () => {
      const response = await request(app)
        .post('/api/echo')
        .send({});
      
      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({});
    });
  });

  describe('错误处理', () => {
    it('应该返回 500 错误', async () => {
      const response = await request(app).get('/api/error');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Test error');
    });

    it('应该处理 404 路由', async () => {
      const response = await request(app).get('/api/not-found');
      
      expect(response.status).toBe(404);
    });
  });

  describe('并发测试', () => {
    it('应该处理并发请求', async () => {
      const promises = Array.from({ length: 10 }, () => 
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });
});
