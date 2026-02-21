/**
 * 话题队列服务
 * 话题队列管理（add/list/update）
 */

import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

/**
 * 话题状态
 */
export type TopicStatus = 'pending' | 'in_progress' | 'completed' | 'archived';

/**
 * 话题优先级
 */
export type TopicPriority = 'high' | 'medium' | 'low';

/**
 * 话题
 */
export interface Topic {
  id: string;
  title: string;
  description?: string;
  status: TopicStatus;
  priority: TopicPriority;
  tags: string[];
  source?: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
}

/**
 * 添加话题到队列
 */
export async function addTopic(data: {
  title: string;
  description?: string;
  priority?: TopicPriority;
  tags?: string[];
  source?: string;
  scheduledAt?: string;
}): Promise<Topic> {
  try {
    const topic = await prisma.topicQueue.create({
      data: {
        title: data.title,
        description: data.description,
        status: 'pending',
        priority: data.priority || 'medium',
        tags: data.tags || [],
        source: data.source,
        scheduled_at: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });

    return mapToTopic(topic);
  } catch (error) {
    logger.error('Add topic failed:', error);
    throw error;
  }
}

/**
 * 获取话题列表
 */
export async function listTopics(options?: {
  status?: TopicStatus;
  priority?: TopicPriority;
  limit?: number;
  offset?: number;
}): Promise<{ topics: Topic[]; total: number }> {
  try {
    const where: any = {};
    
    if (options?.status) {
      where.status = options.status;
    }
    
    if (options?.priority) {
      where.priority = options.priority;
    }

    const [topics, total] = await Promise.all([
      prisma.topicQueue.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { created_at: 'desc' },
        ],
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.topicQueue.count({ where }),
    ]);

    return {
      topics: topics.map(mapToTopic),
      total,
    };
  } catch (error) {
    logger.error('List topics failed:', error);
    throw error;
  }
}

/**
 * 获取单个话题
 */
export async function getTopic(id: string): Promise<Topic | null> {
  try {
    const topic = await prisma.topicQueue.findUnique({
      where: { id },
    });

    if (!topic) {
      return null;
    }

    return mapToTopic(topic);
  } catch (error) {
    logger.error('Get topic failed:', error);
    throw error;
  }
}

/**
 * 更新话题
 */
export async function updateTopic(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    status: TopicStatus;
    priority: TopicPriority;
    tags: string[];
    sessionId: string;
    scheduledAt: string;
  }>
): Promise<Topic> {
  try {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.sessionId !== undefined) updateData.session_id = data.sessionId;
    if (data.scheduledAt !== undefined) {
      updateData.scheduled_at = data.scheduledAt ? new Date(data.scheduledAt) : null;
    }

    const topic = await prisma.topicQueue.update({
      where: { id },
      data: updateData,
    });

    return mapToTopic(topic);
  } catch (error) {
    logger.error('Update topic failed:', error);
    throw error;
  }
}

/**
 * 删除话题
 */
export async function deleteTopic(id: string): Promise<boolean> {
  try {
    await prisma.topicQueue.delete({
      where: { id },
    });

    return true;
  } catch (error) {
    logger.error('Delete topic failed:', error);
    return false;
  }
}

/**
 * 标记话题为进行中
 */
export async function startTopic(id: string, sessionId: string): Promise<Topic> {
  return updateTopic(id, {
    status: 'in_progress',
    sessionId,
  });
}

/**
 * 标记话题为已完成
 */
export async function completeTopic(id: string): Promise<Topic> {
  return updateTopic(id, {
    status: 'completed',
  });
}

/**
 * 归档话题
 */
export async function archiveTopic(id: string): Promise<Topic> {
  return updateTopic(id, {
    status: 'archived',
  });
}

/**
 * 获取待办话题（按优先级排序）
 */
export async function getPendingTopics(limit: number = 10): Promise<Topic[]> {
  const { topics } = await listTopics({
    status: 'pending',
    limit,
  });

  return topics;
}

/**
 * 搜索话题
 */
export async function searchTopics(query: string): Promise<Topic[]> {
  try {
    const topics = await prisma.topicQueue.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    return topics.map(mapToTopic);
  } catch (error) {
    logger.error('Search topics failed:', error);
    throw error;
  }
}

/**
 * 映射数据库记录到 Topic
 */
function mapToTopic(record: any): Topic {
  return {
    id: record.id,
    title: record.title,
    description: record.description || undefined,
    status: record.status as TopicStatus,
    priority: record.priority as TopicPriority,
    tags: record.tags || [],
    source: record.source || undefined,
    sessionId: record.session_id || undefined,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
    scheduledAt: record.scheduled_at?.toISOString(),
  };
}
