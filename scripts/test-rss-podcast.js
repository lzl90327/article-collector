/**
 * 通用 RSS 播客支持测试
 * 测试 RSS Podcast Fetcher 的 RSS 解析能力
 */

const { rssPodcastFetcher } = require('../dist/services/rss-podcast-fetcher');
const { logger } = require('../dist/utils/logger');

async function testGenericRSSPodcast() {
  // 使用一个公开的 RSS Feed 测试
  const testRssUrl = 'https://feeds.buzzsprout.com/2042975.rss'; // 示例：TED Talks Daily
  
  logger.info('='.repeat(60));
  logger.info('测试通用 RSS 播客支持');
  logger.info('='.repeat(60));
  logger.info(`测试 RSS Feed: ${testRssUrl}`);
  
  try {
    // 测试 1: 解析 RSS Feed
    logger.info('\n📝 测试 1: 解析 RSS Feed');
    const feedInfo = await rssPodcastFetcher.parseRSSFeed(testRssUrl);
    
    logger.info('✅ RSS Feed 解析成功');
    logger.info(`\nFeed 信息:`);
    logger.info(`- 标题: ${feedInfo.feed.title}`);
    logger.info(`- 描述: ${feedInfo.feed.description?.substring(0, 100)}...`);
    logger.info(`- 作者: ${feedInfo.feed.author || '未知'}`);
    logger.info(`- 单集数量: ${feedInfo.episodes.length}`);
    
    // 测试 2: 获取最新单集
    if (feedInfo.episodes.length > 0) {
      logger.info('\n📝 测试 2: 最新单集信息');
      const latestEpisode = feedInfo.episodes[0];
      
      logger.info('✅ 成功获取最新单集');
      logger.info(`\n单集信息:`);
      logger.info(`- 标题: ${latestEpisode.title}`);
      logger.info(`- 时长: ${latestEpisode.duration || '未知'}`);
      logger.info(`- 发布: ${latestEpisode.publishDate}`);
      logger.info(`- 音频 URL: ${latestEpisode.audioUrl ? '✓ 存在' : '✗ 不存在'}`);
      
      if (latestEpisode.audioUrl) {
        logger.info(`- 音频链接: ${latestEpisode.audioUrl.substring(0, 80)}...`);
      }
    }
    
    // 测试 3: RSS Feed 自动发现
    logger.info('\n📝 测试 3: RSS Feed 自动发现');
    const pageUrl = 'https://www.xiaoyuzhoufm.com/';
    const discoveredRss = await rssPodcastFetcher.discoverRSSFromPage(pageUrl);
    
    if (discoveredRss) {
      logger.info(`✅ 成功发现 RSS Feed: ${discoveredRss}`);
    } else {
      logger.info('ℹ️  未发现 RSS Feed（可能页面不支持自动发现）');
    }
    
    return {
      success: true,
      feedInfo,
      message: 'RSS 播客支持测试完成'
    };
    
  } catch (error) {
    logger.error('❌ 测试失败');
    logger.error(error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 执行测试
testGenericRSSPodcast()
  .then(result => {
    logger.info('\n' + '='.repeat(60));
    logger.info('测试完成');
    logger.info('='.repeat(60));
    
    if (result.success) {
      logger.info('✅ 所有测试通过');
      process.exit(0);
    } else {
      logger.error('❌ 测试失败');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('测试脚本执行错误:', error);
    process.exit(1);
  });
