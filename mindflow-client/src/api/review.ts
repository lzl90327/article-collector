/**
 * 审阅相关 API
 * Phase 4.5: 赛博编辑部审阅
 */

import { get, post } from './interceptors';
import { API_ENDPOINTS } from './config';

// 审阅问题
export interface ReviewIssue {
  id: string;
  type: 'grammar' | 'style' | 'logic' | 'fact' | 'structure' | 'emotion';
  severity: 'high' | 'medium' | 'low';
  position?: { start: number; end: number };
  originalText?: string;
  description: string;
  suggestion: string;
}

// 智能体审阅结果
export interface AgentReview {
  agentName: string;
  model: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  issues: ReviewIssue[];
  summary?: string;
  error?: string;
}

// 整合建议
export interface ConsolidatedSuggestion {
  id: string;
  type: 'replace' | 'delete' | 'insert';
  position?: { start: number; end: number };
  original: string;
  replacement: string;
  explanation: string;
  consensus: 'unanimous' | 'majority' | 'disagreement';
  modelVotes: { model: string; agree: boolean }[];
}

// 审阅报告
export interface ReviewReport {
  reviewId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  consolidated: {
    summary: string;
    suggestions: ConsolidatedSuggestion[];
  };
  agents: Record<string, AgentReview>;
}

// 提交审阅
export const submitReview = async (data: {
  articleId: string;
  title: string;
  content: string;
}): Promise<{ reviewId: string; status: string; message: string }> => {
  return post(API_ENDPOINTS.review.submit, data);
};

// 获取审阅报告
export const getReviewReport = async (articleId: string): Promise<ReviewReport> => {
  return get<ReviewReport>(API_ENDPOINTS.review.report(articleId));
};

// 获取审阅状态
export const getReviewStatus = async (reviewId: string): Promise<{
  reviewId: string;
  status: string;
  progress: number;
  completedAgents: number;
  totalAgents: number;
}> => {
  return get(API_ENDPOINTS.review.status(reviewId));
};

// 应用审阅建议
export const applyReviewSuggestions = async (data: {
  articleId: string;
  reviewId: string;
  action: 'accept_all' | 'reject_all' | 'selective';
  selectedSuggestions?: string[];
}): Promise<{ message: string; content: string }> => {
  return post(API_ENDPOINTS.review.apply, data);
};
