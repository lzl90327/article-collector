import axios from 'axios';

async function testWikiExplore() {
  console.log('======================================');
  console.log('探索 Wiki API 获取子文档的多种方式');
  console.log('======================================\n');

  const spaceId = '7597246840014130375';
  const nodeToken = 'E8jHwM9kIip9lnkyLWRcNxGjndb';

  // 使用 UAT (从服务器内存中获取，需要通过 API 调用)
  console.log('⚠️  注意：需要使用 User Access Token (UAT)');
  console.log('   因为知识库的层级结构可能在用户视角下才能看到\n');

  console.log('💡 建议直接在浏览器中访问飞书 Wiki 页面：');
  console.log(`   https://my.feishu.cn/wiki/${nodeToken}\n`);

  console.log('或者使用以下方法排查：\n');

  console.log('方法 1: 检查 Wiki API 是否有其他参数');
  console.log('   - 尝试 view_type 参数');
  console.log('   - 尝试 recursive 参数');
  console.log('   - 检查是否有 tree/hierarchy 相关接口\n');

  console.log('方法 2: 使用飞书开放平台调试工具');
  console.log('   访问：https://open.feishu.cn/api-explorer');
  console.log('   选择：Wiki > 获取知识库节点列表');
  console.log('   测试不同的参数组合\n');

  console.log('方法 3: 检查文档的实际类型');
  console.log('   - 在飞书客户端中打开"文字素材库"');
  console.log('   - 查看文档属性或设置');
  console.log('   - 确认它是否是"文件夹"类型\n');

  console.log('======================================');
  console.log('📋 当前已知信息');
  console.log('======================================');
  console.log('知识库 ID: ' + spaceId);
  console.log('文字素材库 node_token: ' + nodeToken);
  console.log('文字素材库 obj_token: HOLEdDQmhoTz4UxhLAWcve4UnCc');
  console.log('\n问题：API 返回的 parent_node_token 都是空字符串');
  console.log('可能原因：');
  console.log('1. Wiki API 只返回顶层节点');
  console.log('2. 需要使用特殊的 view_type 或 recursive 参数');
  console.log('3. 子文档信息存储在其他接口中');
  console.log('======================================');
}

testWikiExplore();
