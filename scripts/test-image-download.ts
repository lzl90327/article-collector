/**
 * 测试飞书图片下载 API
 * 运行: npx ts-node scripts/test-image-download.ts
 */

import axios from 'axios';

const APP_ID = 'cli_a9f883f1bb781cef';
const APP_SECRET = 'nWEK1LtWOrcIYuor4CcA2flNYtilGcGZ';

// 从日志中获取的测试数据
const TEST_MESSAGE_ID = 'om_x100b571edea4f080c2a41842273d461';
const TEST_IMAGE_KEY = 'img_v3_02uj_f152342c-54a0-4ff9-9215-2bacd92d6e0g';

function bufferToString(data: any): string {
  if (Buffer.isBuffer(data)) {
    return data.toString('utf-8');
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString('utf-8');
  }
  return JSON.stringify(data);
}

async function getAccessToken(): Promise<string> {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: APP_ID,
      app_secret: APP_SECRET,
    }
  );
  console.log('✅ Access Token 获取成功');
  return response.data.tenant_access_token;
}

async function testDownloadImage(accessToken: string) {
  console.log('\n--- 测试 1: /im/v1/messages/{message_id}/resources/{file_key}?type=image ---');
  
  try {
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${TEST_MESSAGE_ID}/resources/${TEST_IMAGE_KEY}`;
    console.log(`请求 URL: ${url}?type=image`);
    
    const response = await axios.get(url, {
      params: { type: 'image' },
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    });
    
    const size = response.data?.length || response.data?.byteLength || 0;
    console.log(`✅ 成功! 图片大小: ${size} bytes`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    return true;
  } catch (error: any) {
    console.log('❌ 失败');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Response: ${bufferToString(error.response.data)}`);
    } else {
      console.log(`Error: ${error.message}`);
    }
    return false;
  }
}

async function testDownloadImage2(accessToken: string) {
  console.log('\n--- 测试 2: /im/v1/images/{image_key} (旧 API) ---');
  
  try {
    const url = `https://open.feishu.cn/open-apis/im/v1/images/${TEST_IMAGE_KEY}`;
    console.log(`请求 URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    });
    
    const size = response.data?.length || response.data?.byteLength || 0;
    console.log(`✅ 成功! 图片大小: ${size} bytes`);
    return true;
  } catch (error: any) {
    console.log('❌ 失败');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Response: ${bufferToString(error.response.data)}`);
    }
    return false;
  }
}

async function testGetMessage(accessToken: string) {
  console.log('\n--- 测试 3: 获取消息详情 ---');
  
  try {
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${TEST_MESSAGE_ID}`;
    console.log(`请求 URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    console.log('✅ 成功!');
    console.log('消息详情:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error: any) {
    console.log('❌ 失败');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function main() {
  console.log('🔍 飞书图片下载 API 测试\n');
  console.log(`Message ID: ${TEST_MESSAGE_ID}`);
  console.log(`Image Key: ${TEST_IMAGE_KEY}`);
  
  try {
    const accessToken = await getAccessToken();
    
    // 测试获取消息详情
    await testGetMessage(accessToken);
    
    // 测试新 API
    const result1 = await testDownloadImage(accessToken);
    
    // 测试旧 API
    const result2 = await testDownloadImage2(accessToken);
    
    console.log('\n========== 测试结果 ==========');
    console.log(`/im/v1/messages/.../resources/...: ${result1 ? '✅' : '❌'}`);
    console.log(`/im/v1/images/...: ${result2 ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

main();
