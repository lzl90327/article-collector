import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { getSourceDetail, Source } from '../../api';
import './full-content.scss';

// 图片信息类型
interface ImageInfo {
  token: string;
  url: string;
  expiresAt: string;
}

// 内容块类型
interface ContentBlock {
  type: 'text' | 'image';
  content?: string;
  imageUrl?: string;
  imageToken?: string;
}

export default function FullContentPage() {
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);

  useLoad((options) => {
    const { id } = options;
    if (id) {
      loadSourceContent(id);
    }
  });

  const loadSourceContent = async (id: string) => {
    setLoading(true);
    try {
      const res = await getSourceDetail(id);
      setSource(res);
      // 解析内容为块
      if (res.content) {
        const blocks = parseContent(res.content, res.images);
        setContentBlocks(blocks);
      }
    } catch (error) {
      console.error('加载全文失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 解析内容，分离文本和图片
  const parseContent = (content: string, imagesJson?: string): ContentBlock[] => {
    const blocks: ContentBlock[] = [];
    
    // 解析图片信息
    let imageMap: Map<string, string> = new Map();
    if (imagesJson) {
      try {
        const images: ImageInfo[] = JSON.parse(imagesJson);
        images.forEach(img => {
          imageMap.set(img.token, img.url);
        });
      } catch (e) {
        console.error('解析图片信息失败:', e);
      }
    }
    
    // 匹配 <image token="..."/> 格式
    const imageRegex = /<image\s+token="([^"]+)"[^/]*\/>/g;
    let lastIndex = 0;
    let match;

    while ((match = imageRegex.exec(content)) !== null) {
      // 添加图片前的文本
      if (match.index > lastIndex) {
        const text = content.substring(lastIndex, match.index).trim();
        if (text) {
          blocks.push({ type: 'text', content: text });
        }
      }
      // 添加图片
      const token = match[1];
      const imageUrl = imageMap.get(token);
      blocks.push({
        type: 'image',
        imageToken: token,
        imageUrl: imageUrl,
      });
      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的文本
    if (lastIndex < content.length) {
      const text = content.substring(lastIndex).trim();
      if (text) {
        blocks.push({ type: 'text', content: text });
      }
    }

    return blocks;
  };

  // 预览图片或提示
  const previewImage = (imageUrl?: string) => {
    // 检查 URL 是否有效（飞书图片 URL 需要是有效的临时链接）
    const isValidUrl = imageUrl && 
      !imageUrl.includes('internal-api-drive-stream.feishu.cn') && 
      (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
    
    if (isValidUrl) {
      // 预览图片
      Taro.previewImage({
        urls: [imageUrl],
        current: imageUrl,
      });
    } else {
      // 图片无法显示，提示用户去飞书查看
      Taro.showModal({
        title: '图片查看',
        content: '由于飞书文档权限限制，图片无法直接显示。是否复制飞书链接在浏览器中查看？',
        confirmText: '复制链接',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 由于飞书文档 URL 需要企业域名，自动构建的链接可能无效
            // 引导用户手动获取链接
            Taro.showModal({
              title: '获取飞书链接',
              content: '请点击"查看详情"进入素材详情页，然后点击"复制飞书链接"按钮获取正确的文档链接。',
              showCancel: false,
              confirmText: '知道了',
            });
          }
        },
      });
    }
  };

  if (loading) {
    return (
      <View className='full-content-page'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    );
  }

  if (!source) {
    return (
      <View className='full-content-page'>
        <Text className='error-text'>素材不存在</Text>
      </View>
    );
  }

  return (
    <View className='full-content-page'>
      {/* 内容区域 */}
      <ScrollView className='content-scroll' scrollY>
        <View className='content-container'>
          <Text className='article-title'>{source.title}</Text>

          {contentBlocks.length > 0 ? (
            <View className='article-content'>
              {contentBlocks.map((block, index) => (
                <View key={index}>
                  {block.type === 'text' && block.content && (
                    <Text className='text-block'>{block.content}</Text>
                  )}
                  {block.type === 'image' && (
                    <View
                      className='image-block'
                      onClick={() => previewImage(block.imageUrl)}
                    >
                      {/* 只显示占位符，不尝试加载无效图片 */}
                      <View className='image-placeholder'>
                        <Text className='image-icon'>🖼️</Text>
                        <Text className='image-text'>点击查看图片</Text>
                        <Text className='image-tip'>飞书文档图片需授权查看</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View className='no-content'>
              <Text className='no-content-text'>
                {source.aiStatus === 'processing'
                  ? '内容正在处理中，请稍后再来查看...'
                  : '暂无内容'}
              </Text>
              {source.url && (
                <Text className='tip'>可点击"复制飞书链接"在浏览器中查看原文</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
