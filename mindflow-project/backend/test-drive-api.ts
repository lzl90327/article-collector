import axios from 'axios';
import { feishuAuth } from './src/services/feishu.auth';

async function testDriveAPI() {
  console.log('======================================');
  console.log('方案三：使用 Drive API 获取子文档');
  console.log('======================================\n');

  // 文字素材库的 obj_token
  const folderToken = 'HOLEdDQmhoTz4UxhLAWcve4UnCc';

  try {
    // 获取 TAT
    console.log('🔑 获取 Tenant Access Token...');
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功\n');

    // 方法 1: 使用 Drive API 的 files 接口
    console.log('方法 1: Drive API - 获取文件列表');
    console.log(`folder_token: ${folderToken}\n`);

    try {
      const response1 = await axios.get(
        'https://open.feishu.cn/open-apis/drive/v1/files',
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            folder_token: folderToken,
            page_size: 50,
          },
        }
      );

      console.log('API 响应:');
      console.log(JSON.stringify(response1.data, null, 2));
    } catch (e: any) {
      console.log(`❌ 请求失败: ${e.message}`);
      if (e.response?.data) {
        console.log('错误详情:', JSON.stringify(e.response.data, null, 2));
      }
    }

    // 方法 2: 使用 Drive API 的 meta 接口获取文件元数据
    console.log('\n\n方法 2: Drive API - 获取文件元数据');
    try {
      const response2 = await axios.post(
        'https://open.feishu.cn/open-apis/drive/v1/metas/batch_query',
        {
          request_list: [
            {
              token: folderToken,
              type: 'docx',
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
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

    // 方法 3: 尝试获取文档的 shortcuts（快捷方式）
    console.log('\n\n方法 3: 尝试获取文档快捷方式');
    try {
      const response3 = await axios.get(
        `https://open.feishu.cn/open-apis/drive/v1/files/${folderToken}/shortcuts`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      console.log('API 响应:');
      console.log(JSON.stringify(response3.data, null, 2));
    } catch (e: any) {
      console.log(`❌ 请求失败: ${e.message}`);
      if (e.response?.data) {
        console.log('错误详情:', JSON.stringify(e.response.data, null, 2));
      }
    }

    console.log('\n======================================');
    console.log('✅ Drive API 测试完成');
    console.log('======================================');

  } catch (error: any) {
    console.log('❌ 获取失败:', error.message);
  }
}

testDriveAPI();
