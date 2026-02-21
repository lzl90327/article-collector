/**
 * 测试工具函数
 * Phase 4: API 测试辅助
 */

import request from 'supertest';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import { prismaTest } from '../setup';
import { createTestUser, TestUser } from '../fixtures/data.factory';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

/**
 * 创建测试用户并返回 token
 */
export async function createTestUserAndToken(
  override?: Partial<TestUser>
): Promise<{ user: TestUser; token: string }> {
  const userData = createTestUser(override);
  
  const user = await prismaTest.user.create({
    data: {
      id: userData.id,
      openid: userData.openid,
      nickname: userData.nickname,
      avatarUrl: userData.avatarUrl,
    },
  });

  const token = jwt.sign(
    { userId: user.id, openid: user.openid },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { user: userData, token };
}

/**
 * 创建认证请求
 */
export function authRequest(app: Express, token: string) {
  return {
    get: (url: string) =>
      request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) =>
      request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) =>
      request(app).put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) =>
      request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}

/**
 * 性能测试辅助函数
 */
export async function measurePerformance<T>(
  fn: () => Promise<T>,
  name: string
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  
  console.log(`[Performance] ${name}: ${duration}ms`);
  
  return { result, duration };
}

/**
 * 批量创建测试数据
 */
export async function batchCreate<T>(
  items: T[],
  createFn: (item: T) => Promise<any>
): Promise<void> {
  for (const item of items) {
    await createFn(item);
  }
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxAttempts - 1) {
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}
