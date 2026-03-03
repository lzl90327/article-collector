import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Loading, RichText } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { getWikiNodeContent } from '../../api/feishu';
import './index.scss';

interface DocumentContent {
  title: string;
  content: string;
  markdown?: string;
}

/**
 * 飞书文档详情页面
 */
export default function FeishuDoc() {
  const router = useRouter();
  const { nodeToken, title } = router.params;

  const [docContent, setDocContent] = useState<DocumentContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (nodeToken) {
      loadDocumentContent();
    }
  }, [nodeToken]);

  /**
   * 加载文档内容
   */
  const loadDocumentContent = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await getWikiNodeContent(nodeToken as string);

      if (res.data) {
        setDocContent({
          title: title || res.data.title || '无标题',
          content: res.data.content || res.data.markdown || '',
          markdown: res.data.markdown,
        });
      }
    } catch (err) {
      console.error('加载文档内容失败:', err);
      setError('加载文档内容失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 简单的 Markdown 转 HTML（用于 RichText 组件）
   */
  const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '';

    return markdown
      // 标题
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // 粗体和斜体
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // 代码块
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // 行内代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 链接
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // 无序列表
      .replace(/^\s*[-*+]\s+(.+)$/gim, '<li>$1</li>')
      // 有序列表
      .replace(/^\s*\d+\.\s+(.+)$/gim, '<li>$1</li>')
      // 段落
      .replace(/\n\n/g, '</p><p>')
      // 换行
      .replace(/\n/g, '<br>');
  };

  if (loading) {
    return (
      <View className="feishu-doc">
        <View className="loading-container">
          <Loading type="circular" color="#1989fa" />
          <Text className="loading-text">加载文档中...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="feishu-doc">
        <View className="error-container">
          <Text className="error-icon">⚠️</Text>
          <Text className="error-text">{error}</Text>
          <View className="retry-btn" onClick={loadDocumentContent}>
            <Text className="retry-text">重新加载</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="feishu-doc">
      {/* 文档标题 */}
      <View className="doc-header">
        <Text className="doc-title">{docContent?.title || title}</Text>
      </View>

      {/* 文档内容 */}
      <ScrollView className="doc-content" scrollY>
        {docContent?.content ? (
          <RichText
            className="rich-text-content"
            nodes={markdownToHtml(docContent.content)}
          />
        ) : (
          <View className="empty-content">
            <Text className="empty-text">文档内容为空</Text>
          </View>
        )}
      </ScrollView>

      {/* 底部操作栏 */}
      <View className="doc-footer">
        <View className="action-btn" onClick={() => Taro.navigateBack()}>
          <Text className="action-text">返回列表</Text>
        </View>
        <View className="action-btn primary" onClick={loadDocumentContent}>
          <Text className="action-text">刷新内容</Text>
        </View>
      </View>
    </View>
  );
}
