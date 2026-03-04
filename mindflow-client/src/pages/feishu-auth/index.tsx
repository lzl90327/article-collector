import React, { useState, useEffect } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { getFeishuAuthUrl, getFeishuAuthStatus } from '../../api/feishu';
import './index.scss';

/**
 * 飞书授权页面
 * 用于引导用户完成飞书知识库的 OAuth 授权
 */
export default function FeishuAuth() {
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<'unauthorized' | 'authorized' | 'checking'>('checking');
  const [authUrl, setAuthUrl] = useState('');

  // 用户 ID（实际项目中应该从用户信息中获取）
  // 注意：需要与后端保存的 userId 一致
  const userId = 'test_user_123';

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // 页面显示时重新检查授权状态（从授权页面返回时）
  useDidShow(() => {
    checkAuthStatus();
  });

  /**
   * 检查授权状态
   */
  const checkAuthStatus = async () => {
    try {
      setAuthStatus('checking');
      const res = await getFeishuAuthStatus(userId);
      
      if (res.data?.isAuthorized && !res.data?.isExpired) {
        setAuthStatus('authorized');
        Taro.showToast({
          title: '已授权',
          icon: 'success',
        });
      } else {
        setAuthStatus('unauthorized');
      }
    } catch (error) {
      console.error('检查授权状态失败:', error);
      setAuthStatus('unauthorized');
    }
  };

  /**
   * 开始飞书授权
   */
  const handleAuth = async () => {
    try {
      setLoading(true);
      const res = await getFeishuAuthUrl(userId);
      
      if (res.data?.authUrl) {
        setAuthUrl(res.data.authUrl);
        
        // 复制授权链接到剪贴板
        Taro.setClipboardData({
          data: res.data.authUrl,
          success: () => {
            Taro.showModal({
              title: '请完成授权',
              content: '授权链接已复制，请在浏览器中打开完成飞书授权',
              showCancel: false,
              confirmText: '我知道了',
              success: () => {
                // 打开外部浏览器
                Taro.openEmbeddedMiniProgram?.({
                  appId: '',
                  path: res.data.authUrl,
                }).catch(() => {
                  // 如果无法打开，提示用户手动复制
                  Taro.showToast({
                    title: '请手动在浏览器中打开',
                    icon: 'none',
                    duration: 3000,
                  });
                });
              },
            });
          },
        });
      }
    } catch (error) {
      console.error('获取授权链接失败:', error);
      Taro.showToast({
        title: '获取授权链接失败',
        icon: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * 前往知识库页面
   */
  const goToWiki = () => {
    Taro.navigateTo({
      url: '/pages/feishu-wiki/index',
    });
  };

  if (authStatus === 'checking') {
    return (
      <View className="feishu-auth">
        <View className="loading-spinner">⏳</View>
        <Text className="loading-text">检查授权状态中...</Text>
      </View>
    );
  }

  return (
    <View className="feishu-auth">
      <View className="auth-header">
        <Text className="title">飞书知识库</Text>
        <Text className="subtitle">同步您的飞书文档到 MindFlow</Text>
      </View>

      <View className="auth-content">
        {authStatus === 'authorized' ? (
          <View className="authorized-section">
            <View className="success-icon">✓</View>
            <Text className="success-text">授权成功</Text>
            <Text className="success-desc">您已成功连接飞书知识库</Text>
            <Button
              type="primary"
              className="action-btn"
              onClick={goToWiki}
            >
              查看我的知识库
            </Button>
          </View>
        ) : (
          <View className="unauthorized-section">
            <View className="auth-icon">📚</View>
            <Text className="auth-title">未授权</Text>
            <Text className="auth-desc">
              需要您授权访问飞书知识库，才能同步文档内容
            </Text>
            
            <View className="feature-list">
              <Text className="feature-item">✓ 获取知识库文档列表</Text>
              <Text className="feature-item">✓ 读取文档内容</Text>
              <Text className="feature-item">✓ 创建和编辑文档</Text>
            </View>

            <Button
              type="primary"
              className="auth-btn"
              loading={loading}
              onClick={handleAuth}
            >
              开始授权
            </Button>
          </View>
        )}
      </View>

      <View className="auth-footer">
        <Text className="footer-text">
          授权仅用于访问您的飞书文档，我们不会保存您的账号密码
        </Text>
      </View>
    </View>
  );
}
