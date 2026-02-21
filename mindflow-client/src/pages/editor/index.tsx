/**
 * 编辑器页面 - Phase 3
 * Markdown 编辑器 + 实时预览
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Textarea, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Loading } from '../../components';
import { getArticleDetail, saveArticle } from '../../api';
import { saveDraft, updateDraftSyncStatus } from '../../utils/storage';
import './index.scss';

// 工具栏配置
const TOOLBAR_ITEMS = [
  { key: 'heading', label: 'H', title: '标题', prefix: '## ', suffix: '' },
  { key: 'bold', label: 'B', title: '加粗', prefix: '**', suffix: '**' },
  { key: 'italic', label: 'I', title: '斜体', prefix: '*', suffix: '*' },
  { key: 'quote', label: '"', title: '引用', prefix: '> ', suffix: '' },
  { key: 'code', label: '</>', title: '代码', prefix: '```\n', suffix: '\n```' },
  { key: 'link', label: '🔗', title: '链接', prefix: '[', suffix: '](url)' },
  { key: 'list', label: '•', title: '列表', prefix: '- ', suffix: '' },
  { key: 'divider', label: '—', title: '分割线', prefix: '\n---\n', suffix: '' },
];

// 生成唯一 ID
const generateId = () => `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 简单的 Markdown 转 HTML
const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  
  let html = markdown
    // 代码块
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // 标题
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // 粗体
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 引用
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // 链接
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    // 列表
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    // 分割线
    .replace(/^---$/gim, '<hr/>')
    // 换行
    .replace(/\n/g, '<br/>');
  
  return html;
};

export default function EditorPage() {
  const [draftId, setDraftId] = useState<string>('');
  const [serverId, setServerId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'conflict'>('pending');

  // 自动保存定时器
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 页面加载
  useLoad(async (options) => {
    if (options?.id) {
      setServerId(options.id);
      await loadArticle(options.id);
    } else {
      const newDraftId = generateId();
      setDraftId(newDraftId);
      setTitle('未命名文章');
      setContent('# 新文章\n\n开始写作...');
    }
  });

  // 加载文章
  const loadArticle = async (id: string) => {
    try {
      setLoading(true);
      const article = await getArticleDetail(id);
      setTitle(article.title);
      setContent(article.content || '');
      setSyncStatus('synced');
    } catch (error) {
      console.error('加载文章失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 本地自动保存
  const autoSave = useCallback(async () => {
    if (!title && !content) return;

    try {
      const draft = await saveDraft({
        id: draftId || generateId(),
        title,
        content,
        serverId: serverId || undefined,
      });

      if (!draftId) {
        setDraftId(draft.id);
      }

      setLastSaved(new Date());
      setSyncStatus('pending');
    } catch (error) {
      console.error('本地自动保存失败:', error);
    }
  }, [draftId, serverId, title, content]);

  // 监听内容变化
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, autoSave]);

  // 手动保存
  const handleManualSave = async () => {
    try {
      setSaving(true);

      const draft = await saveDraft({
        id: draftId || generateId(),
        title,
        content,
        serverId: serverId || undefined,
      });

      if (!draftId) {
        setDraftId(draft.id);
      }

      Taro.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      console.error('保存失败:', error);
      Taro.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // 应用格式
  const applyFormat = (prefix: string, suffix: string) => {
    const newContent = content + prefix + suffix;
    setContent(newContent);
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View className="editor-page">
        <Loading text="加载中..." />
      </View>
    );
  }

  return (
    <View className="editor-page">
      {/* 顶部栏 */}
      <View className="editor-header">
        <View className="header-left">
          <Text className="back-btn" onClick={() => Taro.navigateBack()}>←</Text>
          <Text className="header-title">{serverId ? '编辑文章' : '新建文章'}</Text>
        </View>
        <View className="header-right">
          {lastSaved && (
            <Text className="save-status">
              {syncStatus === 'synced' ? '已同步' : '待同步'} {formatTime(lastSaved)}
            </Text>
          )}
          <Text
            className={`preview-toggle ${showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? '隐藏预览' : '显示预览'}
          </Text>
          <Text
            className={`save-btn ${saving ? 'saving' : ''}`}
            onClick={handleManualSave}
          >
            {saving ? '保存中...' : '保存'}
          </Text>
        </View>
      </View>

      {/* 标题输入 */}
      <View className="title-section">
        <Textarea
          className="title-input"
          placeholder="请输入标题"
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
          maxlength={100}
        />
      </View>

      {/* 工具栏 */}
      <View className="toolbar">
        {TOOLBAR_ITEMS.map((item) => (
          <Text
            key={item.key}
            className="toolbar-item"
            onClick={() => applyFormat(item.prefix, item.suffix)}
          >
            {item.label}
          </Text>
        ))}
      </View>

      {/* 编辑区 + 预览区 */}
      <View className={`editor-container ${showPreview ? 'with-preview' : ''}`}>
        {/* 编辑区 */}
        <ScrollView className="edit-section" scrollY>
          <Textarea
            className="content-input"
            placeholder="开始写作..."
            value={content}
            onInput={(e) => setContent(e.detail.value)}
            maxlength={50000}
            autoHeight
          />
        </ScrollView>

        {/* 预览区 - 使用简单的 HTML 渲染 */}
        {showPreview && (
          <ScrollView className="preview-section" scrollY>
            <View 
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
            />
          </ScrollView>
        )}
      </View>

      {/* 底部栏 */}
      <View className="editor-footer">
        <Text className="word-count">
          {content.length} 字
        </Text>
        <View className="footer-actions">
          <Text className="action-btn" onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}>
            提交审阅
          </Text>
          <Text className="action-btn primary" onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}>
            发布
          </Text>
        </View>
      </View>
    </View>
  );
}
