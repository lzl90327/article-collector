/**
 * 调试 RSS Feed 内容
 */

const { rssPodcastFetcher } = require('../dist/services/rss-podcast-fetcher');
const { logger } = require('../dist/utils/logger');

async function debugRSSFeed() {
  const rssUrl = 'https://feed.xyzfm.space/hwen8wf69c6g';
  
  logger.info('开始解析 RSS Feed...');
  const { feed, episodes } = await rssPodcastFetcher.parseRSSFeed(rssUrl);
  
  logger.info('='.repeat(80));
  logger.info('RSS Feed 信息');
  logger.info('='.repeat(80));
  logger.info(`标题: ${feed.title}`);
  logger.info(`描述: ${feed.description}`);
  logger.info(`单集数量: ${episodes.length}`);
  
  logger.info('\n' + '='.repeat(80));
  logger.info('前 10 个单集标题');
  logger.info('='.repeat(80));
  
  episodes.slice(0, 10).forEach((ep, index) => {
    logger.info(`${index + 1}. ${ep.title}`);
    if (ep.duration) {
      logger.info(`   时长: ${ep.duration}`);
    }
    if (ep.publishDate) {
      logger.info(`   发布: ${ep.publishDate}`);
    }
  });
  
  // 搜索包含"荆轲"的单集
  logger.info('\n' + '='.repeat(80));
  logger.info('搜索包含"荆轲"的单集');
  logger.info('='.repeat(80));
  
  const matchedEpisodes = episodes.filter(ep => 
    ep.title && (ep.title.includes('荆轲') || ep.title.includes('刺秦'))
  );
  
  if (matchedEpisodes.length > 0) {
    matchedEpisodes.forEach(ep => {
      logger.info(`找到: ${ep.title}`);
      logger.info(`  音频: ${ep.audioUrl}`);
      logger.info(`  时长: ${ep.duration || '未知'}`);
      logger.info(`  发布: ${ep.publishDate || '未知'}`);
    });
  } else {
    logger.warn('未找到包含"荆轲"或"刺秦"的单集');
  }
}

debugRSSFeed()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    logger.error('调试脚本执行错误:', error);
    process.exit(1);
  });
