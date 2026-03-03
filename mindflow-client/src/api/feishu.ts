import request from '../utils/request';

/**
 * 飞书知识库相关 API
 */

/**
 * 获取飞书授权 URL
 */
export const getFeishuAuthUrl = () => {
  return request.get('/auth/feishu');
};

/**
 * 获取飞书授权状态
 */
export const getFeishuAuthStatus = (userId: string) => {
  return request.get(`/auth/feishu/status/${userId}`);
};

/**
 * 获取知识库节点列表
 * @param spaceId 知识库 ID
 * @param parentNodeToken 父节点 token（可选，不传则获取根节点）
 */
export const getWikiNodes = (spaceId: string, parentNodeToken?: string) => {
  const params: Record<string, string> = {};
  if (parentNodeToken) {
    params.parent_node_token = parentNodeToken;
  }
  return request.get(`/wiki/spaces/${spaceId}/nodes`, { params });
};

/**
 * 获取文档内容
 * @param nodeToken 节点 token
 */
export const getWikiNodeContent = (nodeToken: string) => {
  return request.get(`/wiki/nodes/${nodeToken}/content`);
};

/**
 * 搜索文档
 * @param keyword 搜索关键词
 */
export const searchWikiDocuments = (keyword: string) => {
  return request.get('/wiki/search', { params: { keyword } });
};

/**
 * 创建文档
 * @param data 文档数据
 */
export const createWikiDocument = (data: {
  title: string;
  content: string;
  folderToken?: string;
}) => {
  return request.post('/wiki/documents', data);
};

/**
 * 更新文档
 * @param docId 文档 ID
 * @param data 更新数据
 */
export const updateWikiDocument = (
  docId: string,
  data: {
    content: string;
    mode?: 'append' | 'overwrite';
  }
) => {
  return request.put(`/wiki/documents/${docId}`, data);
};
