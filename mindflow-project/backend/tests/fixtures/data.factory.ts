/**
 * 测试数据工厂
 * Phase 4: 生成测试数据
 */

import { faker } from '@faker-js/faker/locale/zh_CN';

// 测试用户
export interface TestUser {
  id: string;
  openid: string;
  nickname: string;
  avatarUrl: string;
  createdAt: Date;
}

// 测试文章
export interface TestArticle {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  phase: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// 测试素材
export interface TestSource {
  id: string;
  title: string;
  url: string;
  type: 'article' | 'video' | 'audio' | 'image';
  userId: string;
  createdAt: Date;
}

/**
 * 生成测试用户
 */
export const createTestUser = (override?: Partial<TestUser>): TestUser => ({
  id: faker.string.uuid(),
  openid: faker.string.alphanumeric(28),
  nickname: faker.person.fullName(),
  avatarUrl: faker.image.avatar(),
  createdAt: new Date(),
  ...override,
});

/**
 * 生成测试文章
 */
export const createTestArticle = (override?: Partial<TestArticle>): TestArticle => ({
  id: faker.string.uuid(),
  title: faker.lorem.sentence({ min: 3, max: 8 }),
  content: faker.lorem.paragraphs({ min: 3, max: 10 }),
  status: 'draft',
  phase: '3',
  userId: faker.string.uuid(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

/**
 * 生成测试素材
 */
export const createTestSource = (override?: Partial<TestSource>): TestSource => ({
  id: faker.string.uuid(),
  title: faker.lorem.sentence({ min: 2, max: 5 }),
  url: faker.internet.url(),
  type: 'article',
  userId: faker.string.uuid(),
  createdAt: new Date(),
  ...override,
});

/**
 * 批量生成测试数据
 */
export const generateTestData = {
  // 生成 10 个测试用户
  users: (count = 10): TestUser[] => {
    return Array.from({ length: count }, () => createTestUser());
  },

  // 生成 50 个测试文章
  articles: (count = 50, userId?: string): TestArticle[] => {
    return Array.from({ length: count }, () =>
      createTestArticle({ userId: userId || faker.string.uuid() })
    );
  },

  // 生成 100 个测试素材
  sources: (count = 100, userId?: string): TestSource[] => {
    return Array.from({ length: count }, () =>
      createTestSource({ userId: userId || faker.string.uuid() })
    );
  },
};
