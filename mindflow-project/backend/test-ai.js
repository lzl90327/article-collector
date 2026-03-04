const { processSourceAI } = require('./src/services/ai.processor');

async function test() {
  try {
    console.log('开始测试 AI 处理...');
    await processSourceAI(
      'QeR7wj4wfiRCrMkI9zRcDkOcnth',
      'QeR7wj4wfiRCrMkI9zRcDkOcnth'
    );
    console.log('AI 处理完成');
  } catch (error) {
    console.error('AI 处理失败:', error);
  }
}

test();
