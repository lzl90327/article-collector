import { View, Button, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { login } from '../../api';
import './index.scss';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      // 获取微信登录 code
      const { code } = await Taro.login({
        provider: 'weixin',
      });

      // 调用后端登录
      await login(code);

      Taro.showToast({
        title: '登录成功',
        icon: 'success',
      });

      // 返回上一页或跳转到首页
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('登录失败:', error);
      Taro.showToast({
        title: '登录失败',
        icon: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // 开发测试登录（跳过微信）
  const handleDevLogin = async () => {
    try {
      // 模拟登录，直接存储测试用户
      await Taro.setStorage({ key: 'token', data: 'dev_token_123' });
      await Taro.setStorage({
        key: 'user',
        data: {
          id: 'dev_user_001',
          nickname: '开发测试用户',
          avatar: '',
        },
      });

      Taro.showToast({
        title: '开发登录成功',
        icon: 'success',
      });

      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('开发登录失败:', error);
    }
  };

  return (
    <View className='login-page'>
      <View className='logo-section'>
        <Text className='logo-text'>MindFlow</Text>
        <Text className='slogan'>记录思考，沉淀知识</Text>
      </View>

      <View className='login-section'>
        <Button
          className='login-btn'
          type='primary'
          loading={loading}
          onClick={handleLogin}
        >
          微信一键登录
        </Button>

        {/* 开发测试按钮 */}
        <Button
          className='dev-login-btn'
          size='mini'
          onClick={handleDevLogin}
        >
          开发测试登录（跳过微信）
        </Button>

        <Text className='agreement-text'>
          登录即表示同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </View>
  );
}
