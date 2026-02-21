/**
 * Prisma Client 单例
 * 处理开发环境热重连
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// 全局声明，避免开发环境热重连时重复创建
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 创建 Prisma Client 实例
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

// 开发环境下保存到全局，避免热重连时重复创建
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 连接数据库
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('数据库连接成功');
  } catch (error) {
    logger.error('数据库连接失败', error);
    throw error;
  }
}

// 断开数据库连接
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('数据库连接已断开');
}

// 健康检查
export async function healthCheck(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default prisma;
