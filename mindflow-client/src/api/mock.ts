/**
 * Mock数据
 * 用于本地自测
 */

import type { Session } from '../types/session';
import type { Source } from '../types/source';
import type { Artifact } from '../types/artifact';

// Mock Sessions
export const mockSessions: Session[] = [
  {
    id: 'session-001',
    title: 'AI写作助手产品介绍',
    mode: 'scratch',
    phase: 'draft',
    substate: 'collecting',
    pending_input: null,
    state_json: { context: {}, history: [] },
    meta_json: { topic: '介绍MindFlow AI写作助手的功能和优势' },
    brief_confirmed: false,
    created_at: '2026-02-21T10:00:00.000Z',
    updated_at: '2026-02-21T10:30:00.000Z',
  },
  {
    id: 'session-002',
    title: '技术博客：React最佳实践',
    mode: 'scratch',
    phase: 'brief',
    substate: 'brief_pending',
    pending_input: null,
    state_json: { context: {}, history: [] },
    meta_json: { topic: '分享React开发中的最佳实践和技巧' },
    brief_confirmed: false,
    created_at: '2026-02-21T09:00:00.000Z',
    updated_at: '2026-02-21T09:15:00.000Z',
  },
  {
    id: 'session-003',
    title: '产品发布文案',
    mode: 'scratch',
    phase: 'outline',
    substate: 'outline_confirmed',
    pending_input: null,
    state_json: { context: {}, history: [] },
    meta_json: { topic: '新产品发布的新闻稿和社交媒体文案' },
    brief_confirmed: true,
    created_at: '2026-02-20T14:00:00.000Z',
    updated_at: '2026-02-20T16:30:00.000Z',
  },
  {
    id: 'session-004',
    title: '用户手册编写',
    mode: 'scratch',
    phase: 'draft',
    substate: 'completed',
    pending_input: null,
    state_json: { context: {}, history: [] },
    meta_json: { topic: '产品用户手册的编写和整理' },
    brief_confirmed: true,
    created_at: '2026-02-19T10:00:00.000Z',
    updated_at: '2026-02-20T18:00:00.000Z',
  },
];

// Mock Sources
export const mockSources: Source[] = [
  {
    id: 'source-001',
    type: 'article',
    title: 'React官方文档',
    content: 'React是一个用于构建用户界面的JavaScript库',
    summary: 'React核心概念和最佳实践',
    url: 'https://react.dev',
    tags: ['React', '前端', 'JavaScript'],
    created_at: '2026-02-21T08:00:00.000Z',
    updated_at: '2026-02-21T08:00:00.000Z',
  },
  {
    id: 'source-002',
    type: 'note',
    title: '写作技巧笔记',
    content: '1. 明确目标读者\n2. 使用简洁的语言\n3. 结构清晰',
    summary: '提高写作质量的几个关键点',
    url: null,
    tags: ['写作', '技巧'],
    created_at: '2026-02-20T15:00:00.000Z',
    updated_at: '2026-02-20T15:00:00.000Z',
  },
  {
    id: 'source-003',
    type: 'link',
    title: 'AI写作工具对比',
    content: 'https://example.com/ai-tools',
    summary: '市面上主流AI写作工具的对比分析',
    url: 'https://example.com/ai-tools',
    tags: ['AI', '工具'],
    created_at: '2026-02-19T10:00:00.000Z',
    updated_at: '2026-02-19T10:00:00.000Z',
  },
];

// Mock Artifacts
export const mockArtifacts: Artifact[] = [
  {
    id: 'artifact-001',
    session_id: 'session-001',
    artifact_type: 'brief',
    version: 1,
    content: '产品简介：MindFlow是一款AI写作助手...',
    created_at: '2026-02-21T10:05:00.000Z',
    updated_at: '2026-02-21T10:05:00.000Z',
  },
  {
    id: 'artifact-002',
    session_id: 'session-001',
    artifact_type: 'outline',
    version: 2,
    content: '1. 产品介绍\n2. 核心功能\n3. 使用场景\n4. 价格方案',
    created_at: '2026-02-21T10:15:00.000Z',
    updated_at: '2026-02-21T10:15:00.000Z',
  },
  {
    id: 'artifact-003',
    session_id: 'session-001',
    artifact_type: 'draft',
    version: 3,
    content: '完整的产品介绍文案...',
    created_at: '2026-02-21T10:30:00.000Z',
    updated_at: '2026-02-21T10:30:00.000Z',
  },
];

// Mock API函数
export const mockApi = {
  // Sessions
  listSessions: async (): Promise<Session[]> => {
    await delay(500);
    return [...mockSessions];
  },
  
  createSession: async (data: Partial<Session>): Promise<Session> => {
    await delay(300);
    const newSession: Session = {
      id: `session-${Date.now()}`,
      title: data.title || '新写作任务',
      mode: data.mode || 'scratch',
      phase: 'draft',
      substate: 'idle',
      pending_input: null,
      state_json: { context: {}, history: [] },
      meta_json: {},
      brief_confirmed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockSessions.unshift(newSession);
    return newSession;
  },
  
  // Sources
  listSources: async (params?: { type?: string }): Promise<Source[]> => {
    await delay(300);
    if (params?.type) {
      return mockSources.filter(s => s.type === params.type);
    }
    return [...mockSources];
  },
  
  createSource: async (data: Partial<Source>): Promise<Source> => {
    await delay(200);
    const newSource: Source = {
      id: `source-${Date.now()}`,
      type: data.type || 'note',
      title: data.title || '新素材',
      content: data.content || '',
      summary: data.summary || null,
      url: data.url || null,
      tags: data.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockSources.unshift(newSource);
    return newSource;
  },
  
  deleteSource: async (id: string): Promise<void> => {
    await delay(200);
    const index = mockSources.findIndex(s => s.id === id);
    if (index > -1) {
      mockSources.splice(index, 1);
    }
  },
  
  // Artifacts
  getSessionArtifacts: async (sessionId: string): Promise<Artifact[]> => {
    await delay(300);
    return mockArtifacts.filter(a => a.session_id === sessionId);
  },
};

// 模拟延迟
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
