// 直接调用服务器 API 来获取知识库文档
import axios from 'axios';

async function testWikiViaAPI() {
  console.log('======================================');
  console.log('通过 API 获取知识库文档列表');
  console.log('======================================\n');

  const spaceId = '7597246840014130375';

  try {
    console.log('调用服务器 API 获取知识库节点...\n');

    // 调用我们创建的 API 端点
    const response = await axios.get(
      `http://localhost:3000/api/wiki/spaces/${spaceId}/nodes`,
      {
        headers: {
          'X-User-Id': 'test_user_123',  // 传递用户 ID
        },
      }
    );

    if (response.data.success) {
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
          console.log('');
        });
      }
    } else {
      console.log('❌ API 返回错误:', response.data.error);
    }

  } catch (error: any) {
    console.log('❌ 获取失败:', error.message);
    if (error.response?.data) {
      console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testWikiViaAPI();
