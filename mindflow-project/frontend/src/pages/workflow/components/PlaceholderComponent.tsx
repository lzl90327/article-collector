/**
 * 占位符组件模板
 * 用于尚未实现的 Phase 组件
 */

import React from 'react';
import { View, Text } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import { PhaseComponentBaseProps } from './types';

interface PlaceholderComponentProps extends PhaseComponentBaseProps {
  componentName: string;
  description?: string;
}

export const PlaceholderComponent: React.FC<PlaceholderComponentProps> = ({
  componentName,
  description,
  phaseMeta,
  pendingInput,
  loading,
  onSubmitInput,
  onTriggerPhase,
}) => {
  return (
    <View className='placeholder-component' style={styles.container}>
      <View style={styles.icon}>🚧</View>
      <Text style={styles.title}>{componentName}</Text>
      <Text style={styles.description}>
        {description || phaseMeta?.description || '该功能正在开发中...'}
      </Text>

      {pendingInput && (
        <View style={styles.pendingSection}>
          <Text style={styles.pendingPrompt}>{pendingInput.prompt}</Text>
          {pendingInput.options && (
            <View style={styles.optionsContainer}>
              {pendingInput.options.map((option: any, index: number) => (
                <Button
                  key={index}
                  type='primary'
                  size='small'
                  style={styles.optionButton}
                  onClick={() => onSubmitInput(pendingInput.field, option.value || option)}
                >
                  {option.label || option}
                </Button>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <Button
          type='primary'
          loading={loading}
          onClick={() => onTriggerPhase()}
        >
          {loading ? '处理中...' : '继续'}
        </Button>
        {phaseMeta?.skippable && (
          <Button
            type='default'
            onClick={() => onSubmitInput('skip', true)}
          >
            跳过
          </Button>
        )}
      </View>
    </View>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  icon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#333',
  },
  description: {
    fontSize: '16px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '30px',
    lineHeight: '1.6',
  },
  pendingSection: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  pendingPrompt: {
    fontSize: '16px',
    color: '#333',
    marginBottom: '16px',
    textAlign: 'center',
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  optionButton: {
    width: '100%',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '300px',
  },
};

// 导出各个占位符组件
export const MaterialSelector: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='素材获取' description='从外部源获取写作素材' />
);

export const PreAngleSelector: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='预选题' description='初步选择写作角度' />
);

export const AutoSync: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='自动同步' description='自动同步外部数据' />
);

export const AngleConfirmation: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='选题确认' description='确认最终选题方向' />
);

export const ObservationCollector: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='观察片段收集' description='收集日常观察片段' />
);

export const ObservationJournal: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='观察随想整理' description='整理观察随想笔记' />
);

export const ConvergenceView: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='观点收敛' description='收敛讨论观点' />
);

export const LightReview: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='轻量审阅' description='快速审阅文章' />
);

export const ImageGenerator: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='配图生成' description='AI 生成文章配图' />
);

export const PublishView: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='发布' description='发布到各平台' />
);

export const ViewpointExtractor: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='观点提炼' description='提炼核心观点' />
);

export const RetroView: React.FC<Omit<PlaceholderComponentProps, 'componentName'>> = (props) => (
  <PlaceholderComponent {...props} componentName='发布后复盘' description='复盘写作过程' />
);
