
import axios from 'axios';
import { config } from '../src/config';

const APP_ID = process.env.APP_ID || config.LARK_APP_ID;
const APP_SECRET = process.env.APP_SECRET || config.LARK_APP_SECRET;
const CODE = process.argv[2];

if (!CODE) {
  console.error('请提供授权码 (code)');
  console.error('用法: ts-node scripts/get-user-token.ts <code_from_browser>');
  process.exit(1);
}

async function getUserToken() {
  try {
    console.log('正在用授权码换取用户 Token...');
    console.log('App ID:', APP_ID);
    
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/authen/v1/access_token',
      {
        app_id: APP_ID,
        app_secret: APP_SECRET,
        grant_type: 'authorization_code',
        code: CODE,
      }
    );

    if (response.data.code !== 0) {
      console.error('获取失败:', response.data);
      return;
    }

    const { access_token, refresh_token, expires_in } = response.data.data;
    console.log('\n✅ 获取成功！');
    console.log('--------------------------------------------------');
    console.log(`LARK_AUTH_MODE=user`);
    console.log(`LARK_USER_ACCESS_TOKEN=${access_token}`);
    console.log(`LARK_USER_REFRESH_TOKEN=${refresh_token}`);
    console.log('--------------------------------------------------');
    console.log(`有效期: ${expires_in} 秒`);
    console.log('\n请将以上环境变量添加到 .env 文件中');
  } catch (error: any) {
    console.error('请求异常:', error.response?.data || error.message);
  }
}

getUserToken();
