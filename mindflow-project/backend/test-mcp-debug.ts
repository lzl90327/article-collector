import { feishuMCP } from './src/services/feishu.mcp';
import { feishuAuth } from './src/services/feishu.auth';

async function testMCPDebug() {
  console.log('MCP 调试测试 - 查看返回数据结构\n');

  try {
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功\n');

    // 测试创建文档并查看返回结构
    console.log('创建文档...');
    const result = await feishuMCP.callTool(token, 'create-doc', {
      title: '调试文档 - ' + new Date().toISOString(),
      content: '# 测试\n\n内容',
    }, ['create-doc']);

    console.log('原始返回结果:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.log('错误:', error.message);
  }
}

testMCPDebug();
