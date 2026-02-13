
import { larkClient } from '../src/services/lark-client';
import { logger } from '../src/utils/logger';
import config, { wikiConfig } from '../src/config';

async function diagnoseWikiPermission() {
  console.log('=== Wiki 机器人权限深度诊断 ===');
  console.log(`Space ID: ${wikiConfig.spaceId}`);
  console.log(`目标 Token (WIKI_VIDEO_PARENT_NODE_TOKEN): ${wikiConfig.videoParentNodeToken}`);

  const targetToken = wikiConfig.videoParentNodeToken;
  if (!targetToken) {
    console.error('❌ 未配置 WIKI_VIDEO_PARENT_NODE_TOKEN');
    return;
  }

  try {
    // 1. 尝试获取节点信息 (验证读权限)
    console.log('\n[1] 尝试获取节点信息...');
    const resNode = await larkClient.get('/wiki/v2/spaces/get_node', {
      token: targetToken
    });

    console.log('API 响应:', JSON.stringify(resNode, null, 2));

    if (resNode.code === 0) {
      const node = resNode.data.node;
      console.log('✅ 节点读取成功:');
      console.log(`  - Title: ${node.title}`);
      console.log(`  - Node Type: ${node.node_type}`);
      console.log(`  - Node Token: ${node.node_token}`);
      console.log(`  - Obj Token: ${node.obj_token}`);
      console.log(`  - Space ID: ${node.space_id}`);
      console.log(`  - Has Child: ${node.has_child}`);
      
      // 检查 Space ID 是否匹配
      if (node.space_id !== wikiConfig.spaceId) {
        console.warn(`⚠️ Space ID 不匹配! 配置: ${wikiConfig.spaceId}, 实际: ${node.space_id}`);
        console.warn('  这可能导致移动操作失败，因为必须在同一个知识库空间内。');
      }

      // 2. 尝试列出子节点 (验证更深层的读权限)
      console.log('\n[2] 尝试列出子节点...');
      const resList = await larkClient.get(`/wiki/v2/spaces/${wikiConfig.spaceId}/nodes`, {
        parent_node_token: targetToken,
        page_size: 5
      });
      
      if (resList.code === 0) {
        console.log(`✅ 子节点列表读取成功 (Count: ${resList.data.items?.length || 0})`);
      } else {
        console.error(`❌ 子节点读取失败: ${resList.code} - ${resList.msg}`);
      }

    } else {
      console.error(`❌ 节点读取失败: ${resNode.code} - ${resNode.msg}`);
      if (resNode.code === 131006) {
        console.error('  -> 确诊: 机器人应用没有该节点的读取权限。');
        console.error('  -> 建议: 请确保在该 Wiki 页面 -> 更多 -> 协作者 中添加了机器人应用，并授予“可编辑”权限。');
      }
    }

  } catch (error: any) {
    console.error('全局异常:', error.message);
    if (error.response) {
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

diagnoseWikiPermission();
