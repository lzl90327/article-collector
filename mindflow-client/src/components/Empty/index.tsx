/**
 * Empty 组件
 * 空状态展示
 */

import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import './index.scss';

interface EmptyProps {
  icon?: string;
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const Empty: React.FC<EmptyProps> = ({
  icon = '📭',
  title = '暂无数据',
  description,
  actionText,
  onAction,
}) => {
  return (
    <View className="empty-container">
      <Text className="empty-icon">{icon}</Text>
      <Text className="empty-title">{title}</Text>
      {description && <Text className="empty-description">{description}</Text>}
      {actionText && onAction && (
        <View className="empty-action">
          <Button
            type="primary"
            size="mini"
            className="action-button"
            onClick={onAction}
          >
            {actionText}
          </Button>
        </View>
      )}
    </View>
  );
};

export default Empty;
