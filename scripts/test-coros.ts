/**
 * COROS 功能综合自动化测试
 * 
 * 测试内容：
 * 1. OCR 文本解析（单元测试）
 * 2. 运动截图判断
 * 3. 去重键生成
 * 4. Bitable 集成测试
 * 
 * 运行: npx ts-node scripts/test-coros.ts
 * 仅运行单元测试: npx ts-node scripts/test-coros.ts --unit
 * 仅运行集成测试: npx ts-node scripts/test-coros.ts --integration
 */

import axios from 'axios';

// ============================================================
// 导入被测模块（复制核心逻辑，避免依赖编译后的文件）
// ============================================================

type SportType = 'run' | 'ride' | 'climb' | 'unknown';

interface SportRecord {
  sportType: SportType;
  startDate: string | null;
  distanceKm: number | null;
  elevationM: number | null;
  durationMin: number | null;
  rawText: string;
  confidence: number;
}

// 运动截图识别关键词
const SPORT_KEYWORDS = [
  '跑步', '骑行', '骑车', '自行车', '爬升', '徒步', '登山', '游泳',
  'run', 'running', 'ride', 'cycling', 'bike', 'climb', 'hiking', 'swim',
  '户外跑', '室内跑', '越野跑', '马拉松',
  '配速', '心率', '步频', '步幅', '卡路里',
  'pace', 'bpm', 'cadence', 'calorie',
  'COROS', 'Garmin', '佳明', 'Suunto', 'Polar',
  '/km', 'km/h', '公里', '千米', '米', '分钟',
];

function isSportScreenshot(text: string): boolean {
  const lowerText = text.toLowerCase();
  let matchCount = 0;
  for (const keyword of SPORT_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }
  return matchCount >= 2;
}

function parseTextToSportRecord(text: string): SportRecord {
  let sportType: SportType = 'unknown';
  let startDate: string | null = null;
  let distanceKm: number | null = null;
  let elevationM: number | null = null;
  let durationMin: number | null = null;

  const lowerText = text.toLowerCase();

  // 识别运动类型
  if (
    lowerText.includes('跑步') ||
    lowerText.includes('run') ||
    lowerText.includes('running') ||
    lowerText.includes('户外跑') ||
    lowerText.includes('室内跑') ||
    lowerText.includes('越野跑')
  ) {
    sportType = 'run';
  } else if (
    lowerText.includes('骑行') ||
    lowerText.includes('ride') ||
    lowerText.includes('cycling') ||
    lowerText.includes('骑车') ||
    lowerText.includes('自行车') ||
    lowerText.includes('bike')
  ) {
    sportType = 'ride';
  } else if (
    lowerText.includes('爬楼') ||
    lowerText.includes('爬升') ||
    lowerText.includes('climb') ||
    lowerText.includes('hiking') ||
    lowerText.includes('登山') ||
    lowerText.includes('徒步') ||
    lowerText.includes('攀登') ||
    lowerText.includes('楼梯')
  ) {
    sportType = 'climb';
  }

  // 提取日期
  const datePatterns = [
    /(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})[日]?/,
    /(\d{1,2})[-\/月](\d{1,2})[日]?[,\s]+(\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      let year: string, month: string, day: string;
      if (dateMatch[3] && dateMatch[3].length === 4) {
        month = dateMatch[1];
        day = dateMatch[2];
        year = dateMatch[3];
      } else {
        year = dateMatch[1];
        month = dateMatch[2];
        day = dateMatch[3];
      }
      startDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      break;
    }
  }

  if (!startDate) {
    const today = new Date();
    startDate = today.toISOString().split('T')[0];
  }

  // 提取距离
  const distancePatterns = [
    /(\d+\.?\d*)\s*(?:公里|千米|km|KM|Km)/i,
    /距离[：:\s]*(\d+\.?\d*)/,
    /(?:total\s+)?distance[：:\s]*(\d+\.?\d*)/i,
  ];
  for (const pattern of distancePatterns) {
    const match = text.match(pattern);
    if (match) {
      distanceKm = parseFloat(match[1]);
      break;
    }
  }

  // 提取爬升高度
  const elevationPatterns = [
    /(?:累计)?(?:爬升|上升)[：:\s]*(\d+\.?\d*)\s*(?:米|m|M)?/i,
    /(?:elevation|ascent)[：:\s]*(\d+\.?\d*)\s*(?:m|M)?/i,
    /(\d+\.?\d*)\s*(?:米|m)\s*(?:爬升|上升)/i,
  ];
  for (const pattern of elevationPatterns) {
    const match = text.match(pattern);
    if (match) {
      elevationM = parseFloat(match[1]);
      break;
    }
  }

  // 提取时长
  const hhmmssMatch = text.match(/(\d+):(\d{2}):(\d{2})/);
  if (hhmmssMatch) {
    const hours = parseInt(hhmmssMatch[1], 10);
    const minutes = parseInt(hhmmssMatch[2], 10);
    const seconds = parseInt(hhmmssMatch[3], 10);
    durationMin = hours * 60 + minutes + Math.round(seconds / 60);
  }

  if (durationMin === null) {
    const mmssMatch = text.match(/(?:运动时间|时长|duration)[：:\s]*(\d+):(\d{2})/i);
    if (mmssMatch) {
      const minutes = parseInt(mmssMatch[1], 10);
      const seconds = parseInt(mmssMatch[2], 10);
      durationMin = minutes + Math.round(seconds / 60);
    }
  }

  if (durationMin === null) {
    const chineseMatch = text.match(
      /(\d+)\s*(?:小时|时)\s*(\d+)\s*(?:分钟?|分)\s*(?:(\d+)\s*秒)?/
    );
    if (chineseMatch) {
      const hours = parseInt(chineseMatch[1], 10) || 0;
      const minutes = parseInt(chineseMatch[2], 10) || 0;
      const seconds = parseInt(chineseMatch[3], 10) || 0;
      durationMin = hours * 60 + minutes + Math.round(seconds / 60);
    }
  }

  // 计算置信度
  let confidence = 0.5;
  if (text.length > 50) confidence += 0.1;
  if (sportType !== 'unknown') confidence += 0.1;
  if (distanceKm !== null) confidence += 0.1;
  if (durationMin !== null) confidence += 0.1;
  confidence = Math.min(confidence, 0.95);

  return {
    sportType,
    startDate,
    distanceKm,
    elevationM,
    durationMin,
    rawText: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
    confidence,
  };
}

