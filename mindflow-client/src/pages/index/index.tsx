/**
 * 工作台首页 - Phase 2 重构版
 * 展示进行中的写作任务和快速入口
 */

import React, { useEffect, useState, useCallback } from 'react';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { View, Text, Button, Image } from '@tarojs/components';
import { listArticles, Article } from '../../api';
import { Loading, Empty } from '../../components';
import './index.scss';

// 阶段映射（对应 Skill 阶段）
const PHASE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  '-1': { label: '构思中', color: '#faad14', icon: '💡' },
  '0': { label: 'Brief 阶段', color: '#1890ff', icon: '📝' },
  '0.5': { label: '资料收集', color: '#52c41a', icon: '📚' },
  '1': { label: '突破观点', color: '#722ed1', icon: '🎯' },
  '1.5': { label: '观点讨论', color: '#eb2f96', icon: '💬' },
  '2': { label: '观点收敛', color: '#13c2c2', icon: '🎨' },
  '2.5': { label: '大纲阶段', color: '#fa8c16', icon: '📋' },
  '3': { label: '草稿写作', color: '#1890ff', icon: '✍️' },
  '3.5': { label: '草稿审校', color: '#faad14', icon: '👀' },
  '4': { label: '审核中', color: '#f5222d', icon: '🔍' },
  '4.5': { label: '预发布', color: '#52c41a', icon: '🚀' },
  '5': { label: '已发布', color: '#52c41a', icon: '✅' },
  '5.5': { label: '已归档', color: '#999', icon: '📦' },
  '6': { label: '已完成', color: '#999', icon: '🏁' },
};

// 快捷入口配置
const QUICK_ACTIONS = [
  { key: 'new', label: '新建文章', icon: '➕', color: '#1890ff', url: '/pages/editor/index' },
  { key: 'collect', label: '粘贴链接', icon: '🔗', color: '#eb2f96', action: 'collect' },
  { key: 'sources', label: '素材库', icon: '📚', color: '#52c41a', url: '/pages/sources/index' },
  { key: 'ideas', label: '记录灵感', icon: '💡', color: '#faad14', url: '/pages/me/index?tab=idea' },
];

