
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

dotenv.config({ path: path.join(__dirname, '../.env') });

const APP_TOKEN = 'ZDS6bxKdEay6qTsomc7cbeoWn2f';
const TABLE_ID = 'tblo7jJvmDMUxEvc';

async function refreshUserToken(refreshToken: string, appAccessToken: string) {
  try {
    const res = await axios.post(
      'https://open.feishu.cn/open-apis/authen/v1/refresh_access_token',
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      },
      {
        headers: { Authorization: `Bearer ${appAccessToken}` }
      }
    );
    return res.data.data.access_token;
  } catch (e: any) {
    console.error('刷新 User Token 失败:', e.response?.data || e.message);
    return null;
  }
}

async function addRecord() {
  // 1. 获取 App Token (Tenant Token)
  const authRes = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: process.env.LARK_APP_ID,
    app_secret: process.env.LARK_APP_SECRET
  });
  const appToken = authRes.data.tenant_access_token;

  // 2. 尝试刷新 User Token
  console.log('正在刷新 User Token...');
  let userToken = await refreshUserToken(process.env.LARK_USER_REFRESH_TOKEN!, appToken);
  
  if (!userToken) {
      console.log('User Token 刷新失败，放弃操作。');
      return;
  }
  
  console.log('User Token 刷新成功');

  const record = {
    fields: {
      "变更标题": "B站长视频转录优化与ASR服务统一",
      "变更类型": "优化", // 尝试直接传文本
      "记录日期": Date.now(), // 毫秒级时间戳
      "版本号/分支": "v1.2.0",
      "影响模块": ["BilibiliService", "ASRService"], // 多选可能需要数组
      "变更动机/问题 Pain": "1. B站长视频因时长限制无法转录；\n2. ASR服务分散（阿里云/本地不统一）；\n3. 服务器缺少 ffmpeg 环境。",
      "变更内容 What": "1. 统一接入 asrService，支持长音频自动分段（55s）；\n2. 废弃不稳定的阿里云 ASR；\n3. 新增 setup-video-tools.sh 自动化环境安装；\n4. 优化 ffmpeg 路径检测逻辑。",
      "验证方式 Eval Plan": "1. 开发 Mock 测试覆盖主要场景；\n2. 服务器真实环境测试长视频（37分钟）下载与分割。",
      "结果 Result": "Mock 测试通过；真实环境成功下载并分割 42 个片段，转录流程跑通。",
      "处置决策 Decision": "已发布",
      "下一步 Next": "观察生产环境稳定性，收集用户反馈。",
      "相关链接": [
        { "text": "GitHub Commit", "link": "https://github.com/lzl90327/article-collector" }
      ]
    }
  };

  try {
    const res = await axios.post(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`,
      record,
      {
        headers: { Authorization: `Bearer ${userToken}` }
      }
    );
    console.log('✅ 记录添加成功！Record ID:', res.data.data.record.record_id);
  } catch (e: any) {
    console.error('❌ 添加失败:', JSON.stringify(e.response?.data || e.message, null, 2));
  }
}

addRecord();
