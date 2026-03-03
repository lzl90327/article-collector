import axios from 'axios';
import { feishuAuth } from './src/services/feishu.auth';

async function testInternalAPI() {
  console.log('======================================');
  console.log('尝试飞书内部 API 获取子文档');
  console.log('======================================\n');

  const spaceId = '7597246840014130375';
  const nodeToken = 'E8jHwM9kIip9lnkyLWRcNxGjndb';

  try {
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功\n');

    // 尝试飞书内部 API（前端使用的 API）
    console.log('方法 1: 尝试 internal-api 获取节点树');
    try {
      const response1 = await axios.get(
        `https://internal-api-space.feishu.cn/space/api/wiki/v2/tree/nodes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Referer': `https://my.feishu.cn/wiki/${nodeToken}`,
          },
          params: {
            space_id: spaceId,
            node_token: nodeToken,
          },
        }
      );
      console.log('✅ 成功！');
      console.log(JSON.stringify(response1.data, null, 2));
    } catch (e: any) {
      console.log(`❌ 失败: ${e.message}`);
      if (e.response?.data) {
        console.log('错误:', JSON.stringify(e.response.data, null, 2));
      }
    }

    // 尝试另一个可能的内部 API
    console.log('\n方法 2: 尝试 space/api/wiki/node/children');
    try {
      const response2 = await axios.get(
        `https://my.feishu.cn/space/api/wiki/node/children`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          params: {
            space_id: spaceId,
            node_token: nodeToken,
          },
        }
      );
      console.log('✅ 成功！');
      console.log(JSON.stringify(response2.data, null, 2));
    } catch (e: any) {
      console.log(`❌ 失败: ${e.message}`);
      if (e.response?.data) {
        console.log('错误:', JSON.stringify(e.response.data, null, 2));
      }
    }

    // 尝试获取节点详情
    console.log('\n方法 3: 尝试获取节点详情');
    try {
      const response3 = await axios.get(
        `https://open.feishu.cn/open-apis/wiki/v2/nodes/${nodeToken}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      console.log('✅ 成功！');
      console.log(JSON.stringify(response3.data, null, 2));
    } catch (e: any) {
      console.log(`❌ 失败: ${e.message}`);
      if (e.response?.data) {
        console.log('错误:', JSON.stringify(e.response.data, null, 2));
      }
    }

  } catch (error: any) {
    console.log('❌ 获取失败:', error.message);
  }
}

testInternalAPI();
