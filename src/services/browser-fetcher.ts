/**
 * Browser Use 文章抓取服务
 * 使用 AI 驱动的浏览器自动化抓取文章内容
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * 抓取结果
 */
export interface FetchResult {
  title: string;
  author: string;
  publishTime: string | null;
  content: string;
  error?: string;
}

/**
 * Python 虚拟环境路径
 */
const VENV_PYTHON = path.join(__dirname, '../../.venv/bin/python');
const SCRIPT_PATH = path.join(__dirname, '../../scripts/browser_fetcher.py');

/**
 * 使用 Browser Use 抓取文章
 * 
 * @param url 文章 URL
 * @param timeout 超时时间（毫秒），默认 120 秒
 * @returns 抓取结果
 */
export async function fetchArticleWithBrowser(
  url: string,
  timeout: number = 120000
): Promise<FetchResult> {
  logger.info(`开始使用 Browser Use 抓取: ${url}`);
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let isResolved = false;
    
    const childProcess: ChildProcess = spawn(VENV_PYTHON, [SCRIPT_PATH, url], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    });
    
    // 设置超时
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        childProcess.kill('SIGTERM');
        reject(new Error(`抓取超时（${timeout / 1000}秒）`));
      }
    }, timeout);
    
    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    
    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      // 记录 stderr 但不作为错误（browser-use 可能输出日志到 stderr）
      logger.debug(`Browser fetcher stderr: ${data.toString()}`);
    });
    
    childProcess.on('close', (code: number | null) => {
      clearTimeout(timeoutId);
      
      if (isResolved) return;
      isResolved = true;
      
      if (code !== 0) {
        logger.error(`Browser fetcher 退出码: ${code}, stderr: ${stderr}`);
        reject(new Error(`抓取进程异常退出: ${code}`));
        return;
      }
      
      try {
        // 尝试解析 JSON 输出
        const result = JSON.parse(stdout.trim());
        
        if (result.error) {
          logger.warn(`抓取返回错误: ${result.error}`);
          reject(new Error(result.error));
          return;
        }
        
        logger.info(`抓取成功: ${result.title}`);
        resolve({
          title: result.title || '',
          author: result.author || '',
          publishTime: result.publishTime || null,
          content: result.content || '',
        });
      } catch (parseError) {
        logger.error(`解析抓取结果失败: ${stdout}`);
        reject(new Error('解析抓取结果失败'));
      }
    });
    
    childProcess.on('error', (error: Error) => {
      clearTimeout(timeoutId);
      
      if (isResolved) return;
      isResolved = true;
      
      logger.error('启动 Browser fetcher 失败', error);
      reject(error);
    });
  });
}

/**
 * 检查 Browser Use 是否可用
 */
export async function checkBrowserUseAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const childProcess: ChildProcess = spawn(VENV_PYTHON, ['-c', 'import browser_use; print("ok")']);
    
    let stdout = '';
    
    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    
    childProcess.on('close', (code: number | null) => {
      resolve(code === 0 && stdout.includes('ok'));
    });
    
    childProcess.on('error', () => {
      resolve(false);
    });
    
    // 5 秒超时
    setTimeout(() => {
      childProcess.kill();
      resolve(false);
    }, 5000);
  });
}
