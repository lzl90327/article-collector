import { feishuMCP } from './src/services/feishu.mcp';
import { feishuAuth } from './src/services/feishu.auth';

async function testWikiSpace() {
  console.log('======================================');
  console.log('获取知识库文档列表');
  console.log('======================================\n');

  // 从 URL 提取的 space token
  const spaceToken = 'E8jHwM9kIip9lnkyLWRcNxGjndb';
  
  try {
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功\n');

    console.log(`正在获取知识库: ${spaceToken} 的文档列表...\n`);
    
    // 尝试使用 space token 作为 folder_token 获取文档
    const docs = await feishuMCP.listDocuments(token, spaceToken, 100);
    
    console.log('======================================');
    console.log(`📋 知识库文档目录 (${docs.length} 个文档)`);
    console.log('======================================\n');
    
    if (docs.length === 0) {
      console.log('⚠️  该知识库下没有文档，或没有访问权限');
    } else {
      docs.forEach((doc, index) => {
        console.log(`${index + 1}. ${doc.title}`);
        console.log(`   ID: ${doc.docId}`);
        console.log(`   URL: ${doc.url}`);
        console.log('');
      });
    }

    console.log('======================================');
    console.log('✅ 获取完成');
    console.log('======================================');

  } catch (error: any) {
    console.log('❌ 获取失败:', error.message);
    if (error.response?.data) {
      console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testWikiSpace();
