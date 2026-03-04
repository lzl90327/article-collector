/**
 * VEGA 拾光 - 首页
 * 基于 Design Tokens 重构的现代创作者首页
 */

import React, { useEffect, useState, useCallback } from 'react';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { listArticles, Article } from '../../api';
import './index.scss';

// 阶段映射
const PHASE_MAP: Record<string, { label: string; color: string }> = {
  '-1': { label: '构思中', color: '#faad14' },
  '0': { label: 'Brief 阶段', color: '#1890ff' },
  '0.5': { label: '资料收集', color: '#52c41a' },
  '1': { label: '突破观点', color: '#722ed1' },
  '1.5': { label: '观点讨论', color: '#eb2f96' },
  '2': { label: '观点收敛', color: '#13c2c2' },
  '2.5': { label: '大纲阶段', color: '#fa8c16' },
  '3': { label: '草稿写作', color: '#1890ff' },
  '3.5': { label: '草稿审校', color: '#faad14' },
  '4': { label: '审核中', color: '#f5222d' },
  '4.5': { label: '预发布', color: '#52c41a' },
  '5': { label: '已发布', color: '#52c41a' },
  '5.5': { label: '已归档', color: '#999' },
  '6': { label: '已完成', color: '#999' },
};

export default function IndexPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // 检查登录状态
  const checkLoginStatus = useCallback(async () => {
    try {
      const token = await Taro.getStorage({ key: 'token' });
      if (token.data) {
        return true;
      }
    } catch {
      // 未登录
    }
    setLoading(false);
    return false;
  }, []);

  // 加载文章列表
  const loadArticles = useCallback(async () => {
    const loggedIn = await checkLoginStatus();
    if (!loggedIn) {
      Taro.navigateTo({ url: '/pages/login/index' });
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
      if (error.message !== '登录已过期') {
        Taro.showToast({ title: '加载失败', icon: 'error' });
      }
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, [checkLoginStatus]);

  useEffect(() => {
    loadArticles();
  }, []);

  usePullDownRefresh(() => {
    loadArticles();
  });

  // 处理快捷入口点击
  const handleQuickAction = (type: string) => {
    switch (type) {
      case 'new':
        Taro.navigateTo({ url: '/pages/editor/index' });
        break;
      case 'collect':
        handleCollectLink();
        break;
      case 'sources':
        Taro.navigateTo({ url: '/pages/sources/index' });
        break;
      case 'ideas':
        Taro.navigateTo({ url: '/pages/me/index?tab=idea' });
        break;
    }
  };

  // 粘贴链接收集素材
  const handleCollectLink = async () => {
    try {
      const { data } = await Taro.getClipboardData();
      
      if (!data || !data.trim()) {
        Taro.showToast({ title: '剪贴板为空', icon: 'none' });
        return;
      }

      const url = data.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        Taro.showToast({ title: '剪贴板内容不是链接', icon: 'none' });
        return;
      }

      const { confirm } = await Taro.showModal({
        title: '收集素材',
        content: `是否收集以下链接？\n${url.substring(0, 50)}...`,
        confirmText: '收集',
        cancelText: '取消',
      });

      if (!confirm) return;

      Taro.showLoading({ title: '采集中...' });
      
      const { collectSource } = await import('../../api/collect');
      const result = await collectSource({ url, sourceType: 'article' });

      Taro.hideLoading();
      
      Taro.showModal({
        title: '采集成功',
        content: `素材已保存到飞书知识库`,
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
    return PHASE_MAP[phase] || { label: '未知', color: '#999' };
  };

  // 获取当前日期
  const getCurrentDate = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[now.getDay()];
    return `${month}月${day}日 · ${weekday}`;
  };

  if (loading) {
    return (
      <View className="index-page">
        <View className="loading-state">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="index-page">
      {/* 顶部 Hero 区域 */}
      <View className="hero-section">
        {/* 顶部：品牌胶囊 + 日期 */}
        <View className="header-top">
          <View className="brand-badge">
            <Text className="brand-icon">⭐</Text>
            <Text className="brand-text">VEGA 拾光</Text>
          </View>
          <Text className="date-text">{getCurrentDate()}</Text>
        </View>

        {/* 主标题区域 */}
        <View className="title-section">
          <Text className="main-title">创作</Text>
          <Text className="subtitle">开始今天的写作与整理</Text>
        </View>
      </View>

      {/* 快捷入口区域 */}
      <View className="quick-actions">
        {/* 主卡片 - 新建文章 */}
        <View 
          className="main-card"
          onClick={() => handleQuickAction('new')}
        >
          <View className="card-content">
            <View className="card-icon">
              <Text className="icon">✏️</Text>
            </View>
            <View className="card-texts">
              <Text className="card-title">新建文章</Text>
              <Text className="card-subtitle">从空白开始创作</Text>
            </View>
          </View>
          <View className="card-arrow">
            <Text className="arrow-icon">›</Text>
          </View>
        </View>

        {/* 次级卡片网格 */}
        <View className="secondary-cards">
          <View 
            className="secondary-card mint"
            onClick={() => handleQuickAction('collect')}
          >
            <View className="card-icon">
              <Text className="icon">🔗</Text>
            </View>
            <Text className="card-label">导入链接</Text>
          </View>

          <View 
            className="secondary-card purple"
            onClick={() => handleQuickAction('sources')}
          >
            <View className="card-icon">
              <Text className="icon">📚</Text>
            </View>
            <Text className="card-label">灵感库</Text>
          </View>

          <View 
            className="secondary-card gold"
            onClick={() => handleQuickAction('ideas')}
          >
            <View className="card-icon">
              <Text className="icon">💡</Text>
            </View>
            <Text className="card-label">记录灵感</Text>
          </View>
        </View>
      </View>

      {/* 稿件区域 */}
      <View className="articles-section">
        <View className="section-header">
          <Text className="section-title">进行中的稿件</Text>
          <Text className="count-badge">{articles.length}</Text>
        </View>

        <View className="article-list">
          {articles.length === 0 ? (
            <View className="empty-state">
              <View className="empty-icon">
                <Text className="star">⭐</Text>
                <View className="dots">
                  <View className="dot" />
                  <View className="dot" />
                  <View className="dot" />
                </View>
              </View>
              <Text className="empty-title">还没有进行中的稿件</Text>
              <Text className="empty-description">从一篇新文章，或一条链接开始</Text>
              <button 
                className="action-button"
                onClick={handleCreateArticle}
              >
                开始创作
              </button>
            </View>
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
                      <Text 
                        className="phase-tag" 
                        style={{ color: phaseInfo.color }}
                      >
                        {phaseInfo.label}
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
            <Text className="view-more-text">浏览全部稿件</Text>
            <Text className="view-more-icon">›</Text>
          </View>
        )}
      </View>
    </View>
  );
}
