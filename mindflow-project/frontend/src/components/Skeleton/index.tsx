/**
 * 骨架屏组件
 * 用于加载状态的占位显示
 */

import React from 'react';
import { View } from '@tarojs/components';
import './index.scss';

interface SkeletonProps {
  rows?: number;
  animated?: boolean;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  rows = 3,
  animated = true,
  className = ''
}) => {
  return (
    <View className={`skeleton ${animated ? 'skeleton--animated' : ''} ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} className="skeleton__row">
          <View className="skeleton__line skeleton__line--long" />
          {index % 2 === 0 && <View className="skeleton__line skeleton__line--short" />}
        </View>
      ))}
    </View>
  );
};

// BriefCard 骨架屏
export const BriefCardSkeleton: React.FC = () => (
  <View className="skeleton-card">
    <View className="skeleton-card__header">
      <View className="skeleton__title" />
    </View>
    <View className="skeleton-card__body">
      <Skeleton rows={5} />
    </View>
    <View className="skeleton-card__footer">
      <View className="skeleton__button" />
    </View>
  </View>
);

// AngleSelector 骨架屏
export const AngleSelectorSkeleton: React.FC = () => (
  <View className="skeleton-card">
    <View className="skeleton-card__header">
      <View className="skeleton__title" />
      <View className="skeleton__subtitle" />
    </View>
    <View className="skeleton-card__body">
      <View className="skeleton__section-title" />
      <Skeleton rows={3} />
      <View className="skeleton__section-title" />
      <Skeleton rows={3} />
    </View>
  </View>
);

// ChatInterface 骨架屏
export const ChatInterfaceSkeleton: React.FC = () => (
  <View className="skeleton-chat">
    <View className="skeleton-chat__messages">
      <View className="skeleton-chat__message skeleton-chat__message--assistant">
        <Skeleton rows={2} />
      </View>
      <View className="skeleton-chat__message skeleton-chat__message--user">
        <View className="skeleton__line skeleton__line--medium" />
      </View>
      <View className="skeleton-chat__message skeleton-chat__message--assistant">
        <Skeleton rows={3} />
      </View>
    </View>
    <View className="skeleton-chat__input">
      <View className="skeleton__input" />
      <View className="skeleton__button skeleton__button--small" />
    </View>
  </View>
);

// DraftViewer 骨架屏
export const DraftViewerSkeleton: React.FC = () => (
  <View className="skeleton-card">
    <View className="skeleton-card__header">
      <View className="skeleton__title" />
    </View>
    <View className="skeleton-card__body">
      <Skeleton rows={8} />
    </View>
  </View>
);

// AuditReport 骨架屏
export const AuditReportSkeleton: React.FC = () => (
  <View className="skeleton-card">
    <View className="skeleton-card__header">
      <View className="skeleton__title" />
      <View className="skeleton__score" />
    </View>
    <View className="skeleton-card__body">
      <Skeleton rows={4} />
    </View>
  </View>
);
