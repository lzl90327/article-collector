/**
 * 飞书素材库服务
 * Phase 0: 素材获取
 */

import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

// 飞书素材库配置
const FEISHU_MATERIALS_CONFIG = {
  appToken: process.env.FEISHU_MATERIALS_APP_TOKEN || '',
  tableId: process.env.FEISHU_MATERIALS_TABLE_ID || '',
};

/**
 * 素材记录
 */
export interface MaterialRecord {
  id: string;
  title: string;
  author: string;
  publishTime?: string;
  source: string;
  originalUrl?: string;
  summary: string;
  docUrl?: string;
  collectTime: string;
}

/**
 * 获取素材列表
 * @param limit 数量限制
 * @param days 最近几天
 */
export async function getMaterials(
  limit: number = 10,
  days?: number
): Promise<MaterialRecord[]> {
  try {
    // 构建过滤条件
    const filter: any = {
      conjunction: 'and',
      conditions: [
        {
          field_name: '收藏时间',
          operator: 'isNotEmpty',
          value: [],
        },
      ],
    };

    if (days) {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - days);
      filter.conditions.push({
        field_name: '收藏时间',
        operator: 'isGreater',
        value: [startTime.getTime()],
      });
    }

    // 调用飞书 API
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_MATERIALS_CONFIG.appToken}/tables/${FEISHU_MATERIALS_CONFIG.tableId}/records/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getTenantAccessToken()}`,
        },
        body: JSON.stringify({
          filter,
          sort: [
            {
              field_name: '收藏时间',
              desc: true,
            },
          ],
          page_size: limit,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Feishu API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    // 解析记录
    const records = data.data?.items || [];
    return records.map((record: any) => parseMaterialRecord(record));
  } catch (error) {
    logger.error('Get materials failed:', error);
    // 返回模拟数据用于开发
    return getMockMaterials(limit);
  }
}

/**
 * 搜索素材
 * @param keyword 关键词
 * @param limit 数量限制
 */
export async function searchMaterials(
  keyword: string,
  limit: number = 10
): Promise<MaterialRecord[]> {
  try {
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_MATERIALS_CONFIG.appToken}/tables/${FEISHU_MATERIALS_CONFIG.tableId}/records/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getTenantAccessToken()}`,
        },
        body: JSON.stringify({
          filter: {
            conjunction: 'or',
            conditions: [
              {
                field_name: '标题',
                operator: 'contains',
                value: [keyword],
              },
              {
                field_name: '摘要',
                operator: 'contains',
                value: [keyword],
              },
            ],
          },
          page_size: limit,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Feishu API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    const records = data.data?.items || [];
    return records.map((record: any) => parseMaterialRecord(record));
  } catch (error) {
    logger.error('Search materials failed:', error);
    return [];
  }
}

/**
 * 获取单个素材详情
 * @param recordId 记录ID
 */
export async function getMaterialDetail(
  recordId: string
): Promise<MaterialRecord | null> {
  try {
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_MATERIALS_CONFIG.appToken}/tables/${FEISHU_MATERIALS_CONFIG.tableId}/records/${recordId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await getTenantAccessToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Feishu API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    return parseMaterialRecord(data.data?.record);
  } catch (error) {
    logger.error('Get material detail failed:', error);
    return null;
  }
}

/**
 * 解析素材记录
 */
function parseMaterialRecord(record: any): MaterialRecord {
  const fields = record.fields || {};

  return {
    id: record.record_id || record.id,
    title: fields['标题']?.[0]?.text || fields['标题'] || '未命名',
    author: fields['作者']?.[0]?.text || fields['作者'] || '未知',
    publishTime: fields['发布时间'],
    source: fields['来源']?.[0]?.text || fields['来源'] || '未知',
    originalUrl: fields['原文链接']?.link || fields['原文链接'],
    summary: fields['摘要'] || '',
    docUrl: fields['文档链接']?.link || fields['文档链接'],
    collectTime: fields['收藏时间'],
  };
}

/**
 * 获取租户访问令牌
 */
async function getTenantAccessToken(): Promise<string> {
  // 简化版：从集成表中获取
  const integration = await prisma.integration.findFirst({
    where: {
      provider: 'feishu',
      status: 'connected',
    },
  });

  if (!integration) {
    throw new Error('Feishu not connected');
  }

  const credential = integration.credential_json as any;
  return credential.access_token;
}

/**
 * 获取模拟素材数据（开发用）
 */
function getMockMaterials(limit: number): MaterialRecord[] {
  const mockData: MaterialRecord[] = [
    {
      id: 'rec-001',
      title: '独家对话OpenAI姚顺雨：生成新世界的系统',
      author: '张小珺',
      source: '微信公众号',
      summary: 'OpenAI研究员姚顺雨分享了对AI系统未来的看法，探讨了生成式AI如何重塑世界...',
      collectTime: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'rec-002',
      title: '飞猪AI测试新范式：维护降70%、漏测减半',
      author: '杨飞',
      source: '知乎',
      summary: '飞猪团队在AI测试领域的创新实践，通过AI辅助实现了测试效率的显著提升...',
      collectTime: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'rec-003',
      title: 'AI产品经理的底层逻辑：从工具思维到伙伴思维',
      author: '纯银',
      source: '即刻',
      summary: '探讨AI时代产品经理的思维转变，从将AI视为工具到视为合作伙伴...',
      collectTime: new Date(Date.now() - 259200000).toISOString(),
    },
    {
      id: 'rec-004',
      title: '银发经济的AI入口：为什么最终决定爸妈用哪个AI的，可能是你',
      author: '行业观察',
      source: '36氪',
      summary: '深入分析银发经济中AI产品的切入点，揭示子女在老人AI产品选择中的关键作用...',
      collectTime: new Date(Date.now() - 345600000).toISOString(),
    },
    {
      id: 'rec-005',
      title: '大模型时代的认知外包：思考的质量如何被重新定义',
      author: '认知科学',
      source: '得到',
      summary: '探讨大模型对人类认知方式的影响，以及如何在AI辅助下保持独立思考...',
      collectTime: new Date(Date.now() - 432000000).toISOString(),
    },
  ];

  return mockData.slice(0, limit);
}

/**
 * 保存素材到本地（用于"存播客"/"存文章"）
 */
export async function saveMaterial(
  data: {
    title: string;
    author: string;
    source: string;
    summary: string;
    originalUrl?: string;
  }
): Promise<MaterialRecord> {
  // 这里应该调用飞书 API 创建记录
  // 简化版：返回模拟数据
  return {
    id: `rec-${Date.now()}`,
    title: data.title,
    author: data.author,
    source: data.source,
    summary: data.summary,
    originalUrl: data.originalUrl,
    collectTime: new Date().toISOString(),
  };
}
