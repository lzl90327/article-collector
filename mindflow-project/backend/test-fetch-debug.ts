import { feishuMCP } from './src/services/feishu.mcp';
import { feishuAuth } from './src/services/feishu.auth';

async function test() {
  const token = await feishuAuth.getAccessToken();
  
  // 使用刚才创建的文档 ID
  const docId = 'RhYodmvKco6Jsaxe6YqcXJlFn5T';
  
  console.log('测试 fetch-doc 返回格式...\n');
  
  // 直接调用 MCP
  const result = await feishuMCP.callTool(token, 'fetch-doc', {
    docID: docId,
  }, ['fetch-doc']);
  
  console.log('原始返回结果:');
  console.log(JSON.stringify(result, null, 2));
  
  // 解析 content
  const content = result?.content?.[0]?.text;
  console.log('\n解析后的 text:');
  console.log(content);
  
  const data = JSON.parse(content);
  console.log('\n解析后的 data:');
  console.log(JSON.stringify(data, null, 2));
}

test();
