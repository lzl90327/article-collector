/**
 * AI 处理测试脚本
 */

// 手动设置环境变量
process.env.DEEPSEEK_API_KEY = 'sk-a4b86e2a86584010af6891f6d30cecee';

import { generateSourceSummary } from './src/services/deepseek.service';

// 测试文章内容
const testContent = `
# AI时代，什么人不会被淘汰

在纳瓦尔最新播客中，他讨论了 AI 时代个人如何保持竞争力的问题。

## 核心观点

1. **学习能力强的人**
   能够快速适应新技术、新工具的人将在 AI 时代占据优势。

2. **有创造力的人**
   AI 可以处理重复性工作，但创造力仍然是人类的独特优势。

3. **情商高的人**
   人际交往、情感连接是 AI 难以替代的领域。

4. **跨学科思维的人**
   能够将不同领域的知识结合起来解决问题的人将更有价值。

## 结论

纳瓦尔认为，未来最不容易被淘汰的人是那些能够利用 AI 工具放大自己能力的人，而不是与 AI 竞争的人。
`;

async function testAI() {
  console.log('开始测试 AI 摘要生成...\n');
  console.log('测试内容长度:', testContent.length, '字符\n');

  try {
    const result = await generateSourceSummary(testContent);

    console.log('=== AI 处理结果 ===\n');
    console.log('摘要:');
    console.log(result.summary);
    console.log('\n核心观点:');
    result.viewpoints.forEach((point, idx) => {
      console.log(`${idx + 1}. ${point}`);
    });

    console.log('\n=== 测试成功 ===');
  } catch (error) {
    console.error('AI 处理失败:', error);
  }
}

testAI();
