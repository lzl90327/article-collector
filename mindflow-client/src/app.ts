import React, { useEffect } from 'react'
import { useDidShow, useDidHide } from '@tarojs/taro'
import { ErrorBoundary } from './components'
// 全局样式
import './app.scss'

function App(props) {
  // 可以使用所有的 React Hooks
  useEffect(() => {})

  // 对应 onShow
  useDidShow(() => {})

  // 对应 onHide
  useDidHide(() => {})

  return React.createElement(
    ErrorBoundary,
    { onReset: () => window.location.reload() },
    props.children
  )
}

export default App
