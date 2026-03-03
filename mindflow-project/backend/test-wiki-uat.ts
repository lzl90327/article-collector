import axios from 'axios';

async function testWikiWithUAT() {
  console.log('======================================');
  console.log('使用 User Access Token 获取知识库节点');
  console.log('======================================\n');

  const spaceId = '7597246840014130375';
  
  // 从之前的测试中获取的 UAT（需要替换为实际的 UAT）
  // 注意：这个 Token 会过期，需要重新授权获取
  const userAccessToken = process.env.UAT || '';
  
  if (!userAccessToken) {
    console.log('⚠️  请设置环境变量 UAT 为 User Access Token');
    console.log('   或者从数据库中读取');
    console.log('\n💡 获取方式:');
    console.log('   1. 访问 http://localhost:3000/api/auth/feishu?state=test_user_123');
    console.log('   2. 完成飞书授权');
    console.log('   3. 从数据库中获取保存的 accessToken');
    return;
  }
  
  try {
    console.log('✅ 使用提供的 User Access Token\n');

    console.log(`正在获取知识库 (Space ID: ${spaceId}) 的节点列表...\n`);
    
    // 使用 UAT 调用 Wiki API
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
      {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
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

testWikiWithUAT();
