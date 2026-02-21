/**
 * ErrorBoundary 组件
 * 错误边界捕获和处理
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // 可以在这里上报错误到监控服务
    this.reportError(error, errorInfo);
  }

  reportError(error: Error, errorInfo: React.ErrorInfo) {
    // TODO: 接入错误监控服务（如 Sentry）
    console.error('Error Report:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      page: Taro.getCurrentInstance().router?.path,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  handleGoHome = () => {
    Taro.switchTab({ url: '/pages/index/index' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="error-boundary">
          <Text className="error-icon">⚠️</Text>
          <Text className="error-title">页面出错了</Text>
          <Text className="error-message">
            {this.state.error?.message || '未知错误'}
          </Text>
          <View className="error-actions">
            <Button
              type="primary"
              size="mini"
              className="action-btn"
              onClick={this.handleReset}
            >
              重试
            </Button>
            <Button
              size="mini"
              className="action-btn secondary"
              onClick={this.handleGoHome}
            >
              返回首页
            </Button>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
