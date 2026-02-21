/**
 * 本地存储服务
 * 封装 Taro Storage，支持草稿自动保存
 */

import Taro from '@tarojs/taro';

const STORAGE_KEYS = {
  DRAFT_PREFIX: 'draft:',
  LAST_DRAFT_ID: 'lastDraftId',
  SYNC_QUEUE: 'syncQueue',
};

// 草稿数据结构
export interface Draft {
  id: string;
  title: string;
  content: string;
  lastSaved: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
  serverId?: string;
}

// 同步队列项
interface SyncQueueItem {
  id: string;
  type: 'create' | 'update';
  data: Partial<Draft>;
  retryCount: number;
  lastAttempt: number;
}

/**
 * 保存草稿到本地
 */
export const saveDraft = async (draft: Omit<Draft, 'lastSaved' | 'syncStatus'>): Promise<Draft> => {
  const fullDraft: Draft = {
    ...draft,
    lastSaved: Date.now(),
    syncStatus: 'pending',
  };
  
  try {
    await Taro.setStorage({
      key: `${STORAGE_KEYS.DRAFT_PREFIX}${draft.id}`,
      data: fullDraft,
    });
    
    // 更新最后编辑的草稿 ID
    await Taro.setStorage({
      key: STORAGE_KEYS.LAST_DRAFT_ID,
      data: draft.id,
    });
    
    // 添加到同步队列
    await addToSyncQueue({
      id: draft.id,
      type: draft.serverId ? 'update' : 'create',
      data: { title: draft.title, content: draft.content },
      retryCount: 0,
      lastAttempt: 0,
    });
    
    return fullDraft;
  } catch (error) {
    console.error('保存草稿失败:', error);
    throw error;
  }
};

/**
 * 获取草稿
 */
export const getDraft = async (id: string): Promise<Draft | null> => {
  try {
    const { data } = await Taro.getStorage({
      key: `${STORAGE_KEYS.DRAFT_PREFIX}${id}`,
    });
    return data;
  } catch (error) {
    // 草稿不存在
    return null;
  }
};

/**
 * 获取最后编辑的草稿
 */
export const getLastDraft = async (): Promise<Draft | null> => {
  try {
    const { data: lastId } = await Taro.getStorage({
      key: STORAGE_KEYS.LAST_DRAFT_ID,
    });
    
    if (lastId) {
      return getDraft(lastId);
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * 获取所有草稿
 */
export const getAllDrafts = async (): Promise<Draft[]> => {
  try {
    const { keys } = await Taro.getStorageInfo();
    const draftKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.DRAFT_PREFIX));
    
    const drafts: Draft[] = [];
    for (const key of draftKeys) {
      const { data } = await Taro.getStorage({ key });
      drafts.push(data);
    }
    
    // 按最后保存时间排序
    return drafts.sort((a, b) => b.lastSaved - a.lastSaved);
  } catch (error) {
    console.error('获取草稿列表失败:', error);
    return [];
  }
};

/**
 * 删除草稿
 */
export const deleteDraft = async (id: string): Promise<void> => {
  try {
    await Taro.removeStorage({
      key: `${STORAGE_KEYS.DRAFT_PREFIX}${id}`,
    });
  } catch (error) {
    console.error('删除草稿失败:', error);
    throw error;
  }
};

/**
 * 更新草稿同步状态
 */
export const updateDraftSyncStatus = async (
  id: string,
  status: Draft['syncStatus'],
  serverId?: string
): Promise<void> => {
  try {
    const draft = await getDraft(id);
    if (draft) {
      draft.syncStatus = status;
      if (serverId) {
        draft.serverId = serverId;
      }
      await Taro.setStorage({
        key: `${STORAGE_KEYS.DRAFT_PREFIX}${id}`,
        data: draft,
      });
    }
  } catch (error) {
    console.error('更新同步状态失败:', error);
    throw error;
  }
};

/**
 * 添加到同步队列
 */
const addToSyncQueue = async (item: SyncQueueItem): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const existingIndex = queue.findIndex(q => q.id === item.id);
    
    if (existingIndex >= 0) {
      // 更新已有项
      queue[existingIndex] = { ...queue[existingIndex], ...item };
    } else {
      // 添加新项
      queue.push(item);
    }
    
    await Taro.setStorage({
      key: STORAGE_KEYS.SYNC_QUEUE,
      data: queue,
    });
  } catch (error) {
    console.error('添加到同步队列失败:', error);
    throw error;
  }
};

/**
 * 获取同步队列
 */
export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  try {
    const { data } = await Taro.getStorage({
      key: STORAGE_KEYS.SYNC_QUEUE,
    });
    return data || [];
  } catch (error) {
    return [];
  }
};

/**
 * 从同步队列移除
 */
export const removeFromSyncQueue = async (id: string): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const newQueue = queue.filter(item => item.id !== id);
    
    await Taro.setStorage({
      key: STORAGE_KEYS.SYNC_QUEUE,
      data: newQueue,
    });
  } catch (error) {
    console.error('从同步队列移除失败:', error);
    throw error;
  }
};

/**
 * 清空所有草稿（谨慎使用）
 */
export const clearAllDrafts = async (): Promise<void> => {
  try {
    const { keys } = await Taro.getStorageInfo();
    const draftKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.DRAFT_PREFIX));
    
    for (const key of draftKeys) {
      await Taro.removeStorage({ key });
    }
    
    await Taro.removeStorage({ key: STORAGE_KEYS.LAST_DRAFT_ID });
    await Taro.removeStorage({ key: STORAGE_KEYS.SYNC_QUEUE });
  } catch (error) {
    console.error('清空草稿失败:', error);
    throw error;
  }
};
