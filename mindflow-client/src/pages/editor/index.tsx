/**
 * 编辑器页面 - Phase 3
 * Markdown 编辑器 + 实时预览 + 本地自动保存
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Textarea, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import MpHtml from 'mp-html/dist/mp-weixin';
import { Loading, Empty } from '../../components';
import { getArticleDetail, saveArticle } from '../../api';
import { saveDraft, getDraft, updateDraftSyncStatus } from '../../utils/storage';
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
      // 编辑已有文章
      setServerId(options.id);
      await loadArticle(options.id);
    } else {
      // 新建文章 - 检查是否有本地草稿
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
      console.log('本地自动保存成功');
    } catch (error) {
      console.error('本地自动保存失败:', error);
    }
  }, [draftId, serverId, title, content]);

  // 监听内容变化，触发自动保存
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 3000); // 3秒后自动保存

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, autoSave]);

  // 手动保存并同步到服务器
  const handleManualSave = async () => {
    try {
      setSaving(true);

      // 先保存到本地
      const draft = await saveDraft({
        id: draftId || generateId(),
        title,
        content,
        serverId: serverId || undefined,
      });

      if (!draftId) {
        setDraftId(draft.id);
      }

      // 同步到服务器
      const saved = await saveArticle({
        id: serverId || undefined,
        title,
        content,
        status: 'draft',
      });

      if (!serverId && saved.id) {
        setServerId(saved.id);
      }

      // 更新同步状态
      await updateDraftSyncStatus(draft.id, 'synced', saved.id);
      setSyncStatus('synced');
      setLastSaved(new Date());

      Taro.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      console.error('保存失败:', error);
      Taro.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // 应用 Markdown 格式
  const applyFormat = (prefix: string, suffix: string) => {
    const newContent = content + prefix + suffix;
    setContent(newContent);
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // 获取同步状态文本
  const getSyncStatusText = () => {
    switch (syncStatus) {
      case 'synced':
        return '已同步';
      case 'pending':
        return '待同步';
      case 'conflict':
        return '冲突';
      default:
        return '';
    }
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
              {getSyncStatusText()} {formatTime(lastSaved)}
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
            title={item.title}
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

        {/* 预览区 */}
        {showPreview && (
          <ScrollView className="preview-section" scrollY>
            <MpHtml
              className="markdown-preview"
              content={content}
              selectable
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
          <Text className="action-btn" onClick={() => Taro.navigateTo({ url: `/pages/review/index?articleId=${serverId || draftId}` })}>
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
