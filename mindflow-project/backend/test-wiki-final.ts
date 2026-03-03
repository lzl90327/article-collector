import axios from 'axios';
import { feishuAuthDB } from './src/lib/feishuAuth.db';

async function testWikiFinal() {
  console.log('======================================');
  console.log('使用 User Access Token 获取知识库节点');
  console.log('======================================\n');

  const spaceId = '7597246840014130375';

  try {
    // 从内存存储获取 UAT
    const authInfo = await feishuAuthDB.findByUserId('test_user_123');

    if (!authInfo) {
      console.log('❌ 未找到用户授权信息');
      return;
    }

    console.log('✅ 获取到 User Access Token');
    console.log(`   OpenID: ${authInfo.openId}`);
    console.log(`   过期时间: ${authInfo.expiresAt}`);
    console.log(`   Token: ${authInfo.accessToken.substring(0, 30)}...\n`);

    console.log(`正在获取知识库 (Space ID: ${spaceId}) 的节点列表...\n`);

    // 使用 UAT 调用 Wiki API
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
      {
        headers: {
          'Authorization': `Bearer ${authInfo.accessToken}`,
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

testWikiFinal();
