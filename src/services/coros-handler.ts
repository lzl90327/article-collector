/**
 * COROS 运动截图处理服务
 * 处理运动截图的识别、卡片生成、多维表格写入等
 */

import { larkClient, createLarkClient } from './lark-client';
import { logger } from '../utils/logger';
import {
  SportRecord,
  parseSportScreenshot,
  generateDedupeKey,
  SPORT_TYPE_LABELS,
  SPORT_TYPE_OPTIONS,
} from './coros-ocr-parser';
import { corosBitableConfig, corosFieldConfig, baiduOCRConfig, corosLarkConfig } from '../config';

// COROS 专用的 larkClient（使用独立凭证访问 COROS 多维表格）
const corosLarkClient = corosLarkConfig.useOwnCredentials
  ? createLarkClient(corosLarkConfig.appId, corosLarkConfig.appSecret)
  : larkClient;

/**
 * COROS 配置接口
 */
export interface CorosConfig {
  appToken: string;
  tableId: string;
  fields: typeof corosFieldConfig;
}

/**
 * 获取 COROS 配置
 */
export function getCorosConfig(): CorosConfig {
  return {
    appToken: corosBitableConfig.appToken,
    tableId: corosBitableConfig.tableId,
    fields: corosFieldConfig,
  };
}

/**
 * 检查 COROS 功能是否启用
 */
export function isCorosEnabled(): boolean {
  return corosBitableConfig.enabled;
}

/**
 * 处理运动截图消息
 * @param imageBuffer 图片数据
 * @param imageKey 图片 key（用于追溯）
 * @param messageId 消息 ID
 * @param chatId 会话 ID
 * @param openId 用户 ID
 */
export async function handleSportScreenshot(
  imageBuffer: Buffer,
  imageKey: string,
  messageId: string,
  chatId: string,
  openId: string
): Promise<void> {
  logger.info(`开始处理运动截图: ${imageKey}`);

  try {
    // 1. 解析运动截图
    const parseResult = await parseSportScreenshot(imageBuffer, {
      apiKey: baiduOCRConfig.apiKey,
    });

    // 2. 生成原始凭证
    const rawEvidence = JSON.stringify({
      image_key: imageKey,
      message_id: messageId,
      received_at: new Date().toISOString(),
      raw_text: parseResult.rawText,
    });

    // 3. 生成去重键
    const dedupeKey = generateDedupeKey(parseResult);

    // 4. 检查去重
    const existingRecords = await queryCorosRecords();
    const isDup = checkDuplicate(dedupeKey, existingRecords);

    // 5. 发送交互卡片
    const card = createSportRecordCard(parseResult, rawEvidence, dedupeKey, isDup);
    await larkClient.sendInteractiveCard(openId, card);

    logger.info(`运动截图处理完成，发送确认卡片`);
  } catch (error) {
    logger.error('处理运动截图失败:', error);
    await larkClient.sendMessage(openId, '❌ 处理运动截图失败，请稍后重试');
    throw error;
  }
}

/**
 * 创建运动记录交互卡片
 * 不使用 form 表单，直接使用按钮携带预填充数据
 */
