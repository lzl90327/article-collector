/**
 * Apple Podcasts 短播客测试
 * 测试一个时长适中的播客
 */

const { fetchApplePodcast } = require('../dist/services/apple-podcasts-fetcher');
const { logger } = require('../dist/utils/logger');

async function testShortPodcast() {
  const testUrl = 'https://podcasts.apple.com/cn/podcast/%E4%B8%80-%E8%8D%86%E8%BD%B2%E5%88%BA%E7%A7%A6%E7%8E%8B/id1865370896?i=1000743296092';
  
  logger.info('='.repeat(80));
  logger.info('Apple Podcasts 实际下载测试');
  logger.info('='.repeat(80));
  logger.info(`测试 URL: ${testUrl}`);
  logger.info(`预期: 百家讲坛 - 荆轲刺秦王 (38分钟)`);
  
  try {
    logger.info('\n开始测试...\n');
    
    // 测试：下载音频
    const result = await fetchApplePodcast(testUrl, { downloadAudio: true });
    
    logger.info('\n' + '='.repeat(80));
    logger.info('测试结果');
    logger.info('='.repeat(80));
    
    if (result.success) {
      logger.info('✅ 测试成功！\n');
      
      logger.info('📋 播客信息:');
      logger.info(`   标题: ${result.info?.title}`);
      logger.info(`   播客: ${result.info?.podcastName}`);
      logger.info(`   主播: ${result.info?.host}`);
      logger.info(`   时长: ${Math.floor((result.info?.duration || 0) / 60)}分${((result.info?.duration || 0) % 60)}秒`);
      logger.info(`   发布: ${result.info?.publishDate}`);
      logger.info(`   Podcast ID: ${result.info?.podcastId}`);
      logger.info(`   Episode ID: ${result.info?.episodeId}`);
      
      if (result.audioPath) {
        logger.info('\n🎵 音频文件:');
        logger.info(`   路径: ${result.audioPath}`);
        logger.info(`   下载策略: RSS Feed (iTunes API)`);
        logger.info('   状态: ✅ 下载成功');
      } else {
        logger.warn('\n⚠️  仅提取了元数据，未下载音频');
      }
      
      logger.info('\n' + '='.repeat(80));
      logger.info('✅ Apple Podcasts RSS Feed 功能验证完成');
      logger.info('='.repeat(80));
      
      return {
        success: true,
        info: result.info,
        audioPath: result.audioPath
      };
    } else {
      logger.error('❌ 测试失败\n');
      logger.error(`错误信息: ${result.error}`);
      
      logger.info('\n' + '='.repeat(80));
      logger.info('测试未通过');
      logger.info('='.repeat(80));
      
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    logger.error('❌ 测试异常\n');
    logger.error(error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 执行测试
testShortPodcast()
  .then(result => {
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
