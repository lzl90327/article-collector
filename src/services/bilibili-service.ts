
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '../utils/logger';
import { wikiConfig } from '../config';
import { bilibiliSubtitleService } from './bilibili-subtitle';
import { qwenService } from './qwen-service';
import { larkDocService } from './lark-doc';
import { addDocumentToWiki } from './lark-wiki';
import { mediaHandler } from './media-handler';
import { asrService } from './asr-service';
// import { aliyunASRService } from './aliyun-asr';
import { larkClient } from './lark-client';

// 模拟浏览器 Header
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.bilibili.com',
  'Cookie': process.env.BILIBILI_COOKIE || '', // 支持用户配置 Cookie
};

export interface BilibiliVideoInfo {
  title: string;
  author: string;
  description: string;
  publishDate: string;
  duration: number;
  cid: number;
  aid: number;
  bvid: string;
  cover: string;
  viewCount: number;
  likeCount: number;
  url: string;
}

export interface ProcessResult {
  videoInfo: BilibiliVideoInfo;
  subtitle: string;
  summary: string;
  docUrl: string;
  docToken: string;
}

export class BilibiliService {
  /**
   * 处理 B 站视频全流程
   * 1. 获取信息
   * 2. 获取字幕 (CC) 或 ASR 转录
   * 3. 生成 AI 摘要 (Qwen)
   * 4. 创建飞书文档
   */
  async processVideo(url: string, messageId?: string): Promise<ProcessResult> {
    logger.info(`[B站] 开始处理视频: ${url}`);
    
    // 1. 获取视频信息
    const videoInfo = await this.getVideoInfo(url);
    logger.info(`[B站] 视频信息获取成功: ${videoInfo.title}`);

    // 2. 获取字幕
    let subtitle = await bilibiliSubtitleService.getSubtitle(videoInfo.bvid, videoInfo.cid);
    let isASR = false;

    if (!subtitle) {
      logger.info('[B站] 未找到字幕，尝试使用 ASR 转录 (asrService)...');
      
      // 发送通知
      if (messageId) {
         try {
           await larkClient.replyMessage(messageId, '🎙️ 未检测到字幕，正在下载音频进行 AI 转录 (耗时较长请稍候)...');
         } catch (e) {
           logger.warn('发送 ASR 通知失败', e);
         }
      }

      try {
        // 1. 获取音频流
        const audioUrl = await mediaHandler.getPlayUrl(videoInfo.bvid, videoInfo.cid);
        
        // 2. 下载音频 (m4s)
        const tempDir = os.tmpdir();
        // 使用 .m4s 扩展名，asrService 会自动处理
        const inputPath = path.join(tempDir, `${videoInfo.bvid}_${Date.now()}.m4s`);
        await mediaHandler.downloadFile(audioUrl, inputPath, `https://www.bilibili.com/video/${videoInfo.bvid}`);
        
        // 3. ASR 转录 (自动处理分段和格式转换)
        if (messageId) {
          try {
            await larkClient.replyMessage(messageId, '⏳ 音频下载完成，正在进行智能转录...');
          } catch (e) {}
        }
        
        // 使用 transcribeLongAudio 统一处理长音频，传入视频时长避免 ffmpeg 探测失败
        const asrResult = await asrService.transcribeLongAudio(inputPath, undefined, videoInfo.duration);
        
        if (asrResult.success && asrResult.text) {
          subtitle = asrResult.text;
          isASR = true;
          logger.info('[B站] ASR 转录成功');
        } else {
          throw new Error(asrResult.error || 'ASR 返回空文本');
        }
        
        // 清理临时文件 (asrService 可能已经清理了部分，这里确保原始文件被清理)
        try {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        } catch (e) {}
        
      } catch (e: any) {
        logger.error('[B站] ASR 转录失败', e);
        if (messageId) {
            try {
              await larkClient.replyMessage(messageId, `⚠️ ASR 转录失败: ${e.message}，将仅使用简介生成摘要。`);
            } catch (err) {}
        }
        subtitle = `(未找到字幕且 ASR 转录失败，以下是视频简介)\n${videoInfo.description}`;
      }
    }

    if (!subtitle && !isASR) {
       // 如果ASR失败且无字幕，使用简介
       subtitle = `(未找到字幕，以下是视频简介)\n${videoInfo.description}`;
    }

    // 3. 生成 AI 摘要
    logger.info('[B站] 正在生成 AI 摘要...');
    const summary = await qwenService.generateSummary(videoInfo.title, subtitle);
    const oneSentence = await qwenService.generateOneSentenceSummary(videoInfo.title, subtitle);
    const tags = await qwenService.generateTags(videoInfo.title, subtitle);

    // 4. 创建文档内容
    const markdown = this.buildMarkdown(videoInfo, summary, oneSentence, tags, subtitle, isASR);

    // 5. 创建飞书文档
    logger.info('[B站] 正在创建飞书文档...');
    const { url: docUrl, token: docToken } = await larkDocService.createDocument(videoInfo.title, markdown);
    
    // 6. 归档到知识库 (后台异步执行)
    try {
      addDocumentToWiki(docToken, wikiConfig.videoParentNodeToken)
        .then(() => logger.info(`[B站] 知识库归档请求已发送`))
        .catch((e: any) => logger.error(`[B站] 知识库归档失败`, e));
    } catch (error) {
       // 防止 addDocumentToWiki 同步抛错导致崩溃
       logger.error(`[B站] 知识库归档调用失败`, error);
    }

    return {
      videoInfo,
      subtitle,
      summary,
      docUrl,
      docToken
    };
  }

