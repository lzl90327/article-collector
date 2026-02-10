
import { larkClient, userLarkClient } from '../src/services/lark-client';
import { larkDocService } from '../src/services/lark-doc';
import { logger } from '../src/utils/logger';
import config, { wikiConfig } from '../src/config';

async function verifyWikiMove() {
  console.log('=== Wiki 权限与归档自测 ===');
  console.log(`User Token 配置长度: ${config.LARK_USER_ACCESS_TOKEN?.length || 0}`);
  console.log(`目标父节点: ${wikiConfig.videoParentNodeToken}`);
  console.log(`Space ID: ${wikiConfig.spaceId}`);

  try {
    // 1. 创建测试文档
    console.log('\n[1] 创建测试文档...');
    const { token: docToken, url } = await larkDocService.createDocument('Wiki 权限自测文档 ' + Date.now(), '这是一个用于测试归档权限的临时文档');
    console.log(`文档创建成功: ${docToken}`);
    console.log(`URL: ${url}`);

    // 2. 尝试使用 User Token 移动
    console.log('\n[2] 尝试使用 User Token 移动到知识库...');
    const requestData = {
      obj_type: 'docx',
      obj_token: docToken,
      parent_wiki_token: wikiConfig.videoParentNodeToken,
    };

    try {
      const res = await userLarkClient.post(`/wiki/v2/spaces/${wikiConfig.spaceId}/nodes/move_docs_to_wiki`, requestData);
      
      console.log('API 响应:', JSON.stringify(res, null, 2));

      if (res.code === 0) {
        console.log('✅ [成功] 文档已成功归档到指定节点！');
        console.log(`Wiki Token: ${res.data.wiki_token}`);
      } else {
        console.error(`❌ [失败] API 返回错误: ${res.code} - ${res.msg}`);
      }
    } catch (error: any) {
      console.error('❌ [异常] 请求发生异常:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(error.message);
      }
    }

  } catch (error) {
    console.error('全局异常:', error);
  }
}

verifyWikiMove();