export function createSportRecordCard(
  parseResult: SportRecord,
  rawEvidence: string,
  dedupeKey: string,
  isDuplicate: boolean
): any {
  const confidenceColor =
    parseResult.confidence >= 0.8
      ? 'green'
      : parseResult.confidence >= 0.6
        ? 'orange'
        : 'red';

  // 获取运动类型标签
  const sportLabel = SPORT_TYPE_LABELS[parseResult.sportType as keyof typeof SPORT_TYPE_LABELS] || parseResult.sportType;

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: isDuplicate ? '⚠️ 运动记录（可能重复）' : '📊 运动记录识别结果',
      },
      template: confidenceColor,
    },
    elements: [
      // 显示识别结果
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**运动类型**: ${sportLabel}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**日期**: ${parseResult.startDate || '今天'}`,
            },
          },
        ],
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**距离**: ${parseResult.distanceKm ? parseResult.distanceKm + ' km' : '-'}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**时长**: ${parseResult.durationMin ? parseResult.durationMin + ' 分钟' : '-'}`,
            },
          },
        ],
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**爬升**: ${parseResult.elevationM ? parseResult.elevationM + ' m' : '-'}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**置信度**: ${(parseResult.confidence * 100).toFixed(0)}%`,
            },
          },
        ],
      },
      {
        tag: 'hr',
      },
      // 操作按钮
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: isDuplicate ? '⚠️ 确认写入（可能重复）' : '✅ 确认写入',
            },
            type: 'primary',
            // 精简 value，只包含必要数据（raw_evidence 太长会导致 200340 错误）
            value: JSON.stringify({
              action: 'coros_confirm_write',
              sport_type: parseResult.sportType,
              start_date: parseResult.startDate || new Date().toISOString().split('T')[0],
              distance_km: parseResult.distanceKm,
              elevation_m: parseResult.elevationM,
              duration_min: parseResult.durationMin,
              dedupe_key: dedupeKey,
              confidence: parseResult.confidence,
            }),
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '❌ 取消',
            },
            type: 'danger',
            value: JSON.stringify({
              action: 'coros_cancel',
            }),
          },
        ],
      },
      {
        tag: 'hr',
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `原始识别: ${parseResult.rawText?.substring(0, 100) || ''}...`,
          },
        ],
      },
    ],
  };
}

/**
 * 处理运动记录卡片回调 - 确认写入
 * 数据直接从按钮的 value 中获取（不使用 form）
 * 注意：长连接模式需要主动调用 API 更新卡片，不支持通过返回值更新
 */
export async function handleCorosConfirmWrite(
  actionData: Record<string, any>,
  messageId: string,
  openId: string
): Promise<void> {
  logger.info('处理运动记录确认写入', { actionData, messageId });

  const config = getCorosConfig();
  const { fields } = config;

  try {
    // 从 actionData 提取数据（按钮 value 中携带）
    const sportType = actionData.sport_type || '';
    const startDate = actionData.start_date || '';
    const distanceKm = actionData.distance_km || null;
    const elevationM = actionData.elevation_m || null;
    const durationMin = actionData.duration_min || null;
    const dedupeKey = actionData.dedupe_key || '';
    const confidence = actionData.confidence || 0;

    logger.debug('解析数据:', { sportType, startDate, distanceKm, elevationM, durationMin });

    // 构建多维表格字段（raw_evidence 不再从按钮传递，避免数据过长）
    const recordFields: Record<string, any> = {
      [fields.source]: '飞书机器人',
      [fields.confidence]: confidence,
      [fields.dedupeKey]: dedupeKey,
    };

    // 日期（转换为 Unix 时间戳，单位：毫秒）
    if (startDate) {
      try {
        const dateObj = new Date(startDate);
        if (!isNaN(dateObj.getTime())) {
          recordFields[fields.date] = dateObj.getTime();
        }
      } catch (error) {
        logger.error(`日期转换失败: ${startDate}`, error);
      }
    }

    // 运动类型
    recordFields[fields.sport] = SPORT_TYPE_LABELS[sportType as keyof typeof SPORT_TYPE_LABELS] || sportType;

    // 距离（根据运动类型）
    if (sportType === 'run' && distanceKm) {
      recordFields[fields.runKm] = distanceKm;
    } else if (sportType === 'ride' && distanceKm) {
      recordFields[fields.rideKm] = distanceKm;
    }

    // 爬升
    if (elevationM) {
      recordFields[fields.elevM] = elevationM;
    }

    // 备注（时长）
    const durationText = durationMin ? `时长: ${durationMin}分钟` : '';
    if (durationText) {
      recordFields[fields.notes] = durationText;
    }

    logger.info('准备写入字段:', recordFields);

    // 写入多维表格
    await createCorosRecord(recordFields);

    logger.info('运动记录写入成功');

    // 发送成功反馈消息
    const sportLabel = SPORT_TYPE_LABELS[sportType as keyof typeof SPORT_TYPE_LABELS] || sportType;
    const successMsg = `✅ 运动记录已成功写入！\n\n` +
      `📅 日期: ${startDate}\n` +
      `🏃 类型: ${sportLabel}\n` +
      (distanceKm ? `📏 距离: ${distanceKm} km\n` : '') +
      (elevationM ? `⛰️ 爬升: ${elevationM} m\n` : '') +
      (durationMin ? `⏱️ 时长: ${durationMin} 分钟\n` : '');

    if (messageId) {
      await larkClient.replyMessage(messageId, successMsg);
    }

    // 更新卡片为成功状态
    if (messageId) {
      await updateCard(messageId, {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: '✅ 记录已成功写入' },
          template: 'green',
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**${sportLabel}** ${distanceKm ? distanceKm + 'km' : ''} ${elevationM ? elevationM + 'm爬升' : ''} ${durationMin ? durationMin + '分钟' : ''}`,
            },
          },
        ],
      });
    }

  } catch (error) {
    logger.error('写入运动记录失败:', error);

    // 发送失败消息
    const errorMsg = `❌ 写入失败: ${error instanceof Error ? error.message : '未知错误'}`;
    if (messageId) {
      await larkClient.replyMessage(messageId, errorMsg);
    }

    // 更新卡片为失败状态
    if (messageId) {
      await updateCard(messageId, {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: '❌ 写入失败' },
          template: 'red',
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `写入失败: ${error instanceof Error ? error.message : '未知错误'}`,
            },
          },
        ],
      });
    }
  }
}

