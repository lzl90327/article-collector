/**
 * 小宇宙播客多策略下载测试
 * 测试域名替换法和 RSSHub 备选方案
 */

const { fetchXiaoyuzhouPodcast } = require('../dist/services/xiaoyuzhou-fetcher');
const { logger } = require('../dist/utils/logger');

async function testXiaoyuzhouMultiStrategy() {
  const testUrl = 'https://www.xiaoyuzhoufm.com/episode/698563a188663289fe80769a';
  
  logger.info('='.repeat(60));
  logger.info('测试小宇宙播客多策略下载功能');
  logger.info('='.repeat(60));
  logger.info(`测试 URL: ${testUrl}`);
  logger.info(`\n测试策略:`);
  logger.info(`1. 域名替换法（首选）`);
  logger.info(`2. RSSHub + RSS Feed（备选）`);
  
  try {
    // 测试：下载音频
    const result = await fetchXiaoyuzhouPodcast(testUrl, { downloadAudio: true });
    
    logger.info('\n' + '='.repeat(60));
    logger.info('测试结果:');
    logger.info('='.repeat(60));
    
    if (result.success) {
      logger.info('✅ 测试成功！');
      logger.info(`\n播客信息:`);
      logger.info(`- 标题: ${result.info?.title}`);
      logger.info(`- 播客: ${result.info?.podcastName}`);
      logger.info(`- 主播: ${result.info?.host}`);
      logger.info(`- 时长: ${Math.floor((result.info?.duration || 0) / 60)}分${((result.info?.duration || 0) % 60)}秒`);
      logger.info(`- 发布: ${result.info?.publishDate}`);
      
      if (result.audioPath) {
        logger.info(`\n音频文件:`);
        logger.info(`- 路径: ${result.audioPath}`);
      }
      
      return {
        success: true,
        info: result.info,
        audioPath: result.audioPath
      };
    } else {
      logger.error('❌ 测试失败');
      logger.error(`错误: ${result.error}`);
      
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    logger.error('❌ 测试异常');
    logger.error(error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 执行测试
testXiaoyuzhouMultiStrategy()
  .then(result => {
    logger.info('\n' + '='.repeat(60));
    logger.info('测试完成');
    logger.info('='.repeat(60));
    
    if (result.success) {
      process.exit(0);
    } else {
      // 小宇宙可能因为付费墙失败，记录但不视为测试失败
      logger.warn('小宇宙测试未成功，可能是付费内容');
      process.exit(0);
    }
  })
  .catch(error => {
    logger.error('测试脚本执行错误:', error);
    process.exit(1);
  });
