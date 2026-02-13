import axios from 'axios';
import { logger } from '../utils/logger';
import zlib from 'zlib';

interface Subtitle {
  from: number;
  to: number;
  content: string;
}

export class BilibiliSubtitleService {
  /**
   * 获取 B 站视频字幕
   * @param bvid 视频 BVID
   * @param cid 视频 CID
   */
  async getSubtitle(bvid: string, cid: number): Promise<string> {
    try {
      logger.info(`尝试获取 B 站字幕: ${bvid} (cid: ${cid})`);

      // 1. 获取视频详情，找到字幕列表
      // B 站 web 接口: https://api.bilibili.com/x/player/v2?cid={cid}&bvid={bvid}
      const playerUrl = `https://api.bilibili.com/x/player/v2?cid=${cid}&bvid=${bvid}`;
      const playerRes = await axios.get(playerUrl);
      
      const subtitles = playerRes.data?.data?.subtitle?.subtitles;
      
      if (!subtitles || subtitles.length === 0) {
        logger.info(`视频 ${bvid} 无可用字幕`);
        return '';
      }

      // 优先找中文 AI 字幕 (ai-zh) 或 中文 (zh-CN)
      // 这里的逻辑可以优化，比如优先找人工字幕
      const subtitleInfo = subtitles.find((s: any) => s.lan === 'zh-CN') || 
                           subtitles.find((s: any) => s.lan === 'ai-zh') || 
                           subtitles[0];

      if (!subtitleInfo) {
        logger.warn(`未找到合适的字幕流`);
        return '';
      }

      const subtitleUrl = subtitleInfo.subtitle_url;
      // 补全协议
      const fullUrl = subtitleUrl.startsWith('//') ? `https:${subtitleUrl}` : subtitleUrl;
      
      logger.info(`下载字幕文件: ${fullUrl}`);
      
      // 2. 下载字幕 JSON
      const subRes = await axios.get(fullUrl);
      const subData = subRes.data;

      // 3. 解析字幕
      // B 站 JSON 字幕格式: { body: [ { from: 0.5, to: 1.5, content: "..." }, ... ] }
      if (!subData.body || !Array.isArray(subData.body)) {
        logger.warn('字幕文件格式不符合预期');
        return '';
      }

      const lines = subData.body.map((item: any) => item.content).join('\n');
      
      logger.info(`字幕获取成功，长度: ${lines.length} 字符`);
      return lines;

    } catch (error) {
      logger.error('获取 B 站字幕失败', error);
      return '';
    }
  }
}

export const bilibiliSubtitleService = new BilibiliSubtitleService();