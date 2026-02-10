
import { larkClient } from '../src/services/lark-client';
import { logger } from '../src/utils/logger';
import config from '../src/config';

async function debugWiki() {
  const targetToken = 'NHnMwAwdEiQs3CkQtrEcc7aVnNd';
  
  console.log('=== Wiki 权限诊断 ===');
  console.log(`目标 Token: ${targetToken}`);
  console.log(`Space ID: ${config.WIKI_SPACE_ID}`);

  try {
    // 1. 获取节点信息
    console.log('\n[1] 尝试获取节点信息...');
    const res = await larkClient.get('/wiki/v2/spaces/get_node', {
      token: targetToken
    });

    console.log('API 响应:', JSON.stringify(res, null, 2));

    if (res.code === 0) {
      console.log('✅ 节点获取成功');
      const node = res.data.node;
      console.log(`- Title: ${node.title}`);
      console.log(`- Node Type: ${node.node_type}`);
      console.log(`- Obj Type: ${node.obj_type}`);
      console.log(`- Obj Token: ${node.obj_token}`);
      console.log(`- Space ID: ${node.space_id}`);
      
      if (node.space_id !== config.WIKI_SPACE_ID) {
        console.warn(`⚠️ Space ID 不匹配! 配置: ${config.WIKI_SPACE_ID}, 实际: ${node.space_id}`);
      }
    } else {
      console.error('❌ 节点获取失败');
      if (res.code === 131006) {
        console.error('原因: 权限不足 (Permission Denied)');
      }
    }

  } catch (error) {
    console.error('执行异常:', error);
  }
}

debugWiki();
