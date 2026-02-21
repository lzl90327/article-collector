import { get } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface SyncStatus {
  lastSyncAt: string;
  recordCount: number;
  status: 'success' | 'failed' | 'syncing';
  error?: string;
}

export const getSyncStatus = async (): Promise<Record<string, SyncStatus>> => {
  return get<Record<string, SyncStatus>>(API_ENDPOINTS.sync.status);
};
