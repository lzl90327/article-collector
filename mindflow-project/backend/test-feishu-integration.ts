import axios from 'axios';
import { feishuAuthDB } from './src/lib/feishuAuth.db';

const BASE_URL = 'http://localhost:3000';
const USER_ID = 'test_user_123';
const SPACE_ID = '7597246840014130375';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  message?: string;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('======================================');
  console.log('飞书知识库集成自测');
  console.log('======================================\n');

  // 测试 1: 验证 UAT 持久化存储
  console.log('📝 测试 1: 验证 UAT 持久化存储');
  console.log('--------------------------------------');
  try {
    const authInfo = await feishuAuthDB.findByUserId(USER_ID);
    if (authInfo && authInfo.accessToken) {
      results.push({
        name: 'UAT 持久化存储',
        status: 'passed',
        message: `找到用户授权信息，Token: ${authInfo.accessToken.substring(0, 20)}...`,
        data: {
          openId: authInfo.openId,
          expiresAt: authInfo.expiresAt,
        },
      });
      console.log('✅ UAT 已持久化存储');
      console.log(`   OpenID: ${authInfo.openId}`);
      console.log(`   过期时间: ${authInfo.expiresAt}`);
    } else {
      results.push({
        name: 'UAT 持久化存储',
        status: 'failed',
        error: '未找到用户授权信息',
      });
      console.log('❌ 未找到用户授权信息');
    }
  } catch (error: any) {
    results.push({
      name: 'UAT 持久化存储',
      status: 'failed',
      error: error.message,
    });
    console.log('❌ 测试失败:', error.message);
  }
  console.log('');

  // 测试 2: 获取知识库根节点
  console.log('📝 测试 2: 获取知识库根节点');
  console.log('--------------------------------------');
  try {
    const response = await axios.get(
      `${BASE_URL}/api/wiki/spaces/${SPACE_ID}/nodes`,
      {
        headers: { 'X-User-Id': USER_ID },
      }
    );

    if (response.data.success && response.data.data?.items) {
      const items = response.data.data.items;
      results.push({
        name: '获取知识库根节点',
        status: 'passed',
        message: `成功获取 ${items.length} 个根节点`,
        data: {
          total: items.length,
          firstNode: items[0]?.title,
        },
      });
      console.log(`✅ 成功获取 ${items.length} 个根节点`);
      console.log(`   第一个节点: ${items[0]?.title}`);
    } else {
      results.push({
        name: '获取知识库根节点',
        status: 'failed',
        error: response.data.error || '返回数据格式错误',
      });
      console.log('❌ 获取失败:', response.data.error);
    }
  } catch (error: any) {
    results.push({
      name: '获取知识库根节点',
      status: 'failed',
      error: error.response?.data?.error || error.message,
    });
    console.log('❌ 测试失败:', error.message);
  }
  console.log('');

  // 测试 3: 获取子文档列表
  console.log('📝 测试 3: 获取"文字素材库"子文档列表');
  console.log('--------------------------------------');
  try {
    const parentToken = 'E8jHwM9kIip9lnkyLWRcNxGjndb';
    const response = await axios.get(
      `${BASE_URL}/api/wiki/spaces/${SPACE_ID}/nodes`,
      {
        headers: { 'X-User-Id': USER_ID },
        params: { parent_node_token: parentToken },
      }
    );

    if (response.data.success && response.data.data?.items) {
      const items = response.data.data.items;
      results.push({
        name: '获取子文档列表',
        status: 'passed',
        message: `成功获取 ${items.length} 个子文档`,
        data: {
          total: items.length,
          sampleTitles: items.slice(0, 3).map((i: any) => i.title),
        },
      });
      console.log(`✅ 成功获取 ${items.length} 个子文档`);
      console.log('   示例标题:');
      items.slice(0, 3).forEach((item: any, idx: number) => {
        console.log(`   ${idx + 1}. ${item.title.substring(0, 40)}...`);
      });
    } else {
      results.push({
        name: '获取子文档列表',
        status: 'failed',
        error: response.data.error || '返回数据格式错误',
      });
      console.log('❌ 获取失败:', response.data.error);
    }
  } catch (error: any) {
    results.push({
      name: '获取子文档列表',
      status: 'failed',
      error: error.response?.data?.error || error.message,
    });
    console.log('❌ 测试失败:', error.message);
  }
  console.log('');

  // 测试 4: 获取文档内容
  console.log('📝 测试 4: 获取文档内容');
  console.log('--------------------------------------');
  try {
    // 使用第一个子文档的 node_token
    const docNodeToken = 'QeR7wj4wfiRCrMkI9zRcDkOcnth'; // Palantir 为什么在国内突然火了
    const response = await axios.get(
      `${BASE_URL}/api/wiki/nodes/${docNodeToken}/content`,
      {
        headers: { 'X-User-Id': USER_ID },
      }
    );

    if (response.data.success) {
      results.push({
        name: '获取文档内容',
        status: 'passed',
        message: '成功获取文档内容',
        data: {
          title: response.data.data?.title,
          hasContent: !!response.data.data?.content || !!response.data.data?.markdown,
        },
      });
      console.log('✅ 成功获取文档内容');
      console.log(`   标题: ${response.data.data?.title || 'N/A'}`);
      console.log(`   有内容: ${!!response.data.data?.content || !!response.data.data?.markdown}`);
    } else {
      results.push({
        name: '获取文档内容',
        status: 'failed',
        error: response.data.error || '返回数据格式错误',
      });
      console.log('❌ 获取失败:', response.data.error);
    }
  } catch (error: any) {
    results.push({
      name: '获取文档内容',
      status: 'failed',
      error: error.response?.data?.error || error.message,
    });
    console.log('❌ 测试失败:', error.message);
  }
  console.log('');

  // 测试 5: 验证授权状态 API
  console.log('📝 测试 5: 验证授权状态 API');
  console.log('--------------------------------------');
  try {
    const response = await axios.get(
      `${BASE_URL}/api/auth/feishu/status/${USER_ID}`
    );

    if (response.data.success) {
      results.push({
        name: '授权状态 API',
        status: 'passed',
        message: `授权状态: ${response.data.data?.isAuthorized ? '已授权' : '未授权'}`,
        data: response.data.data,
      });
      console.log('✅ 授权状态 API 正常');
      console.log(`   已授权: ${response.data.data?.isAuthorized}`);
      console.log(`   已过期: ${response.data.data?.isExpired}`);
    } else {
      results.push({
        name: '授权状态 API',
        status: 'failed',
        error: response.data.error,
      });
      console.log('❌ API 返回错误:', response.data.error);
    }
  } catch (error: any) {
    results.push({
      name: '授权状态 API',
      status: 'failed',
      error: error.response?.data?.error || error.message,
    });
    console.log('❌ 测试失败:', error.message);
  }
  console.log('');

  // 生成测试报告
  console.log('======================================');
  console.log('📊 自测报告');
  console.log('======================================');
  
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  
  console.log(`\n总测试数: ${results.length}`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`⏭️  跳过: ${skipped}`);
  
  console.log('\n详细结果:');
  results.forEach((result, index) => {
    const icon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
    console.log(`\n${index + 1}. ${icon} ${result.name}`);
    if (result.message) {
      console.log(`   ${result.message}`);
    }
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
  });
  
  console.log('\n======================================');
  if (failed === 0) {
    console.log('🎉 所有测试通过！飞书知识库集成正常。');
  } else {
    console.log(`⚠️  ${failed} 个测试失败，请检查。`);
  }
  console.log('======================================');
}

runTests();
