/**
 * 审阅报告页面 - Phase 4.5
 * 赛博编辑部审阅结果展示
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Loading, Empty } from '../../components';
import {
  submitReview,
  getReviewReport,
  getReviewStatus,
  applyReviewSuggestions,
  ReviewReport as ReviewReportType,
} from '../../api';
import './index.scss';

// 智能体配置
const AGENT_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  logicJudge: { name: '逻辑判官', icon: '⚖️', color: '#1890ff' },
  emotionDetector: { name: '情感共鸣', icon: '❤️', color: '#eb2f96' },
  subjectivity: { name: '主体性注入', icon: '💡', color: '#faad14' },
  structure: { name: '结构优化', icon: '🏗️', color: '#52c41a' },
  style: { name: '文风润色', icon: '✨', color: '#722ed1' },
  factCheck: { name: '事实核查', icon: '🔍', color: '#f5222d' },
  audience: { name: '受众分析', icon: '👥', color: '#13c2c2' },
};

export default function ReviewPage() {
  const [articleId, setArticleId] = useState<string>('');
  const [reviewId, setReviewId] = useState<string>('');
  const [report, setReport] = useState<ReviewReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedAgents, setExpandedAgents] = useState<string[]>([]);

  useLoad(async (options) => {
    if (options?.articleId) {
      setArticleId(options.articleId);
      await loadReviewReport(options.articleId);
    }
  });

  // 加载审阅报告
  const loadReviewReport = async (id: string) => {
    try {
      setLoading(true);
      const data = await getReviewReport(id);
      setReport(data);
      setReviewId(data.reviewId);

      // 如果还在处理中，轮询状态
      if (data.status === 'processing') {
        startPolling(data.reviewId);
      }
    } catch (error) {
      console.error('加载审阅报告失败:', error);
      // 如果没有审阅报告，可能是首次提交
    } finally {
      setLoading(false);
    }
  };

  // 轮询审阅状态
  const startPolling = (rId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await getReviewStatus(rId);
        setProgress(status.progress);

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          // 重新加载报告
          if (articleId) {
            await loadReviewReport(articleId);
          }
        }
      } catch (error) {
        console.error('获取审阅状态失败:', error);
        clearInterval(interval);
      }
    }, 3000);

    // 30秒后自动停止轮询
    setTimeout(() => clearInterval(interval), 30000);
  };

  // 提交审阅
  const handleSubmitReview = async () => {
    if (!articleId) return;

    try {
      setSubmitting(true);
      Taro.showLoading({ title: '提交中...' });

      const result = await submitReview({
        articleId,
        title: '文章标题', // TODO: 从文章详情获取
        content: '文章内容', // TODO: 从文章详情获取
      });

      setReviewId(result.reviewId);
      Taro.showToast({ title: '审阅已提交', icon: 'success' });

      // 开始轮询状态
      startPolling(result.reviewId);
    } catch (error) {
      console.error('提交审阅失败:', error);
      Taro.showToast({ title: '提交失败', icon: 'error' });
    } finally {
      setSubmitting(false);
      Taro.hideLoading();
    }
  };

  // 应用所有建议
  const handleAcceptAll = async () => {
    if (!articleId || !reviewId) return;

    try {
      setApplying(true);
      Taro.showLoading({ title: '应用中...' });

      await applyReviewSuggestions({
        articleId,
        reviewId,
        action: 'accept_all',
      });

      Taro.showToast({ title: '建议已应用', icon: 'success' });

      // 返回编辑器
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('应用建议失败:', error);
      Taro.showToast({ title: '应用失败', icon: 'error' });
    } finally {
      setApplying(false);
      Taro.hideLoading();
    }
  };

  // 拒绝所有建议
  const handleRejectAll = async () => {
    if (!articleId || !reviewId) return;

    try {
      setApplying(true);

      await applyReviewSuggestions({
        articleId,
        reviewId,
        action: 'reject_all',
      });

      Taro.showToast({ title: '已拒绝所有建议', icon: 'none' });

      // 返回编辑器
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('拒绝建议失败:', error);
      Taro.showToast({ title: '操作失败', icon: 'error' });
    } finally {
      setApplying(false);
    }
  };

  // 切换智能体展开状态
  const toggleAgent = (agentName: string) => {
    setExpandedAgents((prev) =>
      prev.includes(agentName)
        ? prev.filter((name) => name !== agentName)
        : [...prev, agentName]
    );
  };

  if (loading) {
    return (
      <View className="review-page">
        <Loading text="加载审阅报告..." />
      </View>
    );
  }

  // 没有审阅报告，显示提交按钮
  if (!report) {
    return (
      <View className="review-page">
        <View className="review-header">
          <Text className="back-btn" onClick={() => Taro.navigateBack()}>
            ←
          </Text>
          <Text className="header-title">赛博编辑部</Text>
        </View>

        <View className="submit-section">
          <Text className="submit-icon">🤖</Text>
          <Text className="submit-title">提交文章审阅</Text>
          <Text className="submit-desc">
            7 位 AI 编辑将从逻辑、情感、结构等多维度审阅您的文章
          </Text>
          <Text className="submit-btn" onClick={handleSubmitReview}>
            {submitting ? '提交中...' : '提交审阅'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="review-page">
      {/* 顶部栏 */}
      <View className="review-header">
        <Text className="back-btn" onClick={() => Taro.navigateBack()}>
          ←
        </Text>
        <Text className="header-title">审阅报告</Text>
        <Text
          className={`status-badge ${report.status}`}
        >
          {report.status === 'completed'
            ? '已完成'
            : report.status === 'processing'
            ? '处理中'
            : '失败'}
        </Text>
      </View>

      <ScrollView className="review-content" scrollY>
        {/* 处理中状态 */}
        {report.status === 'processing' && (
          <View className="processing-section">
            <Text className="processing-icon">⏳</Text>
            <Text className="processing-text">
              7 位 AI 编辑正在审阅中... {progress}%
            </Text>
            <View className="progress-bar">
              <View
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </View>
          </View>
        )}

        {/* 整合建议 */}
        {report.status === 'completed' && report.consolidated && (
          <View className="consolidated-section">
            <Text className="section-title">📝 整合建议</Text>
            <Text className="consolidated-summary">
              {report.consolidated.summary}
            </Text>

            {report.consolidated.suggestions.length > 0 && (
              <View className="suggestions-list">
                {report.consolidated.suggestions.map((suggestion) => (
                  <View key={suggestion.id} className="suggestion-card">
                    <View className="suggestion-header">
                      <Text
                        className={`consensus-badge ${suggestion.consensus}`}
                      >
                        {suggestion.consensus === 'unanimous'
                          ? '一致'
                          : suggestion.consensus === 'majority'
                          ? '多数'
                          : '分歧'}
                      </Text>
                    </View>
                    <View className="suggestion-body">
                      <Text className="original-text">
                        {suggestion.original}
                      </Text>
                      <Text className="arrow">↓</Text>
                      <Text className="replacement-text">
                        {suggestion.replacement}
                      </Text>
                    </View>
                    <Text className="suggestion-explanation">
                      {suggestion.explanation}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 各智能体审阅结果 */}
        {report.agents && (
          <View className="agents-section">
            <Text className="section-title">🤖 各编辑意见</Text>
            {Object.entries(report.agents).map(([agentName, agent]) => {
              const config = AGENT_CONFIG[agentName] || {
                name: agentName,
                icon: '🤖',
                color: '#999',
              };
              const isExpanded = expandedAgents.includes(agentName);

              return (
                <View
                  key={agentName}
                  className={`agent-card ${agent.status}`}
                  onClick={() => toggleAgent(agentName)}
                >
                  <View className="agent-header">
                    <Text className="agent-icon" style={{ color: config.color }}>
                      {config.icon}
                    </Text>
                    <View className="agent-info">
                      <Text className="agent-name">{config.name}</Text>
                      <Text className="agent-model">{agent.model}</Text>
                    </View>
                    <Text className="agent-status">{agent.status}</Text>
                    <Text className="expand-icon">
                      {isExpanded ? '▼' : '▶'}
                    </Text>
                  </View>

                  {isExpanded && agent.status === 'completed' && (
                    <View className="agent-detail">
                      {agent.summary && (
                        <Text className="agent-summary">{agent.summary}</Text>
                      )}
                      {agent.issues && agent.issues.length > 0 && (
                        <View className="issues-list">
                          {agent.issues.map((issue, idx) => (
                            <View key={idx} className="issue-item">
                              <Text
                                className={`severity-badge ${issue.severity}`}
                              >
                                {issue.severity === 'high'
                                  ? '高'
                                  : issue.severity === 'medium'
                                  ? '中'
                                  : '低'}
                              </Text>
                              <Text className="issue-description">
                                {issue.description}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {isExpanded && agent.error && (
                    <View className="agent-error">
                      <Text className="error-text">{agent.error}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 底部操作栏 */}
      {report.status === 'completed' && (
        <View className="review-footer">
          <Text className="reject-btn" onClick={handleRejectAll}>
            拒绝修改
          </Text>
          <Text
            className={`accept-btn ${applying ? 'applying' : ''}`}
            onClick={handleAcceptAll}
          >
            {applying ? '应用中...' : '一键应用'}
          </Text>
        </View>
      )}
    </View>
  );
}
