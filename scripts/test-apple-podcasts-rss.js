/**
 * Apple Podcasts RSS Feed 下载测试
 * 测试新增的 RSS Feed 功能
 */

const { fetchApplePodcast } = require('../dist/services/apple-podcasts-fetcher');
const { logger } = require('../dist/utils/logger');

async function testApplePodcastsRSS() {
  const testUrl = 'https://podcasts.apple.com/cn/podcast/罗永浩的十字路口/id1834069371?i=1000747967318';
  
  logger.info('='.repeat(60));
  logger.info('测试 Apple Podcasts RSS Feed 下载功能');
  logger.info('='.repeat(60));
  logger.info(`测试 URL: ${testUrl}`);
  
  try {
    // 测试：下载音频
    const result = await fetchApplePodcast(testUrl, { downloadAudio: true });
    
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
        logger.info(`- 下载方式: RSS Feed`);
      }
      
      // 返回结果供后续处理
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
testApplePodcastsRSS()
  .then(result => {
    logger.info('\n' + '='.repeat(60));
    logger.info('测试完成');
    logger.info('='.repeat(60));
    
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('测试脚本执行错误:', error);
    process.exit(1);
  });
