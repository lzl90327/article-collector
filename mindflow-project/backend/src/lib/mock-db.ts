/**
 * 内存数据库 - 用于测试
 * 临时替代真实数据库
 */

export const mockDb = {
  users: new Map(),
  articles: new Map(),
  sources: new Map(),
  ideas: new Map(),
  viewpoints: new Map(),
  syncRecords: new Map(),
};

// 初始化一些测试数据
mockDb.users.set('test-user-id', {
  id: 'test-user-id',
  openid: 'test-openid',
  nickname: '测试用户',
  avatarUrl: '',
  createdAt: new Date(),
});

console.log('✅ Mock DB initialized');
