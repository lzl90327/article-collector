/**
 * COROS 多维表格自动化测试
 * 测试：凭证获取、查询记录、写入记录
 * 
 * 运行: npx ts-node scripts/test-coros-bitable.ts
 */

import axios from 'axios';

// COROS 专用凭证（运动入库助手）
const COROS_APP_ID = 'cli_a9fafc37a27a5bd9';
const COROS_APP_SECRET = '6zIvadMj58coozbP71M6tei7PnrnckyS';

// COROS 多维表格配置
const BITABLE_APP_TOKEN = 'P5sAb9Eq4ayM3psfCVIcsL8vnme';
const BITABLE_TABLE_ID = 'tbljtolFrhJhf2rI';

// 字段配置
const FIELDS = {
  date: '运动日期',
  sport: '运动项目',
  runKm: '跑步距离',
  rideKm: '骑行距离',
  elevM: '爬升高度',
  notes: '备注',
  source: '数据源',
  raw: '原始凭证',
  confidence: '置信度',
  dedupeKey: '去重键',
};

const BASE_URL = 'https://open.feishu.cn/open-apis';

async function getAccessToken(): Promise<string> {
  console.log('📌 步骤 1: 获取 Access Token');
  console.log(`   App ID: ${COROS_APP_ID}`);
  
  try {
    const response = await axios.post(
      `${BASE_URL}/auth/v3/tenant_access_token/internal`,
      {
        app_id: COROS_APP_ID,
        app_secret: COROS_APP_SECRET,
      }
    );
    
    if (response.data.code !== 0) {
      console.log(`   ❌ 失败: ${response.data.msg}`);
      throw new Error(response.data.msg);
    }
    
    console.log(`   ✅ 成功获取 Token`);
    return response.data.tenant_access_token;
  } catch (error: any) {
    console.log(`   ❌ 异常: ${error.message}`);
    throw error;
  }
}

async function testQueryRecords(token: string): Promise<boolean> {
  console.log('\n📌 步骤 2: 测试查询记录');
  console.log(`   表格: ${BITABLE_APP_TOKEN}/${BITABLE_TABLE_ID}`);
  
  try {
    const response = await axios.post(
      `${BASE_URL}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${BITABLE_TABLE_ID}/records/search`,
      {
        page_size: 5,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (response.data.code !== 0) {
      console.log(`   ❌ 失败: code=${response.data.code}, msg=${response.data.msg}`);
      return false;
    }
    
    const count = response.data.data?.items?.length || 0;
    console.log(`   ✅ 查询成功，返回 ${count} 条记录`);
    return true;
  } catch (error: any) {
    console.log(`   ❌ 异常: ${error.response?.data?.msg || error.message}`);
    if (error.response?.data) {
      console.log(`   详情: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function testWriteRecord(token: string): Promise<boolean> {
  console.log('\n📌 步骤 3: 测试写入记录');
  
  // 构造测试数据
  const testData = {
    fields: {
      [FIELDS.date]: Date.now(), // Unix 时间戳（毫秒）
      [FIELDS.sport]: '跑步',
      [FIELDS.runKm]: 0.01, // 测试数据：0.01km
      [FIELDS.notes]: `自动化测试 - ${new Date().toISOString()}`,
      [FIELDS.source]: '自动化测试',
      [FIELDS.confidence]: 1.0,
      [FIELDS.dedupeKey]: `test_${Date.now()}`,
    },
  };
  
  console.log(`   数据: ${JSON.stringify(testData.fields, null, 2)}`);
  
  try {
    const response = await axios.post(
      `${BASE_URL}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${BITABLE_TABLE_ID}/records`,
      testData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (response.data.code !== 0) {
      console.log(`   ❌ 写入失败: code=${response.data.code}, msg=${response.data.msg}`);
      if (response.data.error) {
        console.log(`   错误详情: ${JSON.stringify(response.data.error)}`);
      }
      return false;
    }
    
    const recordId = response.data.data?.record?.record_id;
    console.log(`   ✅ 写入成功，记录ID: ${recordId}`);
    
    // 清理测试数据
    console.log('\n📌 步骤 4: 清理测试数据');
    try {
      await axios.delete(
        `${BASE_URL}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${BITABLE_TABLE_ID}/records/${recordId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      console.log(`   ✅ 测试记录已删除`);
    } catch (e) {
      console.log(`   ⚠️ 清理失败（可手动删除）`);
    }
    
    return true;
  } catch (error: any) {
    console.log(`   ❌ 异常: ${error.response?.data?.msg || error.message}`);
    if (error.response?.data) {
      console.log(`   详情: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   COROS 多维表格自动化测试');
  console.log('═══════════════════════════════════════════\n');
  
  try {
    // 1. 获取 Token
    const token = await getAccessToken();
    
    // 2. 测试查询
    const queryOk = await testQueryRecords(token);
    
    // 3. 测试写入
    const writeOk = await testWriteRecord(token);
    
    // 汇总结果
    console.log('\n═══════════════════════════════════════════');
    console.log('   测试结果汇总');
    console.log('═══════════════════════════════════════════');
    console.log(`   Token 获取: ✅`);
    console.log(`   查询记录:   ${queryOk ? '✅' : '❌'}`);
    console.log(`   写入记录:   ${writeOk ? '✅' : '❌'}`);
    console.log('═══════════════════════════════════════════\n');
    
    if (!queryOk || !writeOk) {
      process.exit(1);
    }
    
  } catch (error) {
    console.log('\n❌ 测试失败');
    process.exit(1);
  }
}

main();
