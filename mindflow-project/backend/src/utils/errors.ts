/**
 * 统一错误处理模块
 * 提供应用级错误类型和错误处理工具
 */

/**
 * 应用错误码枚举
 */
export enum ErrorCode {
  // 系统级错误 (1xxx)
  UNKNOWN_ERROR = '1000',
  CONFIG_ERROR = '1001',
  NETWORK_ERROR = '1002',
  TIMEOUT_ERROR = '1003',

  // 飞书 API 错误 (2xxx)
  LARK_API_ERROR = '2000',
  LARK_AUTH_ERROR = '2001',
  LARK_PERMISSION_ERROR = '2002',
  LARK_RATE_LIMIT = '2003',

  // 内容抓取错误 (3xxx)
  FETCH_ERROR = '3000',
  FETCH_TIMEOUT = '3001',
  FETCH_PARSE_ERROR = '3002',
  FETCH_BLOCKED = '3003',

  // AI 服务错误 (4xxx)
  LLM_ERROR = '4000',
  LLM_RATE_LIMIT = '4001',
  LLM_TOKEN_EXCEEDED = '4002',

  // 存储错误 (5xxx)
  STORAGE_ERROR = '5000',
  STORAGE_NOT_FOUND = '5001',
  STORAGE_DUPLICATE = '5002',

  // 用户输入错误 (6xxx)
  INVALID_URL = '6000',
  INVALID_CONTENT = '6001',
  UNSUPPORTED_TYPE = '6002',

  // 业务逻辑冲突 (7xxx)
  BRIEF_NOT_CONFIRMED = '7000',
  JOB_NOT_COMPLETED = '7001',
  JOB_CANNOT_CANCEL = '7002',
}

/**
 * 用户友好的错误消息映射
 */
export const ErrorMessageMap: Record<ErrorCode, string> = {
  [ErrorCode.UNKNOWN_ERROR]: '发生未知错误，请稍后重试',
  [ErrorCode.CONFIG_ERROR]: '服务配置错误，请联系管理员',
  [ErrorCode.NETWORK_ERROR]: '网络连接异常，请检查网络后重试',
  [ErrorCode.TIMEOUT_ERROR]: '操作超时，请稍后重试',

  [ErrorCode.LARK_API_ERROR]: '飞书服务异常，请稍后重试',
  [ErrorCode.LARK_AUTH_ERROR]: '飞书认证失败，请联系管理员',
  [ErrorCode.LARK_PERMISSION_ERROR]: '权限不足，请将机器人添加到相应空间',
  [ErrorCode.LARK_RATE_LIMIT]: '请求过于频繁，请稍后再试',

  [ErrorCode.FETCH_ERROR]: '内容抓取失败，请检查链接是否有效',
  [ErrorCode.FETCH_TIMEOUT]: '抓取超时，可能是网站响应慢或反爬限制',
  [ErrorCode.FETCH_PARSE_ERROR]: '内容解析失败，请尝试其他链接',
  [ErrorCode.FETCH_BLOCKED]: '目标网站阻止了访问，请尝试手动复制内容',

  [ErrorCode.LLM_ERROR]: 'AI 分析服务异常，将使用降级方案',
  [ErrorCode.LLM_RATE_LIMIT]: 'AI 服务繁忙，请稍后再试',
  [ErrorCode.LLM_TOKEN_EXCEEDED]: '内容过长，已截取部分进行分析',

  [ErrorCode.STORAGE_ERROR]: '数据保存失败，请稍后重试',
  [ErrorCode.STORAGE_NOT_FOUND]: '找不到指定记录',
  [ErrorCode.STORAGE_DUPLICATE]: '该内容已存在，请勿重复保存',

  [ErrorCode.INVALID_URL]: '无效的链接地址，请检查链接格式',
  [ErrorCode.INVALID_CONTENT]: '内容格式不支持或为空',
  [ErrorCode.UNSUPPORTED_TYPE]: '不支持的消息类型',

  [ErrorCode.BRIEF_NOT_CONFIRMED]: 'Brief 尚未确认，请先确认 Brief 后再继续',
  [ErrorCode.JOB_NOT_COMPLETED]: 'Job 尚未完成，无法固化',
  [ErrorCode.JOB_CANNOT_CANCEL]: 'Job 当前状态无法取消',
};

