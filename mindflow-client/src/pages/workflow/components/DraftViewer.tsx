import React from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import './DraftViewer.scss';

interface DraftViewerProps {
  draft: string;
  onConfirm: () => void;
  onBack?: () => void;
  loading?: boolean;
}

export const DraftViewer: React.FC<DraftViewerProps> = ({ 
  draft, 
  onConfirm, 
  onBack,
  loading = false 
}) => {
  return (
    <View className='draft-viewer-container'>
      <View className='draft-header'>
        <Text className='draft-title'>📝 文章初稿</Text>
        <Text className='draft-subtitle'>请审阅初稿，确认后进入审计阶段</Text>
      </View>

      <ScrollView 
        scrollY 
        className='draft-content'
        enhanced
        showScrollbar
      >
        <View className='markdown-content'>
          {draft.split('\n').map((line, index) => {
            // Simple markdown rendering
            if (line.startsWith('# ')) {
              return <Text key={index} className='h1'>{line.replace('# ', '')}</Text>;
            } else if (line.startsWith('## ')) {
              return <Text key={index} className='h2'>{line.replace('## ', '')}</Text>;
            } else if (line.startsWith('### ')) {
              return <Text key={index} className='h3'>{line.replace('### ', '')}</Text>;
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
              return <Text key={index} className='list-item'>• {line.substring(2)}</Text>;
            } else if (line.match(/^\d+\./)) {
              return <Text key={index} className='list-item'>{line}</Text>;
            } else if (line.startsWith('> ')) {
              return <Text key={index} className='quote'>{line.replace('> ', '')}</Text>;
            } else if (line.trim() === '') {
              return <View key={index} className='paragraph-break' />;
            } else {
              return <Text key={index} className='paragraph'>{line}</Text>;
            }
          })}
        </View>
      </ScrollView>

      <View className='draft-actions'>
        {onBack && (
          <Button 
            className='back-btn' 
            onClick={onBack}
            disabled={loading}
          >
            返回修改
          </Button>
        )}
        <Button 
          className='confirm-btn' 
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? '提交中...' : '确认并审计'}
        </Button>
      </View>
    </View>
  );
};
