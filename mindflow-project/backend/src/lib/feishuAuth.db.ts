import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface FeishuAuthRecord {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  openId: string;
  createdAt: Date;
  updatedAt: Date;
}

// 文件存储路径
const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_FILE = path.join(DATA_DIR, 'feishu-auth.json');

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    logger.info('创建数据目录', { path: DATA_DIR });
  }
}

// 读取所有授权记录
function readAuthFile(): Map<string, FeishuAuthRecord> {
  try {
    ensureDataDir();
    if (!fs.existsSync(AUTH_FILE)) {
      return new Map();
    }
    const data = fs.readFileSync(AUTH_FILE, 'utf-8');
    const records = JSON.parse(data);
    const map = new Map<string, FeishuAuthRecord>();
    for (const [userId, record] of Object.entries(records)) {
      map.set(userId, {
        ...record as FeishuAuthRecord,
        expiresAt: new Date((record as FeishuAuthRecord).expiresAt),
        createdAt: new Date((record as FeishuAuthRecord).createdAt),
        updatedAt: new Date((record as FeishuAuthRecord).updatedAt),
      });
    }
    return map;
  } catch (error) {
    logger.error('读取授权文件失败', error);
    return new Map();
  }
}

// 写入所有授权记录
function writeAuthFile(records: Map<string, FeishuAuthRecord>) {
  try {
    ensureDataDir();
    const obj: Record<string, FeishuAuthRecord> = {};
    for (const [userId, record] of records) {
      obj[userId] = record;
    }
    fs.writeFileSync(AUTH_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    logger.info('授权信息已保存到文件', { path: AUTH_FILE });
  } catch (error) {
    logger.error('写入授权文件失败', error);
    throw error;
  }
}

export class FeishuAuthDB {
  private records: Map<string, FeishuAuthRecord>;

  constructor() {
    this.records = readAuthFile();
    logger.info('FeishuAuthDB 初始化完成', { count: this.records.size });
  }

  /**
   * 保存或更新用户的飞书授权信息
   */
  async upsert(userId: string, data: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    openId: string;
  }): Promise<void> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const record: FeishuAuthRecord = {
        id,
        userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        openId: data.openId,
        createdAt: now,
        updatedAt: now,
      };

      this.records.set(userId, record);
      writeAuthFile(this.records);

      logger.info('飞书授权信息已保存', { userId });
    } catch (error) {
      logger.error('保存飞书授权信息失败', error);
      throw error;
    }
  }

  /**
   * 获取用户的飞书授权信息
   */
  async findByUserId(userId: string): Promise<FeishuAuthRecord | null> {
    try {
      // 重新读取文件以获取最新数据
      this.records = readAuthFile();
      return this.records.get(userId) || null;
    } catch (error) {
      logger.error('查询飞书授权信息失败', error);
      return null;
    }
  }

  /**
   * 更新授权信息
   */
  async update(userId: string, data: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }): Promise<void> {
    try {
      const record = this.records.get(userId);
      if (record) {
        record.accessToken = data.accessToken;
        record.refreshToken = data.refreshToken;
        record.expiresAt = data.expiresAt;
        record.updatedAt = new Date();
        writeAuthFile(this.records);
        logger.info('飞书授权信息已更新', { userId });
      }
    } catch (error) {
      logger.error('更新飞书授权信息失败', error);
      throw error;
    }
  }
}

export const feishuAuthDB = new FeishuAuthDB();
