import axios from 'axios';

async function testWikiCorrect() {
  console.log('======================================');
  console.log('使用正确的方式获取 Wiki 子节点');
  console.log('======================================\n');

  const spaceId = '7597246840014130375';
  const parentNodeToken = 'E8jHwM9kIip9lnkyLWRcNxGjndb'; // 文字素材库的 node_token

  // 注意：需要使用 UAT，服务器内存中应该有之前保存的 token
  // 由于内存存储问题，这里先尝试从 API 获取

  console.log('⚠️  需要先获取 User Access Token');
  console.log('   请确保已完成飞书授权\n');

  console.log('API 调用信息：');
  console.log(`  Space ID: ${spaceId}`);
  console.log(`  Parent Node Token: ${parentNodeToken}`);
  console.log(`  URL: https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`);
  console.log(`  Query: parent_node_token=${parentNodeToken}\n`);

  console.log('💡 由于 UAT 存储在服务器内存中，请使用以下 curl 命令测试：\n');
  console.log('curl -X GET \\\');
  console.log(`  "http://localhost:3000/api/wiki/spaces/${spaceId}/nodes?parent_node_token=${parentNodeToken}" \\\`);
  console.log('  -H "X-User-Id: test_user_123"\n');

  console.log('======================================');
  console.log('正在执行 API 调用...');
  console.log('======================================\n');
}

testWikiCorrect();
