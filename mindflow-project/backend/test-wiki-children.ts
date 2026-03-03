import axios from 'axios';
import { feishuAuthDB } from './src/lib/feishuAuth.db';

async function testWikiChildren() {
  console.log('======================================');
  console.log('获取文字素材库下的子文档');
  console.log('======================================\n');

  const spaceId = '7597246840014130375';
  const parentNodeToken = 'E8jHwM9kIip9lnkyLWRcNxGjndb'; // 文字素材库的 node_token

  try {
    // 从内存存储获取 UAT
    const authInfo = await feishuAuthDB.findByUserId('test_user_123');

    if (!authInfo) {
      console.log('❌ 未找到用户授权信息');
      return;
    }

    console.log('✅ 获取到 User Access Token\n');
    console.log(`正在获取 "文字素材库" 下的子文档...\n`);

    // 使用 UAT 调用飞书 Wiki API，传入 parent_node_token 获取子节点
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
      {
        headers: {
          'Authorization': `Bearer ${authInfo.accessToken}`,
        },
        params: {
          page_size: 50,
          parent_node_token: parentNodeToken, // 获取该节点下的子节点
        },
      }
    );

    if (response.data.code === 0) {
      const nodes = response.data.data?.items || [];
      console.log('======================================');
      console.log(`📋 "文字素材库" 子文档 (${nodes.length} 个)`);
      console.log('======================================\n');

      if (nodes.length === 0) {
        console.log('⚠️  "文字素材库" 下没有子文档');
        console.log('\n💡 说明：');
        console.log('   1. "文字素材库" 本身是一个文档，不是文件夹');
        console.log('   2. 或者该文档下确实没有创建子文档');
        console.log('   3. 知识库的层级结构可能需要通过其他方式获取');
      } else {
        nodes.forEach((node: any, index: number) => {
          console.log(`${index + 1}. ${node.title}`);
          console.log(`   类型: ${node.obj_type}`);
          console.log(`   Node Token: ${node.node_token}`);
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

testWikiChildren();
