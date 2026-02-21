import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro';
import { listArticles, syncArticles, Article } from '../../api';
import { Loading, Empty } from '../../components';
import './index.scss';

const TABS = [
  { key: 'articles', label: '文章' },
  { key: 'weekly', label: '周报' },
];

export default function ArtifactsPage() {
  const [activeTab, setActiveTab] = useState('articles');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // 加载文章列表
  const loadArticles = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const res = await listArticles({
        page: pageNum,
        pageSize: 20,
      });

      if (isRefresh || pageNum === 1) {
        setArticles(res.items);
      } else {
        setArticles(prev => [...prev, ...res.items]);
      }
      
      setHasMore(res.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('加载文章失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // 初始加载
  useEffect(() => {
    if (activeTab === 'articles') {
      loadArticles(1, true);
    }
  }, [activeTab]);

  // 下拉刷新
  usePullDownRefresh(() => {
    if (activeTab === 'articles') {
      loadArticles(1, true);
    }
  });

  // 上拉加载更多
  useReachBottom(() => {
    if (activeTab === 'articles' && hasMore && !loading) {
      loadArticles(page + 1);
    }
  });

  // 手动同步
  const handleSync = async () => {
    Taro.showLoading({ title: '同步中...' });
    try {
      await syncArticles();
      Taro.showToast({ title: '同步成功', icon: 'success' });
      loadArticles(1, true);
    } catch (error) {
      Taro.showToast({ title: '同步失败', icon: 'error' });
    } finally {
      Taro.hideLoading();
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const tags: Record<string, { text: string; color: string }> = {
      draft: { text: '草稿', color: '#ff9800' },
      published: { text: '已发布', color: '#4caf50' },
    };
    return tags[status] || { text: status, color: '#999' };
  };

  return (
    <View className='artifacts-page'>
      {/* 标签栏 */}
      <View className='tab-bar'>
        {TABS.map(tab => (
          <Text
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Text>
        ))}
        <Text className='sync-btn' onClick={handleSync}>🔄</Text>
      </View>

      {/* 内容区域 */}
      {activeTab === 'articles' && (
        <ScrollView className='article-list' scrollY>
          {articles.map(article => {
            const statusTag = getStatusTag(article.status);
            return (
              <View
                key={article.id}
                className='article-card'
                onClick={() => Taro.navigateTo({ url: `/pages/artifacts/detail?id=${article.id}` })}
              >
                <View className='article-header'>
                  <Text className='article-title'>{article.title}</Text>
                  <Text
                    className='status-tag'
                    style={{ background: statusTag.color }}
                  >
                    {statusTag.text}
                  </Text>
                </View>
                <View className='article-meta'>
                  <Text className='article-date'>
                    {new Date(article.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            );
          })}

          {loading && page === 1 && <Loading text="加载中..." />}
          {!hasMore && articles.length > 0 && (
            <Text className='no-more-text'>没有更多了</Text>
          )}
          {articles.length === 0 && !loading && (
            <Empty
              icon="📝"
              title="暂无文章"
              description="点击右上角同步按钮获取最新文章"
              actionText="立即同步"
              onAction={handleSync}
            />
          )}
        </ScrollView>
      )}

      {activeTab === 'weekly' && (
        <View className='weekly-placeholder'>
          <Text className='placeholder-text'>周报功能开发中...</Text>
        </View>
      )}
    </View>
  );
}
