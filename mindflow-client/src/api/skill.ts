import { get } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface SkillConfig {
  version: string;
  name: string;
  config: any;
}

export interface SkillVersion {
  id: string;
  version: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export const getSkillConfig = async (): Promise<SkillConfig> => {
  return get<SkillConfig>(API_ENDPOINTS.skill.config);
};

export const getSkillVersions = async (): Promise<SkillVersion[]> => {
  return get<SkillVersion[]>(API_ENDPOINTS.skill.versions);
};

export const compareSkillVersions = async (v1: string, v2: string): Promise<any> => {
  return get(API_ENDPOINTS.skill.compare, { v1, v2 });
};
