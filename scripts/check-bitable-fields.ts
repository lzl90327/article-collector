
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

const APP_TOKEN = 'ZDS6bxKdEay6qTsomc7cbeoWn2f';
const TABLE_ID = 'tblo7jJvmDMUxEvc';

async function listFields() {
  // 获取 tenant_access_token
  const authRes = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: process.env.LARK_APP_ID,
    app_secret: process.env.LARK_APP_SECRET
  });
  const token = authRes.data.tenant_access_token;

  console.log('Token 获取成功');

  // 获取字段列表
  try {
    const fieldsRes = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/fields`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    console.log('\n=== 表格字段列表 ===');
    fieldsRes.data.data.items.forEach((field: any) => {
      console.log(`- ${field.field_name} (Type: ${field.type})`);
    });
    
  } catch (e: any) {
    console.error('获取字段失败:', e.response?.data || e.message);
    // 尝试使用 User Token
    if (process.env.LARK_USER_ACCESS_TOKEN) {
        console.log('尝试使用 User Token...');
        try {
            const fieldsRes = await axios.get(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/fields`,
              {
                headers: { Authorization: `Bearer ${process.env.LARK_USER_ACCESS_TOKEN}` }
              }
            );
            console.log('\n=== 表格字段列表 (User Token) ===');
            fieldsRes.data.data.items.forEach((field: any) => {
              console.log(`- ${field.field_name} (Type: ${field.type})`);
            });
        } catch (err: any) {
             console.error('User Token 获取字段也失败:', err.response?.data || err.message);
        }
    }
  }
}

listFields();
