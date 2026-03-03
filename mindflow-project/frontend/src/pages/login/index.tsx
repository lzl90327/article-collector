import React, { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button, ConfigProvider } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import './index.scss'

// API 基础 URL
const API_BASE_URL = 'http://127.0.0.1:3001'

function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 检查是否已登录
    checkLoginStatus()
  }, [])

  // 检查登录状态
  const checkLoginStatus = async () => {
    try {
      const token = await Taro.getStorage({ key: 'token' })
      if (token.data) {
        // 已登录，返回首页
        Taro.redirectTo({ url: '/pages/index/index' })
      }
    } catch {
      // 未登录，继续显示登录页
    }
  }

  // 处理微信登录
  const handleWechatLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. 获取微信登录 code
      const loginRes = await Taro.login({
        provider: 'weixin'
      })

      if (!loginRes.code) {
        throw new Error('获取微信登录凭证失败')
      }

      console.log('微信登录 code:', loginRes.code)

      // 2. 调用后端登录接口
      const response = await Taro.request({
        url: `${API_BASE_URL}/api/auth/login`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          code: loginRes.code
        }
      })

      console.log('登录响应:', response.data)

      if (response.statusCode === 200 && response.data.success) {
        // 3. 保存 token
        await Taro.setStorage({
          key: 'token',
          data: response.data.token
        })

        // 4. 保存用户信息
        if (response.data.user) {
          await Taro.setStorage({
            key: 'userInfo',
            data: response.data.user
          })
        }

        Taro.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        })

        // 5. 返回首页
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/index/index' })
        }, 1500)
      } else {
        throw new Error(response.data.error || '登录失败')
      }
    } catch (err: any) {
      console.error('登录失败:', err)
      const errorMsg = err.message || '登录失败，请重试'
      setError(errorMsg)
      Taro.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfigProvider locale={zhCN}>
      <View className='login-page'>
        <View className='login-container'>
          {/* Logo 区域 */}
          <View className='logo-section'>
            <View className='logo'>📝</View>
            <Text className='app-name'>MindFlow</Text>
            <Text className='app-slogan'>AI 辅助写作工作流</Text>
          </View>

          {/* 登录区域 */}
          <View className='login-section'>
            <Text className='login-title'>欢迎登录</Text>
            <Text className='login-desc'>使用微信账号快速登录</Text>

            {error && (
              <View className='error-message'>
                <Text>{error}</Text>
              </View>
            )}

            <Button
              className='login-button'
              type='primary'
              size='large'
              loading={loading}
              disabled={loading}
              onClick={handleWechatLogin}
            >
              {loading ? '登录中...' : '微信一键登录'}
            </Button>

            <Text className='login-tip'>
              登录即表示您同意我们的服务条款
            </Text>
          </View>

          {/* 底部信息 */}
          <View className='footer-section'>
            <Text className='footer-text'>MindFlow v1.0</Text>
          </View>
        </View>
      </View>
    </ConfigProvider>
  )
}

export default Login
