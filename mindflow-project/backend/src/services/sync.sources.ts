import { feishuBitable } from './feishu.bitable';
import { feishuWiki } from './feishu.wiki';
import { feishuConfig, SOURCE_TYPE_MAPPING, SourceType } from '../config/feishu';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { feishuAuthDB } from '../lib/feishuAuth.db';
import { checkAndRefreshToken } from './feishu.auth.refresh';
import { processSourceAI } from './ai.processor';

export interface SourceRecord {
  id: string;
  title: string;
  url: string;
  type: SourceType;
  tags: string[];
  summary?: string;
  content?: string;
  createdAt: Date;
}

class SourceSyncService {
  /**
   * 同步素材
   * 1. 保存到知识库（子文档形式）
   * 2. 在多维表格中增加记录
   */
  async sync(): Promise<{ count: number; error?: string; details: Record<SourceType, number> }> {
    const details: Record<SourceType, number> = {
      article: 0,
      video: 0,
      audio: 0,
      image: 0,
      book: 0,
      paper: 0,
    };
    let totalCount = 0;

    try {
      // 从数据库获取待同步的素材
      const sources = await prisma.source.findMany({
        where: {
          syncStatus: 'pending',
        },
        take: 100, // 每次同步100条
      });

      for (const source of sources) {
        try {
          const sourceType = source.type as SourceType;
          const typeConfig = SOURCE_TYPE_MAPPING[sourceType];

          if (!typeConfig) {
            logger.warn(`未知的素材类型: ${sourceType}`);
            continue;
          }

          // 1. 保存到知识库（子文档）
          const wikiResult = await this.saveToWiki(source, typeConfig.wikiConfig);

          // 2. 保存到多维表格
          const bitableResult = await this.saveToBitable(source, wikiResult.url);

          // 3. 更新本地数据库状态
          await prisma.source.update({
            where: { id: source.id },
            data: {
              syncStatus: 'synced',
              feishuWikiToken: wikiResult.token,
              feishuRecordId: bitableResult.recordId,
              updatedAt: new Date(),
            },
          });

          details[sourceType]++;
          totalCount++;
          logger.info(`素材同步成功: ${source.title} -> ${typeConfig.name}素材库`);
        } catch (error: any) {
          logger.error(`素材同步失败: ${source.title}`, error);
          // 更新为失败状态
          await prisma.source.update({
            where: { id: source.id },
            data: {
              syncStatus: 'failed',
              syncError: error.message,
              updatedAt: new Date(),
            },
          });
        }
      }

      // 更新同步记录
      await this.updateSyncRecord(totalCount);

      logger.info(`素材同步完成: 总计 ${totalCount} 条`);
      return { count: totalCount, details };
    } catch (error: any) {
      logger.error('素材同步失败', error);
      await this.updateSyncRecord(0, error.message);
      return { count: 0, error: error.message, details };
    }
  }

  /**
   * 保存素材到知识库（子文档形式）
   */
  private async saveToWiki(
    source: any,
    wikiConfig: { spaceId: string; name: string }
  ): Promise<{ token: string; url: string }> {
    if (!wikiConfig.spaceId) {
      throw new Error(`知识库 ${wikiConfig.name} 未配置`);
    }

    // 构建文档内容
    const content = this.buildWikiContent(source);

    // 创建飞书文档
    const result = await feishuWiki.createDocument({
      spaceId: wikiConfig.spaceId,
      title: source.title,
      content: content,
    });

    return {
      token: result.wikiToken,
      url: result.url,
    };
  }

  /**
   * 保存素材记录到多维表格
   */
  private async saveToBitable(
    source: any,
    wikiUrl: string
  ): Promise<{ recordId: string }> {
    const config = feishuConfig.bitable.sources;

    if (!config.appToken || !config.tableId) {
      throw new Error('素材库多维表格未配置');
    }

    const typeConfig = SOURCE_TYPE_MAPPING[source.type as SourceType];

    // 构建记录字段
    const fields: Record<string, any> = {
      '标题': source.title,
      '链接': source.url,
      '类型': typeConfig?.name || source.type,
      '标签': source.tags || [],
      '摘要': source.summary || '',
      '知识库链接': wikiUrl,
      '素材库分类': typeConfig?.bitableField || '其他',
      '同步时间': new Date().toISOString(),
    };

    // 创建记录
    const result = await feishuBitable.createRecord(
      config.appToken,
      config.tableId,
      fields
    );

    return {
      recordId: result.record.record_id,
    };
  }

