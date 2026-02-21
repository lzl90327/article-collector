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

  return (
    <View className='source-detail-page'>
      <View className='header'>
        <Text className='title'>{source.title}</Text>
        <Text className='type'>类型: {source.type}</Text>
      </View>

      {source.summary && (
        <View className='section'>
          <Text className='section-title'>摘要</Text>
          <Text className='section-content'>{source.summary}</Text>
        </View>
      )}

      {source.tags && source.tags.length > 0 && (
        <View className='section'>
          <Text className='section-title'>标签</Text>
          <View className='tags'>
            {source.tags.map((tag, idx) => (
              <Text key={idx} className='tag'>#{tag}</Text>
            ))}
          </View>
        </View>
      )}

      <View className='section'>
        <Text className='section-title'>收藏时间</Text>
        <Text className='section-content'>
          {new Date(source.createdAt).toLocaleString()}
        </Text>
      </View>

      {source.url && (
        <Button className='open-btn' onClick={handleOpenUrl}>
          复制链接
        </Button>
      )}
    </View>
  );
}
