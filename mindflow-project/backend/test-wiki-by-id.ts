import axios from 'axios';
import { feishuAuth } from './src/services/feishu.auth';

async function testWikiById() {
  console.log('======================================');
  console.log('使用 Space ID 获取知识库节点');
  console.log('======================================\n');

  // 之前提供的数字 space_id
  const spaceId = '7597246840014130375';
  
  try {
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功\n');

    console.log(`正在获取知识库 (Space ID: ${spaceId}) 的节点列表...\n`);
    
    // 使用传统 Wiki API 获取知识库节点
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        params: {
          page_size: 50,
        },
      }
    );
    
    if (response.data.code === 0) {
      const nodes = response.data.data?.items || [];
      console.log('======================================');
      console.log(`📋 知识库文档目录 (${nodes.length} 个节点)`);
      console.log('======================================\n');
      
      if (nodes.length === 0) {
        console.log('⚠️  该知识库下没有文档');
      } else {
        nodes.forEach((node: any, index: number) => {
          console.log(`${index + 1}. ${node.title}`);
          console.log(`   类型: ${node.obj_type}`);
          console.log(`   Node Token: ${node.node_token}`);
          console.log(`   Obj Token: ${node.obj_token}`);
          console.log(`   父节点: ${node.parent_node_token || '根节点'}`);
          console.log('');
        });
      }
    } else {
      console.log('❌ API 返回错误:', response.data.msg);
    }

  } catch (error: any) {
    console.log('❌ 获取失败:', error.message);
    if (error.response?.data) {
      console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testWikiById();