/**
 * 更新卡片内容
 */
async function updateCard(messageId: string, card: any): Promise<void> {
  try {
    const axios = (await import('axios')).default;
    const { default: config } = await import('../config');
    
    // 获取 access token（使用 COROS 凭证）
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: config.COROS_LARK_APP_ID || config.LARK_APP_ID,
        app_secret: config.COROS_LARK_APP_SECRET || config.LARK_APP_SECRET,
      }
    );
    const accessToken = tokenResponse.data.tenant_access_token;

    // 更新卡片
    await axios.patch(
      `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`,
      {
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.debug('卡片更新成功');
  } catch (error) {
    logger.warn('更新卡片失败:', error);
    // 不抛出错误，数据已写入成功
  }
}

/**
 * 处理运动记录卡片回调 - 取消
 */
export async function handleCorosCancel(messageId: string): Promise<void> {
  logger.info('用户取消运动记录操作');

  // 发送取消反馈
  if (messageId) {
    await larkClient.replyMessage(messageId, '❌ 已取消，本次运动记录未写入。');
  }

  // 更新卡片为取消状态
  if (messageId) {
    await updateCard(messageId, {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '❌ 已取消' },
        template: 'red',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: '操作已取消，本次记录未写入。',
          },
        },
      ],
    });
  }
}

/**
 * 创建 COROS 运动记录
 * 使用 COROS 专用凭证访问多维表格
 */
async function createCorosRecord(fields: Record<string, any>): Promise<{ recordId: string }> {
  const config = getCorosConfig();

  logger.info('写入 COROS 运动记录');
  logger.debug(`使用凭证: ${corosLarkConfig.useOwnCredentials ? 'COROS专用' : '默认'}`);

  const response = await corosLarkClient.post(
    `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`,
    { fields }
  );

  if (response.code !== 0) {
    throw new Error(`写入记录失败: ${response.msg}`);
  }

  const recordId = response.data?.record?.record_id;
  logger.info(`记录写入成功: ${recordId}`);

  return { recordId };
}

/**
 * 查询 COROS 运动记录（用于去重）
 * 使用 COROS 专用凭证访问多维表格
 */
async function queryCorosRecords(): Promise<any[]> {
  const config = getCorosConfig();

  try {
    logger.debug(`查询 COROS 记录，使用凭证: ${corosLarkConfig.useOwnCredentials ? 'COROS专用' : '默认'}`);
    
    const response = await corosLarkClient.post(
      `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/search`,
      {
        page_size: 100,
        sort: [{ field_name: config.fields.date, desc: true }],
      }
    );

    if (response.code !== 0) {
      logger.warn(`查询记录失败: ${response.msg}`);
      return [];
    }

    return response.data?.items || [];
  } catch (error) {
    logger.warn('查询记录失败', error);
    return [];
  }
}

/**
 * 检查是否重复
 */
function checkDuplicate(dedupeKey: string, existingRecords: any[]): boolean {
  const config = getCorosConfig();

  for (const record of existingRecords) {
    const existingKey = record.fields?.[config.fields.dedupeKey];
    if (existingKey === dedupeKey) {
      logger.info(`检测到重复记录: ${dedupeKey}`);
      return true;
    }
  }

  return false;
}
