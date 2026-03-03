import { feishuMCP } from './src/services/feishu.mcp';
import { feishuAuth } from './src/services/feishu.auth';

async function testMcpListDocs() {
  console.log('======================================');
  console.log('方案一：使用 MCP list-docs 获取子文档');
  console.log('======================================\n');

  // 文字素材库的 obj_token
  const folderToken = 'HOLEdDQmhoTz4UxhLAWcve4UnCc';

  try {
    // 获取 TAT (Tenant Access Token)
    console.log('🔑 获取 Tenant Access Token...');
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功\n');

    console.log(`使用 MCP list-docs 获取文件夹内容:`);
    console.log(`folder_token: ${folderToken}\n`);

    // 使用 MCP list-docs 工具
    const docs = await feishuMCP.listDocuments(token, folderToken, 50);

    console.log('======================================');
    console.log(`📋 找到 ${docs.length} 个子文档/文件`);
    console.log('======================================\n');

    if (docs.length === 0) {
      console.log('⚠️  该文件夹下没有文档');
      console.log('\n💡 可能原因：');
      console.log('   1. obj_token 不能作为 folder_token 使用');
      console.log('   2. 该文档确实没有子内容');
      console.log('   3. 需要使用其他 API 获取');
    } else {
      docs.forEach((doc: any, index: number) => {
        console.log(`${index + 1}. ${doc.title}`);
        console.log(`   ID: ${doc.docId}`);
        console.log(`   URL: ${doc.url}`);
        console.log('');
      });
    }

    console.log('======================================');
    console.log('✅ MCP list-docs 测试完成');
    console.log('======================================');

  } catch (error: any) {
    console.log('❌ 获取失败:', error.message);
    if (error.response?.data) {
      console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
    }
    console.log('\n⚠️  方案一失败，将尝试方案三 (Drive API)');
  }
}

testMcpListDocs();