export default function IndexPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 检查登录状态
  const checkLoginStatus = useCallback(async () => {
    try {
      const token = await Taro.getStorage({ key: 'token' });
      if (token.data) {
        setIsLoggedIn(true);
        return true;
      }
    } catch {
      // 未登录
    }
    setIsLoggedIn(false);
    setLoading(false);
    return false;
  }, []);

  // 加载文章列表
  const loadArticles = useCallback(async () => {
    // 先检查登录状态
    const loggedIn = await checkLoginStatus();
    if (!loggedIn) {
      return;
    }

    try {
      setLoading(true);
      const res = await listArticles({
        limit: 10,
        offset: 0,
      });
      // 过滤掉已完成的，展示进行中的
      const activeArticles = res.articles.filter(
        (a) => !['5', '5.5', '6'].includes(a.phase)
      );
      setArticles(activeArticles);
    } catch (error: any) {
      console.error('加载文章失败:', error);
      // 401 错误已经在拦截器中处理（跳转登录页）
      if (error.message !== '登录已过期') {
        Taro.showToast({ title: '加载失败', icon: 'error' });
      }
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, [checkLoginStatus]);

  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  usePullDownRefresh(() => {
    loadArticles();
  });

  // 处理快捷入口点击
  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    if (action.action === 'collect') {
      handleCollectLink();
    } else if (action.url) {
      Taro.navigateTo({ url: action.url });
    }
  };

  // 粘贴链接收集素材
  const handleCollectLink = async () => {
    try {
      // 获取剪贴板内容
      const { data } = await Taro.getClipboardData();
      
      if (!data || !data.trim()) {
        Taro.showToast({ title: '剪贴板为空', icon: 'none' });
        return;
      }

      // 简单的 URL 校验
      const url = data.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        Taro.showToast({ title: '剪贴板内容不是链接', icon: 'none' });
        return;
      }

      // 确认收集
      const { confirm } = await Taro.showModal({
        title: '收集素材',
        content: `是否收集以下链接？\n${url.substring(0, 50)}...`,
        confirmText: '收集',
        cancelText: '取消',
      });

      if (!confirm) return;

      // 调用后端 API
      Taro.showLoading({ title: '采集中...' });
      
      const { collectSource } = await import('../../api/collect');
      const result = await collectSource({ url, sourceType: 'article' });

      Taro.hideLoading();
      
      Taro.showModal({
        title: '采集成功',
        content: `素材已保存到飞书知识库\n文档链接：${result.feishuDocUrl}`,
        showCancel: false,
        confirmText: '知道了',
      });

    } catch (error) {
      Taro.hideLoading();
      console.error('采集失败:', error);
      Taro.showToast({ title: '采集失败', icon: 'error' });
    }
  };

  // 同步数据
  const handleSync = async () => {
    try {
      setSyncing(true);
      Taro.showLoading({ title: '同步中...' });
      
      // 调用同步 API
      const { syncAll } = await import('../../api');
      await syncAll();
      
      Taro.hideLoading();
      Taro.showToast({ title: '同步成功', icon: 'success' });
      loadArticles();
    } catch (error) {
      Taro.hideLoading();
      console.error('同步失败:', error);
      Taro.showToast({ title: '同步失败', icon: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  // 创建新文章
  const handleCreateArticle = () => {
    Taro.navigateTo({
      url: '/pages/editor/index',
    });
  };

  // 查看文章详情
  const handleArticleClick = (article: Article) => {
    Taro.navigateTo({
      url: `/pages/artifacts/detail?id=${article.id}`,
    });
  };

  // 格式化时间
  const formatTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes < 1 ? '刚刚' : `${minutes}分钟前`;
      }
      return `${hours}小时前`;
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  // 获取阶段信息
  const getPhaseInfo = (phase: string) => {
    return PHASE_MAP[phase] || { label: '未知', color: '#999', icon: '❓' };
  };

  if (loading) {
    return (
      <View className="index-page">
        <Loading text="加载中..." />
      </View>
    );
  }

  return (
    <View className="index-page">
      {/* 欢迎区域 */}
      <View className="welcome-section">
        <Text className="welcome-title">工作台</Text>
        <Text className="welcome-subtitle">管理你的写作任务</Text>
      </View>

      {/* 快捷入口 */}
      <View className="quick-actions">
        {QUICK_ACTIONS.map((action) => (
          <View
            key={action.key}
            className="action-item"
            onClick={() => handleQuickAction(action)}
          >
            <View
              className="action-icon"
              style={{ backgroundColor: `${action.color}20`, color: action.color }}
            >
              <Text>{action.icon}</Text>
            </View>
            <Text className="action-label">{action.label}</Text>
          </View>
        ))}
      </View>

      {/* 进行中的任务 */}
      <View className="section-header">
        <Text className="section-title">进行中的任务</Text>
        <Text className="section-count">{articles.length}</Text>
      </View>

      <View className="article-list">
        {articles.length === 0 ? (
          <Empty
            title="暂无进行中的任务"
            description="点击上方「新建文章」开始创作"
            actionText="新建文章"
            onAction={handleCreateArticle}
          />
        ) : (
          articles.map((article) => {
            const phaseInfo = getPhaseInfo(article.phase);
            return (
              <View
                key={article.id}
                className="article-card"
                onClick={() => handleArticleClick(article)}
              >
                <View className="card-main">
                  <Text className="article-title">{article.title}</Text>
                  {article.topic && (
                    <Text className="article-topic">{article.topic}</Text>
                  )}
                  <View className="card-meta">
                    <Text className="update-time">{formatTime(article.updatedAt)}</Text>
                    <Text className="source-badge" style={{ color: phaseInfo.color }}>
                      {phaseInfo.icon} {phaseInfo.label}
                    </Text>
                  </View>
                </View>
                <View className="card-arrow">
                  <Text className="arrow-icon">›</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* 查看更多 */}
      {articles.length > 0 && (
        <View
          className="view-more"
          onClick={() => Taro.switchTab({ url: '/pages/artifacts/index' })}
        >
          <Text className="view-more-text">查看全部作品</Text>
          <Text className="view-more-icon">›</Text>
        </View>
      )}
    </View>
  );
}