/**
 * 应用错误类
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly retryable: boolean;
  public readonly context?: Record<string, any>;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    retryable: boolean = false,
    context?: Record<string, any>,
    statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = ErrorMessageMap[code] || message;
    this.retryable = retryable;
    this.context = context;
    this.statusCode = statusCode;
    this.details = context;

    // 保持堆栈跟踪
    Error.captureStackTrace?.(this, AppError);
  }

  /**
   * 创建网络错误
   */
  static network(message: string, context?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.NETWORK_ERROR, true, context);
  }

  /**
   * 创建超时错误
   */
  static timeout(operation: string, timeoutMs: number): AppError {
    return new AppError(
      `${operation} 超时 (${timeoutMs}ms)`,
      ErrorCode.TIMEOUT_ERROR,
      true,
      { operation, timeoutMs }
    );
  }

  /**
   * 创建飞书 API 错误
   */
  static lark(message: string, code?: number, context?: Record<string, any>): AppError {
    let errorCode = ErrorCode.LARK_API_ERROR;
    if (code === 401 || code === 403) {
      errorCode = ErrorCode.LARK_PERMISSION_ERROR;
    } else if (code === 429) {
      errorCode = ErrorCode.LARK_RATE_LIMIT;
    }
    return new AppError(message, errorCode, errorCode === ErrorCode.LARK_RATE_LIMIT, context);
  }

  /**
   * 创建抓取错误
   */
  static fetch(message: string, url: string, retryable: boolean = true): AppError {
    return new AppError(
      message,
      ErrorCode.FETCH_ERROR,
      retryable,
      { url }
    );
  }

  /**
   * 创建存储错误
   */
  static storage(message: string, context?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.STORAGE_ERROR, true, context);
  }

  /**
   * 转换为日志格式
   */
  toLogObject(): Record<string, any> {
    return {
      errorName: this.name,
      errorCode: this.code,
      message: this.message,
      userMessage: this.userMessage,
      retryable: this.retryable,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * 错误处理器类型
 */
type ErrorHandler = (error: Error, context?: Record<string, any>) => void | Promise<void>;

/**
 * 全局错误处理器注册表
 */
const errorHandlers: ErrorHandler[] = [];

/**
 * 注册错误处理器
 */
export function registerErrorHandler(handler: ErrorHandler): void {
  errorHandlers.push(handler);
}

/**
 * 处理错误
 */
export async function handleError(
  error: Error,
  context?: Record<string, any>
): Promise<void> {
  // 执行所有注册的处理器
  for (const handler of errorHandlers) {
    try {
      await handler(error, context);
    } catch (handlerError) {
      console.error('错误处理器执行失败:', handlerError);
    }
  }
}

/**
 * 包装异步函数，统一错误处理
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  context?: Record<string, any>
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const appError = new AppError(
        error instanceof Error ? error.message : '未知错误',
        errorCode,
        false,
        { ...context, originalError: error }
      );

      await handleError(appError, context);
      throw appError;
    }
  }) as T;
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * 从任意错误提取用户友好消息
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    // 检查常见的错误类型
    if (error.message.includes('timeout') || error.message.includes('超时')) {
      return ErrorMessageMap[ErrorCode.TIMEOUT_ERROR];
    }
    if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      return ErrorMessageMap[ErrorCode.NETWORK_ERROR];
    }
    if (error.message.includes('permission') || error.message.includes('403')) {
      return ErrorMessageMap[ErrorCode.LARK_PERMISSION_ERROR];
    }
    return '操作失败，请稍后重试';
  }

  return ErrorMessageMap[ErrorCode.UNKNOWN_ERROR];
}
