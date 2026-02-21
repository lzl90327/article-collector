import React, { useState, useEffect } from 'react';
import { View, Text, Button, Textarea } from '@tarojs/components';
import Taro, { useShow } from '@tarojs/taro';
import { getStoredUser, logout, createIdea, isLoggedIn } from '../../api';
import { Loading, Empty } from '../../components';
import './index.scss';

export default function MePage() {
  const [user, setUser] = useState<any>(null);
  const [isLogin, setIsLogin] = useState(false);
  const [ideaContent, setIdeaContent] = useState('');
  const [showIdeaInput, setShowIdeaInput] = useState(false);

  // 检查登录状态
  useShow(() => {
    checkLoginStatus();
  });

  const checkLoginStatus = async () => {
    const loggedIn = await isLoggedIn();
    setIsLogin(loggedIn);
    if (loggedIn) {
      const userInfo = await getStoredUser();
      setUser(userInfo);
    }
  };

  // 跳转到登录页
  const handleLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' });
  };

  // 退出登录
  const handleLogout = async () => {
    const res = await Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
    });
    if (res.confirm) {
      await logout();
      setUser(null);
      setIsLogin(false);
      Taro.showToast({ title: '已退出登录', icon: 'success' });
    }
  };

  // 提交想法
  const handleSubmitIdea = async () => {
    if (!ideaContent.trim()) {
      Taro.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    try {
      await createIdea({
        content: ideaContent,
        type: 'text',
      });
      Taro.showToast({ title: '记录成功', icon: 'success' });
      setIdeaContent('');
      setShowIdeaInput(false);
    } catch (error) {
      Taro.showToast({ title: '记录失败', icon: 'error' });
    }
  };

  // 菜单项
  const menuItems = [
    { icon: '💡', label: '我的想法', url: '/pages/me/ideas' },
    { icon: '💭', label: '观点库', url: '/pages/me/viewpoints' },
    { icon: '⚙️', label: '设置', url: '/pages/me/settings' },
  ];

  return (
    <View className='me-page'>
      {/* 用户信息区域 */}
      <View className='user-section'>
        {isLogin && user ? (
          <>
            <View className='avatar'>
              {user.avatar ? (
                <image src={user.avatar} className='avatar-img' />
              ) : (
                <Text className='avatar-placeholder'>👤</Text>
              )}
            </View>
            <Text className='nickname'>{user.nickname || '未设置昵称'}</Text>
            <Button className='logout-btn' size='mini' onClick={handleLogout}>
              退出登录
            </Button>
          </>
        ) : (
          <>
            <View className='avatar'>
              <Text className='avatar-placeholder'>👤</Text>
            </View>
            <Text className='nickname'>游客</Text>
            <Button className='login-btn' type='primary' size='mini' onClick={handleLogin}>
              立即登录
            </Button>
          </>
        )}
      </View>

      {/* 快速记录想法 */}
      <View className='idea-section'>
        <Text className='section-title'>💡 快速记录想法</Text>
        {!showIdeaInput ? (
          <View className='idea-input-placeholder' onClick={() => setShowIdeaInput(true)}>
            <Text className='placeholder-text'>点击记录你的想法...</Text>
          </View>
        ) : (
          <View className='idea-input-wrapper'>
            <Textarea
              className='idea-textarea'
              placeholder='记录你的想法...'
              value={ideaContent}
              onInput={(e) => setIdeaContent(e.detail.value)}
              maxlength={500}
            />
            <View className='idea-actions'>
              <Button className='cancel-btn' size='mini' onClick={() => setShowIdeaInput(false)}>
                取消
              </Button>
              <Button className='submit-btn' type='primary' size='mini' onClick={handleSubmitIdea}>
                提交
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* 菜单列表 */}
      <View className='menu-section'>
        {menuItems.map((item, index) => (
          <View
            key={index}
            className='menu-item'
            onClick={() => Taro.navigateTo({ url: item.url })}
          >
            <Text className='menu-icon'>{item.icon}</Text>
            <Text className='menu-label'>{item.label}</Text>
            <Text className='menu-arrow'>›</Text>
          </View>
        ))}
      </View>

      {/* 同步状态 */}
      <View className='sync-section'>
        <Text className='sync-text'>上次同步: 刚刚</Text>
      </View>
    </View>
  );
}
