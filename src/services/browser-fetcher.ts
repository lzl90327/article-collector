/**
 * Browser Use 文章抓取服务
 * 使用 AI 驱动的浏览器自动化抓取文章内容
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
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
 * Python 环境状态
 */
interface PythonEnvStatus {
  available: boolean;
  pythonPath: string | null;
  version: string | null;
  error: string | null;
}

// 缓存 Python 环境检查结果
let pythonEnvCache: PythonEnvStatus | null = null;

/**
 * 获取项目根目录（兼容开发和生产环境）
 */
function getProjectRoot(): string {
  // 从 __dirname 向上查找，直到找到 package.json
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // 回退到 home 目录下的 article-collector
  return path.join(os.homedir(), 'article-collector');
}

/**
 * 查找可用的 Python 解释器
 * 按优先级查找：项目虚拟环境 > 系统 Python 3.11+
 */
function findPythonPath(): string | null {
  const projectRoot = getProjectRoot();
  
  // 候选路径列表
  const candidates = [
    // 项目虚拟环境
    path.join(projectRoot, '.venv', 'bin', 'python'),
    path.join(projectRoot, '.venv', 'bin', 'python3'),
    // 系统安装的 Python 3.11+
    '/usr/local/bin/python3.11',
    '/usr/local/bin/python3.12',
    '/opt/homebrew/bin/python3.11',
    '/opt/homebrew/bin/python3.12',
    // 通用路径
    '/usr/local/bin/python3',
    '/usr/bin/python3',
  ];
  
  for (const pythonPath of candidates) {
    if (fs.existsSync(pythonPath)) {
      try {
        // 验证版本 >= 3.11
        const versionOutput = execSync(`"${pythonPath}" --version 2>&1`, { encoding: 'utf-8' });
        const match = versionOutput.match(/Python (\d+)\.(\d+)/);
        if (match) {
          const major = parseInt(match[1]);
          const minor = parseInt(match[2]);
          if (major >= 3 && minor >= 11) {
            logger.debug(`找到可用 Python: ${pythonPath} (${versionOutput.trim()})`);
            return pythonPath;
          }
        }
      } catch {
        // 忽略执行错误，继续尝试下一个
      }
    }
  }
  
  return null;
}

/**
 * 检查 Python 环境状态
 */
export function checkPythonEnv(): PythonEnvStatus {
  if (pythonEnvCache) {
    return pythonEnvCache;
  }
  
  const pythonPath = findPythonPath();
  
  if (!pythonPath) {
    pythonEnvCache = {
      available: false,
      pythonPath: null,
      version: null,
      error: 'Python 3.11+ 未找到。请运行以下命令安装：\n' +
        '  cd ~/article-collector\n' +
        '  python3.11 -m venv .venv\n' +
        '  source .venv/bin/activate\n' +
        '  pip install browser-use playwright openai python-dotenv markdownify\n' +
        '  python -m playwright install chromium',
    };
    return pythonEnvCache;
  }
  
  // 检查必要的 Python 包
  try {
    execSync(`"${pythonPath}" -c "import playwright; import httpx"`, { encoding: 'utf-8' });
  } catch {
    pythonEnvCache = {
      available: false,
      pythonPath,
      version: null,
      error: 'Python 依赖未安装。请运行以下命令：\n' +
        `  source ${path.dirname(pythonPath)}/activate\n` +
        '  pip install browser-use playwright openai python-dotenv markdownify httpx\n' +
        '  python -m playwright install chromium',
    };
    return pythonEnvCache;
  }
  
  // 获取版本信息
  let version = null;
  try {
    version = execSync(`"${pythonPath}" --version`, { encoding: 'utf-8' }).trim();
  } catch {
    // 忽略
  }
  
  pythonEnvCache = {
    available: true,
    pythonPath,
    version,
    error: null,
  };
  
  logger.info(`✅ Python 环境检查通过: ${pythonPath} (${version})`);
  return pythonEnvCache;
}

/**
 * 获取 Python 路径（带自动检查）
 */
function getPythonPath(): string {
  const env = checkPythonEnv();
  if (!env.available || !env.pythonPath) {
    throw new Error(env.error || 'Python 环境不可用');
  }
  return env.pythonPath;
}

/**
 * 获取脚本路径
 */
function getScriptPath(): string {
  const projectRoot = getProjectRoot();
  return path.join(projectRoot, 'scripts', 'browser_fetcher.py');
}

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
  
  // 检查 Python 环境
  const pythonPath = getPythonPath();
  const scriptPath = getScriptPath();
  
  // 检查脚本文件是否存在
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`抓取脚本不存在: ${scriptPath}`);
  }
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let isResolved = false;
    
    const childProcess: ChildProcess = spawn(pythonPath, [scriptPath, url], {
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
  const env = checkPythonEnv();
  return env.available;
}

/**
 * 获取 Python 环境状态描述（用于错误提示）
 */
export function getPythonEnvStatusMessage(): string {
  const env = checkPythonEnv();
  if (env.available) {
    return `✅ Python 环境正常: ${env.pythonPath} (${env.version})`;
  }
  return `❌ Python 环境异常:\n${env.error}`;
}

/**
 * 重置 Python 环境缓存（用于重新检查）
 */
export function resetPythonEnvCache(): void {
  pythonEnvCache = null;
}
