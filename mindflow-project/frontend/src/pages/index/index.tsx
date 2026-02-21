import React, { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View } from '@tarojs/components'
import { Button, ConfigProvider, TextArea, Toast } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { startWorkflow } from '../../api'
import './index.scss'

function Index() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    console.log('MindFlow Client v1.1 - Using 127.0.0.1');
  }, []);

  const handleStart = async () => {
    if (!input.trim() || loading) {
      return
    }
    setLoading(true)
    try {
      const res = await startWorkflow(input)
      console.log('Workflow Started:', res)
      // 清空输入
      setInput('')
      
      // 先重置 loading 状态，再跳转
      setLoading(false)
      
      // 使用 redirectTo 减少页面栈深度，避免 timeout
      Taro.redirectTo({ 
        url: `/pages/workflow/index?id=${res.workflowId}`,
        success: () => {
          console.log('页面跳转成功')
        },
        fail: (err) => {
          console.error('页面跳转失败:', err)
          Taro.showToast({ title: '页面跳转失败，请重试', icon: 'none' })
        }
      })
    } catch (err) {
      console.error(err)
      setLoading(false)
      Taro.showToast({ title: '启动失败，请重试', icon: 'none' })
    }
  }

  return (
    <ConfigProvider locale={zhCN}>
      <View className='mindflow-home'>
        <View className='header'>
          MindFlow
        </View>
        <View className='input-area'>
          {!loading ? (
            <>
              <TextArea 
                placeholder="我想写一篇关于..." 
                value={input}
                onChange={(val) => setInput(val)}
                rows={4}
                disabled={loading}
              />
              <Button 
                block 
                type='primary' 
                onClick={handleStart}
                style={{ marginTop: '20px' }}
                disabled={!input.trim()}
              >
                开始写作
              </Button>
            </>
          ) : (
            <View className='loading-container'>
              <View className='loading-spinner' />
              <View className='loading-text'>
                正在启动写作工作流...
              </View>
            </View>
          )}
        </View>
      </View>
    </ConfigProvider>
  )
}

export default Index