  /**
   * 构建知识库文档内容
   */
  private buildWikiContent(source: any): string {
    const lines = [
      `# ${source.title}`,
      '',
      `**类型**: ${source.type}`,
      `**链接**: ${source.url}`,
      '',
      '## 摘要',
      source.summary || '暂无摘要',
      '',
      '## 标签',
      source.tags?.join(', ') || '无标签',
      '',
      '---',
      `同步时间: ${new Date().toLocaleString()}`,
    ];

    return lines.join('\n');
  }

  private async updateSyncRecord(count: number, error?: string) {
    await prisma.syncRecord.create({
      data: {
        type: 'sources',
        lastSyncAt: new Date(),
        recordCount: count,
        status: error ? 'failed' : 'success',
        error,
      },
    });
  }

  /**
   * 从飞书知识库同步素材
   * 同步四个素材库（文字、视频、音频、图文）中的子文档
   * 四个素材库在同一个 space 下
   * 1. 获取 space 根节点，找到四个素材库文件夹
   * 2. 获取每个文件夹的子文档
   * 3. 保存到数据库，标签为文件夹名称
   * 4. 返回结果
   */
  async syncFromFeishu(userId?: string): Promise<{
    count: number;
    items: SourceRecord[];
    error?: string;
  }> {
    const items: SourceRecord[] = [];
    let count = 0;

    try {
      // 使用同一个 space_id（文字素材库的 space_id）
      const spaceId = feishuConfig.wiki.article.spaceId;
      if (!spaceId) {
        throw new Error('space_id 未配置');
      }

      // 定义四个素材库名称
      const sourceLibraries = [
        { key: 'article', name: '文字素材库' },
        { key: 'video', name: '视频素材库' },
        { key: 'audio', name: '音频素材库' },
        { key: 'image', name: '图文素材库' },
      ];

      // 获取 user access token
      let userAccessToken: string | undefined;
      if (userId) {
        const tokenValid = await checkAndRefreshToken(userId);
        if (!tokenValid) {
          throw new Error('授权已过期，请重新完成飞书授权');
        }
        const authInfo = await feishuAuthDB.findByUserId(userId);
        if (authInfo) {
          userAccessToken = authInfo.accessToken;
          logger.info(`使用 user access token 进行同步`);
        }
      }

      // 1. 获取 space 根节点
      logger.info(`获取知识库根节点: spaceId=${spaceId}`);
      const rootNodes = await feishuWiki.getRootNodes(spaceId, userAccessToken);
      logger.info(`获取到 ${rootNodes.items.length} 个根节点`);

      // 2. 遍历四个素材库
      for (const library of sourceLibraries) {
        logger.info(`开始同步 ${library.name}...`);

        try {
          // 在根节点中找到对应名称的节点（可能是 docx 或 wiki 类型）
          const folderNode = rootNodes.items.find(
            (node: any) => node.title === library.name
          );

          if (!folderNode) {
            logger.warn(`未找到 ${library.name} 节点`);
            continue;
          }

          logger.info(`找到 ${library.name} 节点，nodeToken=${folderNode.nodeToken}, type=${folderNode.objType}`);

          // 3. 获取节点下的子文档
          const childDocs = await feishuWiki.getChildDocuments(
            spaceId,
            folderNode.nodeToken,
            userAccessToken
          );

          logger.info(`${library.name} 下有 ${childDocs.items.length} 个子文档`);

          // 4. 保存子文档到数据库
          for (const doc of childDocs.items) {
            try {
              const sourceRecord: SourceRecord = {
                id: doc.wikiToken,
                title: doc.title,
                url: doc.url,
                type: 'article',
                tags: [library.name], // 标签为文件夹名称
                summary: '',
                content: '',
                createdAt: new Date(doc.createdAt),
              };

              await prisma.source.upsert({
                where: { id: sourceRecord.id },
                update: {
                  title: sourceRecord.title,
                  url: sourceRecord.url,
                  tags: JSON.stringify(sourceRecord.tags),
                  updatedAt: new Date(doc.updatedAt),
                  // 如果文档更新了，重置 AI 状态为 pending，触发重新处理
                  aiStatus: 'pending',
                  summary: '',
                  viewpoints: '',
                },
                create: {
                  id: sourceRecord.id,
                  title: sourceRecord.title,
                  url: sourceRecord.url,
                  type: sourceRecord.type,
                  tags: JSON.stringify(sourceRecord.tags),
                  syncStatus: 'synced',
                  feishuWikiToken: doc.wikiToken,
                  aiStatus: 'pending', // 标记为待 AI 处理
                  createdAt: new Date(doc.createdAt),
                  updatedAt: new Date(doc.updatedAt),
                },
              });

              items.push(sourceRecord);
              count++;
              logger.info(`素材同步成功: ${sourceRecord.title}, 标签: ${library.name}`);

              // 异步触发 AI 处理（不等待完成）
              processSourceAI(doc.wikiToken, doc.wikiToken, userAccessToken).catch(error => {
                logger.error(`异步 AI 处理失败: ${doc.wikiToken}`, error);
              });
            } catch (error: any) {
              logger.error(`同步素材失败: ${doc.title}`, error);
            }
          }
        } catch (error: any) {
          logger.error(`同步 ${library.name} 失败`, error);
        }
      }

      // 更新同步记录
      await this.updateSyncRecord(count);

      logger.info(`从飞书同步素材完成: 总计 ${count} 条`);

      // 同步完成后，批量处理所有 pending 的素材
      if (count > 0) {
        logger.info('开始批量处理 pending 素材的 AI 摘要...');
        this.processPendingSourcesBatch(userAccessToken).catch(error => {
          logger.error('批量处理 AI 摘要失败', error);
        });
      }

      return { count, items };
    } catch (error: any) {
      logger.error('从飞书同步素材失败', error);
      throw error;
    }
  }

