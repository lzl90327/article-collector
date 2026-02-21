import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PhaseId, PhaseMetadata, PendingInput } from '../../../types/phase';
import './DraftViewer.scss';

// 新 Props 接口（适配 Phase 系统）
interface DraftViewerNewProps {
  workflowId: string;
  phaseId: PhaseId;
  phaseMeta?: PhaseMetadata;
  fields: Map<string, unknown>;
  pendingInput?: PendingInput | null;
  loading?: boolean;
  onSubmitInput: (field: string, value: unknown) => void;
  onTriggerPhase: (targetPhase?: string) => void;
  onSendMessage?: (message: string) => void;
}

// 兼容旧 Props 接口
interface DraftViewerLegacyProps {
  draft: string;
  onConfirm: () => void;
  onBack?: () => void;
  loading?: boolean;
}

type DraftViewerProps = DraftViewerNewProps | DraftViewerLegacyProps;

// 判断是否是新 Props
function isNewProps(props: DraftViewerProps): props is DraftViewerNewProps {
  return 'workflowId' in props;
}

// 自动排版函数 - 优化段落格式
type FormatType = 'auto' | 'original' | 'compact';

const formatContent = (content: string, formatType: FormatType): string => {
  if (formatType === 'original') {
    return content;
  }

  if (formatType === 'compact') {
    // 紧凑模式：减少空行
    return content
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  // 自动排版模式
  return content
    // 统一标点符号
    .replace(/，/g, '，')
    .replace(/。/g, '。')
    .replace(/！/g, '！')
    .replace(/？/g, '？')
    .replace(/：/g, '：')
    .replace(/；/g, '；')
    // 确保段落之间有两个换行
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n/g, '\n\n')
    .replace(/\n{4,}/g, '\n\n')
    .trim();
};

// 解析 Markdown 内容
const parseMarkdown = (content: string) => {
  const lines = content.split('\n');
  const elements: Array<{ type: string; content: string; level?: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine) continue; // 跳过空行

    if (trimmedLine.startsWith('# ')) {
      elements.push({ type: 'h1', content: trimmedLine.replace('# ', '') });
    } else if (trimmedLine.startsWith('## ')) {
      elements.push({ type: 'h2', content: trimmedLine.replace('## ', '') });
    } else if (trimmedLine.startsWith('### ')) {
      elements.push({ type: 'h3', content: trimmedLine.replace('### ', '') });
    } else if (trimmedLine.startsWith('#### ')) {
      elements.push({ type: 'h4', content: trimmedLine.replace('#### ', '') });
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      elements.push({ type: 'ul', content: trimmedLine.substring(2) });
    } else if (trimmedLine.match(/^\d+\./)) {
      elements.push({ type: 'ol', content: trimmedLine });
    } else if (trimmedLine.startsWith('> ')) {
      elements.push({ type: 'quote', content: trimmedLine.replace('> ', '') });
    } else if (trimmedLine.startsWith('---') || trimmedLine.startsWith('***')) {
      elements.push({ type: 'hr', content: '' });
    } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
      elements.push({ type: 'bold', content: trimmedLine.replace(/\*\*/g, '') });
    } else {
      elements.push({ type: 'p', content: trimmedLine });
    }
  }

  return elements;
};

