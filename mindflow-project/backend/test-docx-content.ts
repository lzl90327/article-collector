import axios from 'axios';
import { feishuAuthDB } from './src/lib/feishuAuth.db';

async function testDocxContent() {
  console.log('======================================');
  console.log('获取文字素材库文档内容');
  console.log('======================================\n');

  // 文字素材库的 obj_token
  const objToken = 'HOLEdDQmhoTz4UxhLAWcve4UnCc';

  try {
    const authInfo = await feishuAuthDB.findByUserId('test_user_123');
    if (!authInfo) {
      console.log('❌ 未找到用户授权信息');
      return;
    }

    console.log('✅ 获取到 User Access Token\n');

    // 方法 1: 使用 docx API 获取文档内容
    console.log('方法 1: 使用 docx API 获取文档内容');
    console.log(`文档 token: ${objToken}\n`);

    try {
      const response = await axios.get(
        `https://open.feishu.cn/open-apis/docx/v1/documents/${objToken}`,
        {
          headers: { 'Authorization': `Bearer ${authInfo.accessToken}` },
        }
      );

      console.log('API 响应:');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (e: any) {
      console.log(`❌ 请求失败: ${e.message}`);
      if (e.response?.data) {
        console.log('错误详情:', JSON.stringify(e.response.data, null, 2));
      }
    }

    // 方法 2: 尝试获取文档块内容
    console.log('\n\n方法 2: 获取文档块内容');
    try {
      const response2 = await axios.get(
        `https://open.feishu.cn/open-apis/docx/v1/documents/${objToken}/blocks`,
        {
          headers: { 'Authorization': `Bearer ${authInfo.accessToken}` },
          params: { page_size: 500 },
        }
      );

      console.log('API 响应:');
      console.log(JSON.stringify(response2.data, null, 2));
    } catch (e: any) {
      console.log(`❌ 请求失败: ${e.message}`);
      if (e.response?.data) {
        console.log('错误详情:', JSON.stringify(e.response.data, null, 2));
      }
    }

  } catch (error: any) {
    console.log('❌ 获取失败:', error.message);
  }
}

testDocxContent();
