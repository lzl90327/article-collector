
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const DEDUPE_FILE = path.join(process.cwd(), 'data', 'dedupe.json');
const DATA_DIR = path.dirname(DEDUPE_FILE);

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DedupeData {
  events: Record<string, number>;
  messages: Record<string, number>;
  urls: Record<string, number>;
}

let cache: DedupeData = {
  events: {},
  messages: {},
  urls: {},
};

// 加载数据
try {
  if (fs.existsSync(DEDUPE_FILE)) {
    cache = JSON.parse(fs.readFileSync(DEDUPE_FILE, 'utf-8'));
  }
} catch (error) {
  logger.error('加载去重数据失败', error);
}

// 保存数据 (防抖)
let saveTimer: NodeJS.Timeout | null = null;
function saveData() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DEDUPE_FILE, JSON.stringify(cache, null, 2));
      saveTimer = null;
    } catch (error) {
      logger.error('保存去重数据失败', error);
    }
  }, 5000); // 5秒延迟保存
}

// 清理过期数据
const EXPIRY = {
  EVENT: 3600 * 1000, // 1小时
  MESSAGE: 24 * 3600 * 1000, // 24小时
  URL: 7 * 24 * 3600 * 1000, // 7天
};

function cleanup() {
  const now = Date.now();
  let changed = false;

  for (const key in cache.events) {
    if (now - cache.events[key] > EXPIRY.EVENT) {
      delete cache.events[key];
      changed = true;
    }
  }
  for (const key in cache.messages) {
    if (now - cache.messages[key] > EXPIRY.MESSAGE) {
      delete cache.messages[key];
      changed = true;
    }
  }
  for (const key in cache.urls) {
    if (now - cache.urls[key] > EXPIRY.URL) {
      delete cache.urls[key];
      changed = true;
    }
  }

  if (changed) saveData();
}

// 每小时清理一次
setInterval(cleanup, 3600 * 1000);

export const dedupe = {
  checkEvent: (eventId: string): boolean => {
    if (!eventId) return false;
    if (cache.events[eventId]) return true;
    cache.events[eventId] = Date.now();
    saveData();
    return false;
  },

  checkMessage: (messageId: string): boolean => {
    if (!messageId) return false;
    if (cache.messages[messageId]) return true;
    cache.messages[messageId] = Date.now();
    saveData();
    return false;
  },

  checkUrl: (url: string): boolean => {
    if (!url) return false;
    if (cache.urls[url]) return true;
    cache.urls[url] = Date.now();
    saveData();
    return false;
  }
};
