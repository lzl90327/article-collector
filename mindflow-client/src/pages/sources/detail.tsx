import { View, Text, Button } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { getSourceDetail, Source } from '../../api';
import './detail.scss';

export default function SourceDetailPage() {
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);

  useLoad((options) => {
    const { id } = options;
    if (id) {
      loadSourceDetail(id);
    }
  });

  const loadSourceDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await getSourceDetail(id);
      setSource(res);
    } catch (error) {
      console.error('加载素材详情失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUrl = () => {
    if (source?.url) {
      Taro.setClipboardData({
        data: source.url,
        success: () => {
          Taro.showToast({ title: '链接已复制', icon: 'success' });
        },
      });
    }
  };

  const handleViewFullContent = () => {
    if (source?.id) {
      Taro.navigateTo({
        url: `/pages/sources/full-content?id=${source.id}`,
      });
    }
  };

  // 解析观点
  const parseViewpoints = (viewpointsStr?: string): string[] => {
    if (!viewpointsStr) return [];
    try {
      return JSON.parse(viewpointsStr);
    } catch {
      return [];
    }
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View className='source-detail-page'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    );
  }

  if (!source) {
    return (
      <View className='source-detail-page'>
        <Text className='error-text'>素材不存在</Text>
      </View>
    );
  }

  const viewpoints = parseViewpoints(source.viewpoints);

  return (
    <View className='source-detail-page'>
      {/* 标题区域 */}
      <View className='header'>
        <Text className='title'>{source.title}</Text>
        <View className='meta'>
          {source.tags && source.tags.length > 0 && (
            <View className='tags'>
              {source.tags.map((tag, idx) => (
                <Text key={idx} className='tag'>#{tag}</Text>
              ))}
            </View>
          )}
          <Text className='update-time'>更新时间: {formatDate(source.updatedAt)}</Text>
        </View>
      </View>

      {/* AI 摘要 */}
      <View className='section ai-summary'>
        <View className='section-header'>
          <Text className='section-title'>AI 摘要</Text>
          {source.aiStatus === 'processing' && (
            <Text className='status-badge processing'>AI摘要·生成中...</Text>
          )}
          {source.aiStatus === 'pending' && (
            <Text className='status-badge pending'>AI摘要·待生成</Text>
          )}
          {source.aiStatus === 'failed' && (
            <Text className='status-badge failed'>AI摘要·生成失败</Text>
          )}
          {source.aiStatus === 'completed' && (
            <Text className='status-badge completed'>AI摘要·已生成</Text>
          )}
        </View>
        {source.summary ? (
          <Text className='section-content summary-text'>{source.summary}</Text>
        ) : (
          <Text className='section-content placeholder'>
            {source.aiStatus === 'processing' 
              ? 'AI 正在分析文章内容，请稍后再来查看...' 
              : source.aiStatus === 'failed'
              ? '摘要生成失败，请稍后重试'
              : '摘要生成中，请稍后查看'}
          </Text>
        )}
      </View>

      {/* 核心观点 */}
      {viewpoints.length > 0 && (
        <View className='section viewpoints'>
          <Text className='section-title'>核心观点</Text>
          <View className='viewpoints-list'>
            {viewpoints.map((point, idx) => (
              <View key={idx} className='viewpoint-item'>
                <Text className='viewpoint-number'>{idx + 1}</Text>
                <Text className='viewpoint-text'>{point}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 查看全文按钮 */}
      <Button className='full-content-btn' onClick={handleViewFullContent}>
        查看全文
      </Button>

      {/* 复制链接 */}
      {source.url ? (
        <Button className='open-btn' onClick={handleOpenUrl}>
          复制飞书链接
        </Button>
      ) : source.feishuWikiToken ? (
        <View className='feishu-link-section'>
          <Text className='feishu-link-tip'>飞书文档链接</Text>
          <Text className='feishu-link-hint'>文档Token: {source.feishuWikiToken}</Text>
          <Text className='feishu-link-hint'>请访问飞书知识库查看完整文档</Text>
        </View>
      ) : null}
    </View>
  );
}
