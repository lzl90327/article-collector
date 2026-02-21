/**
 * 文章管理 API 集成测试
 * Phase 4: 任务 7 - 文章 API 测试
 */

import request from 'supertest';
import express from 'express';
import routes from '../../src/routes';
// import { prismaTest } from '../setup';
import { createTestUserAndToken, authRequest, measurePerformance } from '../utils/test.utils';
import { createTestArticle, generateTestData } from '../fixtures/data.factory';

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api', routes);

describe('文章管理 API 测试', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const result = await createTestUserAndToken();
    token = result.token;
    userId = result.user.id;
  });

  describe('POST /api/articles/save', () => {
    it('应该成功创建新文章', async () => {
      const articleData = createTestArticle({ userId });

      const response = await authRequest(app, token)
        .post('/api/articles/save')
        .send({
          title: articleData.title,
          content: articleData.content,
          status: 'draft',
          phase: '3',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(articleData.title);
      expect(response.body.data.content).toBe(articleData.content);
      expect(response.body.data.id).toBeDefined();
    });

    it('应该成功更新现有文章', async () => {
      // 先创建文章
      const article = await prismaTest.article.create({
        data: {
          ...createTestArticle({ userId }),
        },
      });

      const response = await authRequest(app, token)
        .post('/api/articles/save')
        .send({
          id: article.id,
          title: '更新后的标题',
          content: '更新后的内容',
          status: 'draft',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe('更新后的标题');
    });

    it('应该验证必填字段', async () => {
      const response = await authRequest(app, token)
        .post('/api/articles/save')
        .send({
          status: 'draft',
        });

      expect(response.status).toBe(400);
    });

    it('性能测试: 创建文章响应时间 < 300ms', async () => {
      const articleData = createTestArticle({ userId });

      const { duration } = await measurePerformance(
        async () =>
          authRequest(app, token)
            .post('/api/articles/save')
            .send({
              title: articleData.title,
              content: articleData.content,
              status: 'draft',
            }),
        '创建文章'
      );

      expect(duration).toBeLessThan(300);
    });
  });

  describe('GET /api/articles', () => {
    it('应该返回文章列表', async () => {
      // 创建测试文章
      const articles = generateTestData.articles(5, userId);
      for (const article of articles) {
        await prismaTest.article.create({ data: article });
      }

      const response = await authRequest(app, token)
        .get('/api/articles?page=1&pageSize=10');

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(5);
      expect(response.body.data.total).toBe(5);
    });

    it('应该支持分页', async () => {
      // 创建 20 篇文章
      const articles = generateTestData.articles(20, userId);
      for (const article of articles) {
        await prismaTest.article.create({ data: article });
      }

      const response = await authRequest(app, token)
        .get('/api/articles?page=1&pageSize=10');

      expect(response.body.data.items).toHaveLength(10);
      expect(response.body.data.hasMore).toBe(true);
    });

    it('应该按状态过滤', async () => {
      // 创建不同状态的文章
      await prismaTest.article.create({
        data: createTestArticle({ userId, status: 'draft' }),
      });
      await prismaTest.article.create({
        data: createTestArticle({ userId, status: 'published' }),
      });

      const response = await authRequest(app, token)
        .get('/api/articles?status=draft');

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].status).toBe('draft');
    });
  });

  describe('GET /api/articles/:id', () => {
    it('应该返回文章详情', async () => {
      const article = await prismaTest.article.create({
        data: createTestArticle({ userId }),
      });

      const response = await authRequest(app, token)
        .get(`/api/articles/${article.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(article.id);
      expect(response.body.data.title).toBe(article.title);
    });

    it('应该返回 404 当文章不存在', async () => {
      const response = await authRequest(app, token)
        .get('/api/articles/non-existent-id');

      expect(response.status).toBe(404);
    });

    it('不应该返回其他用户的文章', async () => {
      // 创建另一个用户
      const otherUser = await createTestUserAndToken();
      const otherArticle = await prismaTest.article.create({
        data: createTestArticle({ userId: otherUser.user.id }),
      });

      const response = await authRequest(app, token)
        .get(`/api/articles/${otherArticle.id}`);

      expect(response.status).toBe(404);
    });
  });

  describe('错误处理测试', () => {
    it('应该处理未认证请求', async () => {
      const response = await request(app)
        .get('/api/articles')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('应该处理缺少认证头', async () => {
      const response = await request(app).get('/api/articles');

      expect(response.status).toBe(401);
    });
  });
});