function generateDedupeKey(record: SportRecord): string {
  const parts = [
    record.sportType,
    record.startDate || 'no-date',
    record.distanceKm?.toFixed(1) || 'no-dist',
    record.elevationM?.toFixed(0) || 'no-elev',
  ];
  return parts.join('_');
}

// ============================================================
// 测试框架
// ============================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve(fn())
    .then(() => {
      testResults.push({ name, passed: true });
      console.log(`  ✅ ${name}`);
    })
    .catch((error: any) => {
      testResults.push({ name, passed: false, error: error.message });
      console.log(`  ❌ ${name}`);
      console.log(`     ${error.message}`);
    });
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || '条件不满足');
  }
}

// ============================================================
// 单元测试
// ============================================================

async function runUnitTests(): Promise<void> {
  console.log('\n📦 单元测试：OCR 文本解析\n');

  // 1. 运动截图判断测试
  console.log('  --- 运动截图判断 ---');

  await test('识别跑步截图', () => {
    const text = '跑步 5.2公里 配速 6:30/km 心率 145bpm';
    assertTrue(isSportScreenshot(text), '应识别为运动截图');
  });

  await test('识别骑行截图', () => {
    const text = '骑行距离 30km 平均速度 25km/h 卡路里 500';
    assertTrue(isSportScreenshot(text), '应识别为运动截图');
  });

  await test('识别 COROS 截图', () => {
    const text = 'COROS PACE 3 户外跑 10.5公里';
    assertTrue(isSportScreenshot(text), '应识别为运动截图');
  });

  await test('排除普通图片', () => {
    const text = '今天天气真好，出去玩了';
    assertTrue(!isSportScreenshot(text), '不应识别为运动截图');
  });

  await test('排除文章截图', () => {
    const text = '深度学习在自然语言处理中的应用研究报告';
    assertTrue(!isSportScreenshot(text), '不应识别为运动截图');
  });

  // 2. 运动类型识别测试
  console.log('\n  --- 运动类型识别 ---');

  await test('识别跑步类型', () => {
    const result = parseTextToSportRecord('户外跑 5公里 30分钟');
    assertEqual(result.sportType, 'run', '应为跑步类型');
  });

  await test('识别骑行类型', () => {
    const result = parseTextToSportRecord('骑行 20公里 1小时');
    assertEqual(result.sportType, 'ride', '应为骑行类型');
  });

  await test('识别爬升类型', () => {
    const result = parseTextToSportRecord('爬楼 累计上升 500米');
    assertEqual(result.sportType, 'climb', '应为爬升类型');
  });

  await test('未知运动类型', () => {
    const result = parseTextToSportRecord('今天锻炼了30分钟');
    assertEqual(result.sportType, 'unknown', '应为未知类型');
  });

  // 3. 日期解析测试
  console.log('\n  --- 日期解析 ---');

  await test('解析 YYYY-MM-DD 格式', () => {
    const result = parseTextToSportRecord('2026-02-04 跑步 5公里');
    assertEqual(result.startDate, '2026-02-04');
  });

  await test('解析 YYYY/MM/DD 格式', () => {
    const result = parseTextToSportRecord('2026/2/4 骑行 10公里');
    assertEqual(result.startDate, '2026-02-04');
  });

  await test('解析中文日期格式', () => {
    const result = parseTextToSportRecord('2026年2月4日 跑步');
    assertEqual(result.startDate, '2026-02-04');
  });

  // 4. 距离解析测试
  console.log('\n  --- 距离解析 ---');

  await test('解析公里数', () => {
    const result = parseTextToSportRecord('跑步 10.5公里');
    assertEqual(result.distanceKm, 10.5);
  });

  await test('解析 km 单位', () => {
    const result = parseTextToSportRecord('距离: 5.2km');
    assertEqual(result.distanceKm, 5.2);
  });

  await test('解析整数距离', () => {
    const result = parseTextToSportRecord('骑行 30 公里');
    assertEqual(result.distanceKm, 30);
  });

  // 5. 爬升高度解析测试
  console.log('\n  --- 爬升高度解析 ---');

  await test('解析累计爬升', () => {
    const result = parseTextToSportRecord('爬楼 累计上升: 420 米');
    assertEqual(result.elevationM, 420);
  });

  await test('解析爬升高度', () => {
    const result = parseTextToSportRecord('爬升 800m');
    assertEqual(result.elevationM, 800);
  });

  // 6. 时长解析测试
  console.log('\n  --- 时长解析 ---');

  await test('解析 HH:MM:SS 格式', () => {
    const result = parseTextToSportRecord('跑步 时长 1:30:00');
    assertEqual(result.durationMin, 90);
  });

  await test('解析 MM:SS 格式', () => {
    const result = parseTextToSportRecord('运动时间 45:30');
    assertEqual(result.durationMin, 46); // 45分30秒约等于46分
  });

  await test('解析中文时长', () => {
    const result = parseTextToSportRecord('跑步 2小时15分钟');
    assertEqual(result.durationMin, 135);
  });

  // 7. 去重键生成测试
  console.log('\n  --- 去重键生成 ---');

  await test('生成跑步去重键', () => {
    const record: SportRecord = {
      sportType: 'run',
      startDate: '2026-02-04',
      distanceKm: 5.0,
      elevationM: null,
      durationMin: 30,
      rawText: '',
      confidence: 0.8,
    };
    const key = generateDedupeKey(record);
    assertEqual(key, 'run_2026-02-04_5.0_no-elev');
  });

  await test('生成爬升去重键', () => {
    const record: SportRecord = {
      sportType: 'climb',
      startDate: '2026-02-04',
      distanceKm: null,
      elevationM: 420,
      durationMin: 46,
      rawText: '',
      confidence: 0.8,
    };
    const key = generateDedupeKey(record);
    assertEqual(key, 'climb_2026-02-04_no-dist_420');
  });

  // 8. 真实 OCR 文本测试
  console.log('\n  --- 真实 OCR 文本 ---');

  await test('解析真实爬楼截图', () => {
    const ocrText = `这张运动记录截图中的文字信息如下：
运动类型：爬楼
日期：2026年2月1日 18:55
累计上升：420 m
爬楼层数：139 层
运动时间：46:10
平均心率：124 bpm
卡路里：400 kcal
训练负荷：45 TL (较小)`;

    const result = parseTextToSportRecord(ocrText);
    assertEqual(result.sportType, 'climb', '类型应为爬楼');
    assertEqual(result.startDate, '2026-02-01', '日期应为 2026-02-01');
    assertEqual(result.elevationM, 420, '爬升应为 420m');
    assertEqual(result.durationMin, 46, '时长应为 46 分钟');
  });

  await test('解析真实跑步截图', () => {
    const ocrText = `COROS PACE 3
户外跑
2026年1月20日 07:30
距离 10.52 公里
时长 1:05:30
平均配速 6:14/km
平均心率 152 bpm`;

    const result = parseTextToSportRecord(ocrText);
    assertEqual(result.sportType, 'run', '类型应为跑步');
    assertEqual(result.startDate, '2026-01-20', '日期应为 2026-01-20');
    assertEqual(result.distanceKm, 10.52, '距离应为 10.52km');
    assertTrue(result.durationMin! >= 65 && result.durationMin! <= 66, '时长约 65-66 分钟');
  });
}

