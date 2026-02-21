import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro';
import { listSources, syncSources, Source } from '../../api';
import { Loading, Empty } from '../../components';
import './index.scss';

const TABS = [
  { key: '', label: '全部' },
  { key: 'article', label: '文章' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'image', label: '图文' },
];

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // 加载素材列表
  const loadSources = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const res = await listSources({
        type: activeTab || undefined,
        page: pageNum,
        pageSize: 20,
      });

      if (isRefresh || pageNum === 1) {
        setSources(res.items);
      } else {
        setSources(prev => [...prev, ...res.items]);
      }
      
      setHasMore(res.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('加载素材失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeTab, loading]);

  // 初始加载
  useEffect(() => {
    loadSources(1, true);
  }, [activeTab]);

  // 下拉刷新
  usePullDownRefresh(() => {
    loadSources(1, true);
  });

  // 上拉加载更多
  useReachBottom(() => {
    if (hasMore && !loading) {
      loadSources(page + 1);
    }
  });

  // 手动同步
  const handleSync = async () => {
    Taro.showLoading({ title: '同步中...' });
    try {
      await syncSources();
      Taro.showToast({ title: '同步成功', icon: 'success' });
      loadSources(1, true);
    } catch (error) {
      Taro.showToast({ title: '同步失败', icon: 'error' });
    } finally {
      Taro.hideLoading();
    }
  };

  // 过滤素材
  const filteredSources = sources.filter(source => {
    if (!searchKeyword) return true;
    const keyword = searchKeyword.toLowerCase();
    return (
      source.title.toLowerCase().includes(keyword) ||
      source.tags?.some(tag => tag.toLowerCase().includes(keyword))
    );
  });

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      article: '📄',
      video: '🎬',
      audio: '🎵',
      image: '🖼️',
    };
    return icons[type] || '📄';
  };

  return (
    <View className='sources-page'>
      {/* 搜索栏 */}
      <View className='search-bar'>
        <Input
          className='search-input'
          placeholder='搜索素材...'
          value={searchKeyword}
          onInput={(e) => setSearchKeyword(e.detail.value)}
        />
        <Text className='sync-btn' onClick={handleSync}>🔄</Text>
      </View>

      {/* 分类标签 */}
      <ScrollView className='tab-bar' scrollX>
        {TABS.map(tab => (
          <Text
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Text>
        ))}
      </ScrollView>

      {/* 素材列表 */}
      <ScrollView className='source-list' scrollY>
        {filteredSources.map(source => (
          <View
            key={source.id}
            className='source-card'
            onClick={() => Taro.navigateTo({ url: `/pages/sources/detail?id=${source.id}` })}
          >
            <View className='source-header'>
              <Text className='source-icon'>{getTypeIcon(source.type)}</Text>
              <Text className='source-title'>{source.title}</Text>
            </View>
            
            {source.summary && (
              <Text className='source-summary'>{source.summary}</Text>
            )}
            
            <View className='source-footer'>
              <View className='source-tags'>
                {source.tags?.map((tag, idx) => (
                  <Text key={idx} className='tag'>#{tag}</Text>
                ))}
              </View>
              <Text className='source-date'>
                {new Date(source.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))}

        {/* 加载状态 */}
        {loading && page === 1 && <Loading text="加载中..." />}
        {!hasMore && sources.length > 0 && (
          <Text className='no-more-text'>没有更多了</Text>
        )}
        {sources.length === 0 && !loading && (
          <Empty
            icon="📚"
            title="暂无素材"
            description="点击右上角同步按钮获取最新素材"
            actionText="立即同步"
            onAction={handleSync}
          />
        )}
      </ScrollView>
    </View>
  );
}
