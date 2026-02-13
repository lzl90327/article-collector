
import express from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import open from 'open';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = 3000;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

// 检查配置
const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
  console.error('❌ 错误: .env 文件中未配置 LARK_APP_ID 或 LARK_APP_SECRET');
  process.exit(1);
}

// 首页：重定向到飞书授权页
app.get('/', (req, res) => {
  const authUrl = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=wiki:wiki`;
  console.log(`\n🔗 正在打开授权页面: ${authUrl}`);
  res.redirect(authUrl);
});

// 回调页：处理授权码
app.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  
  if (!code) {
    res.status(400).send('❌ 授权失败: 未收到 code');
    return;
  }

  console.log(`✅ 收到授权码: ${code}`);
  console.log('🔄 正在换取 Access Token...');

  try {
    // 换取 user_access_token
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
      {
        grant_type: 'authorization_code',
        code: code,
      },
      {
        headers: {
          'Authorization': `Bearer ${await getAppAccessToken()}`,
          'Content-Type': 'application/json; charset=utf-8',
        }
      }
    );

    if (response.data.code !== 0) {
      throw new Error(`API 错误: ${response.data.msg}`);
    }

    const { access_token, refresh_token, expires_in } = response.data.data;
    
    console.log('✅ Token 获取成功!');
    console.log(`Access Token: ${access_token.substring(0, 10)}...`);
    console.log(`Refresh Token: ${refresh_token.substring(0, 10)}...`);
    console.log(`Expires In: ${expires_in} 秒`);

    // 更新 .env 文件
    updateEnvFile('LARK_USER_ACCESS_TOKEN', access_token);
    updateEnvFile('LARK_USER_REFRESH_TOKEN', refresh_token);
    updateEnvFile('LARK_AUTH_MODE', 'user'); // 强制切换到用户模式

    res.send(`
      <h1>🎉 授权成功!</h1>
      <p>Access Token 已自动写入 .env 文件。</p>
      <p>您现在可以关闭此窗口并重启服务。</p>
      <script>window.close()</script>
    `);
    
    console.log('\n✅ 配置文件已更新，正在关闭服务器...');
    setTimeout(() => process.exit(0), 1000);

  } catch (error: any) {
    console.error('❌ 获取 Token 失败:', error.response?.data || error.message);
    res.status(500).send(`授权失败: ${error.message}`);
  }
});

// 辅助函数：获取 app_access_token (用于换取 user_token)
async function getAppAccessToken(): Promise<string> {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
    {
      app_id: APP_ID,
      app_secret: APP_SECRET,
    }
  );
  return response.data.app_access_token;
}

// 辅助函数：更新 .env 文件
function updateEnvFile(key: string, value: string) {
  const envPath = path.resolve(process.cwd(), '.env');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  
  const regex = new RegExp(`^${key}=.*`, 'm');
  
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  
  fs.writeFileSync(envPath, content);
  console.log(`📁 已更新 ${key}`);
}

// 启动服务器
app.listen(PORT, async () => {
  console.log(`\n🚀 认证服务器已启动: http://127.0.0.1:${PORT}`);
  console.log('👉 请在浏览器中完成授权...');
  
  // 自动打开浏览器
  try {
      await open(`http://127.0.0.1:${PORT}`);
  } catch (e) {
      console.log(`无法自动打开浏览器，请手动访问: http://127.0.0.1:${PORT}`);
  }
});