// ============================================================
// 集成测试（Bitable）
// ============================================================

// COROS 专用凭证
const COROS_APP_ID = 'cli_a9fafc37a27a5bd9';
const COROS_APP_SECRET = '6zIvadMj58coozbP71M6tei7PnrnckyS';
const BITABLE_APP_TOKEN = 'P5sAb9Eq4ayM3psfCVIcsL8vnme';
const BITABLE_TABLE_ID = 'tbljtolFrhJhf2rI';
const BASE_URL = 'https://open.feishu.cn/open-apis';

const FIELDS = {
  date: '运动日期',
  sport: '运动项目',
  runKm: '跑步距离',
  rideKm: '骑行距离',
  elevM: '爬升高度',
  notes: '备注',
  source: '数据源',
  confidence: '置信度',
  dedupeKey: '去重键',
};

async function runIntegrationTests(): Promise<void> {
  console.log('\n🔗 集成测试：Bitable 读写\n');

  let token: string;

  // 获取 Token
  await test('获取 Access Token', async () => {
    const response = await axios.post(
      `${BASE_URL}/auth/v3/tenant_access_token/internal`,
      {
        app_id: COROS_APP_ID,
        app_secret: COROS_APP_SECRET,
      }
    );

    if (response.data.code !== 0) {
      throw new Error(`获取 Token 失败: ${response.data.msg}`);
    }
    token = response.data.tenant_access_token;
  });

  // 查询记录
  await test('查询 Bitable 记录', async () => {
    const response = await axios.post(
      `${BASE_URL}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${BITABLE_TABLE_ID}/records/search`,
      { page_size: 5 },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.code !== 0) {
      throw new Error(`查询失败: code=${response.data.code}, msg=${response.data.msg}`);
    }
  });

  // 写入并清理测试记录
  await test('写入 Bitable 记录', async () => {
    const testDedupeKey = `test_${Date.now()}`;
    const testData = {
      fields: {
        [FIELDS.date]: Date.now(),
        [FIELDS.sport]: '跑步',
        [FIELDS.runKm]: 0.01,
        [FIELDS.notes]: `自动化测试 - ${new Date().toISOString()}`,
        [FIELDS.source]: '自动化测试',
        [FIELDS.confidence]: 1.0,
        [FIELDS.dedupeKey]: testDedupeKey,
      },
    };

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
      throw new Error(`写入失败: code=${response.data.code}, msg=${response.data.msg}`);
    }

    const recordId = response.data.data?.record?.record_id;

    // 清理测试数据
    try {
      await axios.delete(
        `${BASE_URL}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${BITABLE_TABLE_ID}/records/${recordId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
    } catch {
      console.log('     ⚠️ 清理测试数据失败（可手动删除）');
    }
  });
}

// ============================================================
// 主函数
// ============================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const runUnit = args.length === 0 || args.includes('--unit');
  const runIntegration = args.length === 0 || args.includes('--integration');

  console.log('═══════════════════════════════════════════');
  console.log('   COROS 功能自动化测试');
  console.log('═══════════════════════════════════════════');

  if (runUnit) {
    await runUnitTests();
  }

  if (runIntegration) {
    await runIntegrationTests();
  }

  // 汇总结果
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log('\n═══════════════════════════════════════════');
  console.log('   测试结果汇总');
  console.log('═══════════════════════════════════════════');
  console.log(`   通过: ${passed}`);
  console.log(`   失败: ${failed}`);
  console.log(`   总计: ${testResults.length}`);
  console.log('═══════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('失败的测试:');
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  }

  console.log('✅ 所有测试通过！\n');
}

main().catch((error) => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
