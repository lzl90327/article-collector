import axios from 'axios';

async function testWikiChildrenWithUAT() {
  console.log('======================================');
  console.log('使用 UAT 获取 Wiki 子节点');
  console.log('======================================\n');

  const spaceId = '7597246840014130375';
  const nodeToken = 'E8jHwM9kIip9lnkyLWRcNxGjndb';

  console.log('⚠️  注意：需要使用 User Access Token (UAT)');
  console.log('   因为子文档可能需要用户权限才能访问\n');

  console.log('请先在浏览器中完成飞书授权，然后使用以下方式测试：\n');

  console.log('方法 1: 使用 API 端点 (已授权用户)');
  console.log('curl -X GET \\\');
  console.log('  "http://localhost:3000/api/wiki/spaces/' + spaceId + '/nodes?parent_node_token=' + nodeToken + '" \\\');
  console.log('  -H "X-User-Id: test_user_123"\n');

  console.log('方法 2: 直接调用飞书 Wiki API');
  console.log('需要先获取 UAT，然后调用：');
  console.log('GET https://open.feishu.cn/open-apis/wiki/v2/spaces/' + spaceId + '/nodes');
  console.log('  ?parent_node_token=' + nodeToken);
  console.log('  &page_size=50');
  console.log('Authorization: Bearer {UAT}\n');

  console.log('======================================');
  console.log('💡 关键发现');
  console.log('======================================');
  console.log('从之前的测试来看：');
  console.log('1. TAT (Tenant Access Token) 无法获取子文档');
  console.log('2. 需要 UAT (User Access Token) 才能访问用户视角的数据');
  console.log('3. 服务器内存中的 UAT 在重启后丢失');
  console.log('\n解决方案：');
  console.log('1. 重新进行飞书授权获取 UAT');
  console.log('2. 或者将 UAT 持久化存储（文件/数据库）');
}

testWikiChildrenWithUAT();