export const DraftViewer: React.FC<DraftViewerProps> = (props) => {
  const [formatType, setFormatType] = useState<FormatType>('auto');
  const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large'>('normal');

  // 根据 Props 类型获取数据
  const draft = isNewProps(props)
    ? (props.fields.get('current_draft') as string) || ''
    : props.draft;

  const loading = props.loading;

  // 格式化后的内容
  const formattedDraft = useMemo(() => {
    return formatContent(draft, formatType);
  }, [draft, formatType]);

  // 解析 Markdown
  const parsedContent = useMemo(() => {
    return parseMarkdown(formattedDraft);
  }, [formattedDraft]);

  // 复制到剪贴板
  const handleCopy = () => {
    Taro.setClipboardData({
      data: formattedDraft,
      success: () => {
        Taro.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  };

  // 获取当前格式标签
  const getFormatLabel = () => {
    switch (formatType) {
      case 'auto': return '自动排版';
      case 'original': return '原文';
      case 'compact': return '紧凑';
    }
  };

  const handleConfirm = () => {
    if (isNewProps(props)) {
      // 新接口：提交 draft_review 字段
      props.onSubmitInput('draft_review', 'confirm');
    } else {
      // 旧接口：直接调用 onConfirm
      props.onConfirm();
    }
  };

  const handleBack = () => {
    if (isNewProps(props)) {
      // 新接口：提交返回修改请求
      props.onSubmitInput('draft_review', 'revise');
    } else if (props.onBack) {
      // 旧接口：调用 onBack
      props.onBack();
    }
  };

  return (
    <View className='draft-viewer-container'>
      <View className='draft-header'>
        <View className='draft-header-main'>
          <Text className='draft-title'>📝 文章初稿</Text>
          <Text className='draft-subtitle'>请审阅初稿，确认后进入审计阶段</Text>
        </View>

        {/* 排版工具栏 */}
        <View className='draft-toolbar'>
          <View className='toolbar-group'>
            <Text className='toolbar-label'>排版:</Text>
            <View
              className={`toolbar-btn ${formatType === 'auto' ? 'active' : ''}`}
              onClick={() => setFormatType('auto')}
            >
              <Text>自动</Text>
            </View>
            <View
              className={`toolbar-btn ${formatType === 'original' ? 'active' : ''}`}
              onClick={() => setFormatType('original')}
            >
              <Text>原文</Text>
            </View>
            <View
              className={`toolbar-btn ${formatType === 'compact' ? 'active' : ''}`}
              onClick={() => setFormatType('compact')}
            >
              <Text>紧凑</Text>
            </View>
          </View>

          <View className='toolbar-group'>
            <Text className='toolbar-label'>字号:</Text>
            <View
              className={`toolbar-btn ${fontSize === 'small' ? 'active' : ''}`}
              onClick={() => setFontSize('small')}
            >
              <Text>小</Text>
            </View>
            <View
              className={`toolbar-btn ${fontSize === 'normal' ? 'active' : ''}`}
              onClick={() => setFontSize('normal')}
            >
              <Text>中</Text>
            </View>
            <View
              className={`toolbar-btn ${fontSize === 'large' ? 'active' : ''}`}
              onClick={() => setFontSize('large')}
            >
              <Text>大</Text>
            </View>
          </View>

          <View className='toolbar-group'>
            <View className='toolbar-btn' onClick={handleCopy}>
              <Text>📋 复制</Text>
            </View>
          </View>
        </View>

        {/* 当前格式提示 */}
        <View className='format-hint'>
          <Text className='format-hint-text'>当前：{getFormatLabel()}</Text>
        </View>
      </View>

      <ScrollView
        scrollY
        className={`draft-content font-${fontSize} format-${formatType}`}
        enhanced
        showScrollbar
      >
        <View className='markdown-content'>
          {parsedContent.map((element, index) => {
            switch (element.type) {
              case 'h1':
                return <Text key={index} className='h1'>{element.content}</Text>;
              case 'h2':
                return <Text key={index} className='h2'>{element.content}</Text>;
              case 'h3':
                return <Text key={index} className='h3'>{element.content}</Text>;
              case 'h4':
                return <Text key={index} className='h4'>{element.content}</Text>;
              case 'ul':
                return <Text key={index} className='list-item'>• {element.content}</Text>;
              case 'ol':
                return <Text key={index} className='list-item'>{element.content}</Text>;
              case 'quote':
                return <Text key={index} className='quote'>{element.content}</Text>;
              case 'hr':
                return <View key={index} className='divider' />;
              case 'bold':
                return <Text key={index} className='bold'>{element.content}</Text>;
              case 'p':
              default:
                return <Text key={index} className='paragraph'>{element.content}</Text>;
            }
          })}
        </View>
        <View style={{ height: '40px' }} />
      </ScrollView>

      <View className='draft-actions'>
        <Button
          className='back-btn'
          onClick={handleBack}
          disabled={loading}
        >
          返回修改
        </Button>
        <Button
          className='confirm-btn'
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? '提交中...' : '确认并审计'}
        </Button>
      </View>
    </View>
  );
};
