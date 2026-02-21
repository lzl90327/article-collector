/**
 * Loading 组件
 * 页面加载状态展示
 */

import React from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface LoadingProps {
  text?: string;
  fullScreen?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const Loading: React.FC<LoadingProps> = ({
  text = '加载中...',
  fullScreen = false,
  size = 'medium',
}) => {
  const sizeClass = `loading-${size}`;

  if (fullScreen) {
    return (
      <View className="loading-fullscreen">
        <View className={`loading-spinner ${sizeClass}`}>
          <View className="spinner-dot" />
          <View className="spinner-dot" />
          <View className="spinner-dot" />
        </View>
        {text && <Text className="loading-text">{text}</Text>}
      </View>
    );
  }

  return (
    <View className="loading-container">
      <View className={`loading-spinner ${sizeClass}`}>
        <View className="spinner-dot" />
        <View className="spinner-dot" />
        <View className="spinner-dot" />
      </View>
      {text && <Text className="loading-text">{text}</Text>}
    </View>
  );
};

export default Loading;
