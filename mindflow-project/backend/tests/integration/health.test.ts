/**
 * 健康检查测试
 * Phase 4: 基础连通性测试
 */

import request from 'supertest';
import express from 'express';

// 创建简单的测试应用
const app = express();
app.use(express.json());

// 健康检查路由
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

describe('健康检查 API', () => {
  it('应该返回服务状态', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });

  it('性能测试: 健康检查响应时间 < 100ms', async () => {
    const start = Date.now();
    await request(app).get('/health');
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
});