  /**
   * 批量处理 pending 素材的 AI 摘要
   */
  private async processPendingSourcesBatch(userAccessToken?: string): Promise<void> {
    try {
      const pendingSources = await prisma.source.findMany({
        where: { aiStatus: 'pending' },
        take: 10, // 每次最多处理 10 个
        orderBy: { createdAt: 'asc' },
      });

      if (pendingSources.length === 0) {
        logger.info('没有 pending 的素材需要处理');
        return;
      }

      logger.info(`发现 ${pendingSources.length} 个 pending 素材，开始批量 AI 处理`);

      // 串行处理，避免 API 限流
      for (const source of pendingSources) {
        if (source.feishuWikiToken) {
          try {
            await processSourceAI(source.id, source.feishuWikiToken, userAccessToken);
            logger.info(`素材 AI 处理成功: ${source.title}`);
          } catch (error) {
            logger.error(`素材 AI 处理失败: ${source.title}`, error);
          }
          // 添加延迟，避免 API 限流
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      logger.info('批量 AI 处理完成');
    } catch (error: any) {
      logger.error('批量处理 pending 素材失败', error);
    }
  }

  /**
   * 添加测试数据（用于飞书权限不足时的测试）
   */
  private async addTestData(): Promise<{
    count: number;
    items: SourceRecord[];
    error?: string;
  }> {
    const testItems: SourceRecord[] = [
      {
        id: 'test-article-1',
        title: '测试文章：如何高效学习编程',
        url: 'https://example.com/article1',
        type: 'article',
        tags: ['学习', '编程'],
        summary: '这是一篇关于如何高效学习编程的测试文章',
        content: '',
        createdAt: new Date(),
      },
      {
        id: 'test-article-2',
        title: '测试文章：人工智能入门指南',
        url: 'https://example.com/article2',
        type: 'article',
        tags: ['AI', '入门'],
        summary: '这是一篇关于人工智能入门的测试文章',
        content: '',
        createdAt: new Date(),
      },
      {
        id: 'test-video-1',
        title: '测试视频：Python 基础教程',
        url: 'https://example.com/video1',
        type: 'video',
        tags: ['Python', '教程'],
        summary: '这是一段关于 Python 基础的测试视频',
        content: '',
        createdAt: new Date(),
      },
    ];

    const items: SourceRecord[] = [];
    let count = 0;

    for (const testItem of testItems) {
      try {
        await prisma.source.upsert({
          where: { id: testItem.id },
          update: {
            title: testItem.title,
            url: testItem.url,
            updatedAt: new Date(),
          },
          create: {
            id: testItem.id,
            title: testItem.title,
            url: testItem.url,
            type: testItem.type,
            tags: JSON.stringify(testItem.tags),
            summary: testItem.summary,
            content: testItem.content,
            syncStatus: 'synced',
            feishuWikiToken: testItem.id,
          },
        });

        items.push(testItem);
        count++;
        logger.info(`测试素材添加成功: ${testItem.title}`);
      } catch (err: any) {
        logger.error(`添加测试素材失败: ${testItem.title}`, err);
      }
    }

    await this.updateSyncRecord(count);
    logger.info(`测试数据添加完成: 总计 ${count} 条`);
    
    return { 
      count, 
      items, 
      error: '飞书权限不足，已添加测试数据供您测试功能' 
    };
  }
}

export const sourceSync = new SourceSyncService();
