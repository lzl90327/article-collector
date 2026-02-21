/**
 * API 类型定义
 * 定义所有 API 请求和响应的数据类型
 */

import type {
  WorkflowState,
  Brief,
  AngleSelectionResult,
  Message,
  ApiResponse,
} from './workflow';

// ============================================================================
// 基础 API 类型
// ============================================================================

/** HTTP 方法 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** 请求配置 */
export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

/** 流式请求回调 */
export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (err: Error) => void;
}

// ============================================================================
// 工作流 API 类型
// ============================================================================

/** 启动工作流请求 */
export interface StartWorkflowRequest {
  /** 用户输入的写作主题 */
  input?: string;
}

/** 启动工作流响应 */
export interface StartWorkflowResponse {
  /** 工作流 ID */
  workflowId: string;
  /** 工作流初始状态 */
  state: WorkflowState;
}

/** 获取工作流状态响应 */
export type GetWorkflowStateResponse = WorkflowState;

/** 发送聊天消息请求 */
export interface SendChatMessageRequest {
  /** 用户输入的消息 */
  input: string;
}

/** 发送聊天消息响应 */
export interface SendChatMessageResponse {
  /** 更新后的工作流状态 */
  state: WorkflowState;
}

/** 流式聊天消息请求 */
export interface SendChatMessageStreamRequest {
  /** 用户输入的消息 */
  input: string;
}

/** 触发阶段转换请求 */
export interface TriggerPhaseRequest {
  /** 附加数据（如 Brief 更新） */
  data?: {
    brief?: Brief;
    [key: string]: unknown;
  };
}

/** 触发阶段转换响应 */
export interface TriggerPhaseResponse {
  /** 更新后的工作流状态 */
  state: WorkflowState;
}

// ============================================================================
// Taro Request 类型
// ============================================================================

/** Taro 请求参数 */
export interface TaroRequestParams {
  url: string;
  method?: HttpMethod;
  data?: unknown;
  header?: Record<string, string>;
  timeout?: number;
  enableChunked?: boolean;
  responseType?: string;
}

/** Taro 响应数据 */
export interface TaroResponse<T = unknown> {
  data: T;
  statusCode: number;
  header: Record<string, string>;
  cookies?: string[];
}

/** Taro 请求任务 */
export interface TaroRequestTask {
  abort: () => void;
  onChunkReceived?: (callback: (response: { data: ArrayBuffer }) => void) => void;
  offChunkReceived?: (callback: (response: { data: ArrayBuffer }) => void) => void;
}

/** Taro 错误响应 */
export interface TaroError {
  errMsg: string;
  errno?: number;
}

// ============================================================================
// API 错误类型
// ============================================================================

/** API 错误码 */
export enum ApiErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_PARAMS = 'INVALID_PARAMS',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNKNOWN = 'UNKNOWN',
}

/** API 错误详情 */
export interface ApiErrorDetail {
  code: ApiErrorCode;
  message: string;
  statusCode?: number;
  originalError?: Error;
}

// ============================================================================
// 工具函数类型
// ============================================================================

/** 请求函数类型 */
export type RequestFn = <T>(
  url: string,
  method: HttpMethod,
  data?: unknown,
  config?: RequestConfig
) => Promise<T>;

/** 流式请求函数类型 */
export type StreamRequestFn = (
  url: string,
  data: unknown,
  callbacks: StreamCallbacks
) => TaroRequestTask;

/** API 函数集合 */
export interface ApiFunctions {
  startWorkflow: (input?: string) => Promise<StartWorkflowResponse>;
  getWorkflowState: (workflowId: string) => Promise<WorkflowState>;
  sendChatMessage: (workflowId: string, input: string) => Promise<SendChatMessageResponse>;
  sendChatMessageStream: (
    workflowId: string,
    input: string,
    callbacks: StreamCallbacks
  ) => TaroRequestTask;
  triggerPhase: (workflowId: string, data?: unknown) => Promise<TriggerPhaseResponse>;
}

// ============================================================================
// 后端 API 响应格式（原始）
// ============================================================================

/** 后端标准响应格式 */
export interface BackendResponse<T> {
  code: number;
  data: T;
  message: string;
  success: boolean;
}

/** 后端错误响应 */
export interface BackendErrorResponse {
  code: number;
  message: string;
  error?: string;
  stack?: string;
}

// ============================================================================
// Mock 数据类型
// ============================================================================

/** Mock 响应配置 */
export interface MockResponseConfig<T> {
  delay?: number;
  success?: boolean;
  data?: T;
  error?: ApiErrorDetail;
}

/** Mock API 处理器 */
export type MockApiHandler<T> = (
  params: unknown
) => MockResponseConfig<T> | Promise<MockResponseConfig<T>>;