  /**
   * 构建文档 Markdown
   */
  private buildMarkdown(
    info: BilibiliVideoInfo, 
    summary: string, 
    oneSentence: string, 
    tags: string[], 
    fullText: string,
    isASR: boolean = false
  ): string {
    const today = new Date().toISOString().split('T')[0];
    const sourceText = isASR ? 'AI 语音转录 (阿里云 Paraformer)' : 'B站字幕';
    
    return `
# ${info.title}

> **一句话总结**：${oneSentence}

---

## 📺 视频信息
- **UP主**：${info.author}
- **发布时间**：${info.publishDate}
- **时长**：${Math.floor(info.duration / 60)}分${info.duration % 60}秒
- **播放量**：${info.viewCount}
- **链接**：[点击观看](${info.url})
- **标签**：${tags.join(', ')}
- **收藏时间**：${today}

---

## 💡 AI 核心摘要
${summary}

---

## 📝 视频简介
${info.description}

---

## 🎙️ 逐字稿 (来源: ${sourceText})
${fullText.substring(0, 50000)} ${fullText.length > 50000 ? '\n\n(由于篇幅限制，后续内容已省略)' : ''}
`;
  }

  /**
   * 获取视频元信息
   */
  async getVideoInfo(bvidOrUrl: string): Promise<BilibiliVideoInfo> {
    let bvid = this.extractBvid(bvidOrUrl);
    
    // 如果没有找到 BVID 且是 URL，尝试解析短链
    if (!bvid && (bvidOrUrl.startsWith('http') || bvidOrUrl.includes('b23.tv'))) {
      const longUrl = await this.resolveShortUrl(bvidOrUrl);
      bvid = this.extractBvid(longUrl);
    }

    if (!bvid) {
      throw new Error('无效的 Bilibili 链接或 BVID');
    }

    logger.info(`[B站] 获取视频信息: ${bvid}`);
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    
    try {
      const { data } = await axios.get(url, { headers: HEADERS });
      
      if (data.code !== 0) {
        throw new Error(`API 错误: ${data.message}`);
      }

      const v = data.data;
      return {
        title: v.title,
        author: v.owner.name,
        description: v.desc,
        publishDate: new Date(v.pubdate * 1000).toISOString().split('T')[0],
        duration: v.duration,
        cid: v.cid,
        aid: v.aid,
        bvid: v.bvid,
        cover: v.pic,
        viewCount: v.stat.view,
        likeCount: v.stat.like,
        url: `https://www.bilibili.com/video/${v.bvid}`
      };
    } catch (error: any) {
      logger.error(`[B站] 获取信息失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 解析短链接
   */
  private async resolveShortUrl(url: string): Promise<string> {
    try {
      const response = await axios.head(url, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400,
      });
      return response.headers.location || url;
    } catch (error: any) {
      // 如果 HEAD 请求失败，尝试 GET 请求
      try {
        const response = await axios.get(url, {
          maxRedirects: 0,
          validateStatus: (status) => status >= 300 && status < 400,
        });
        return response.headers.location || url;
      } catch (e) {
        return url;
      }
    }
  }

  /**
   * 提取 BVID
   */
  private extractBvid(url: string): string | null {
    const match = url.match(/BV[a-zA-Z0-9]+/);
    return match ? match[0] : null;
  }
}

export const bilibiliService = new BilibiliService();
