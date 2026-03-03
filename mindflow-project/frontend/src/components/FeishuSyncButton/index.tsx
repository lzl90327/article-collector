import React, { useState } from 'react';
import { View } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import Taro from '@tarojs/taro';
import { syncArticleToFeishu } from '../../services/api';

interface FeishuSyncButtonProps {
  articleId: string;
  onSyncSuccess?: (url: string) => void;
}

export const FeishuSyncButton: React.FC<FeishuSyncButtonProps> = ({
  articleId,
  onSyncSuccess
}) => {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    if (!articleId) {
      Taro.showToast({
        title: '文章ID不能为空',
        icon: 'none'
      });
      return;
    }

    setLoading(true);

    try {
      const result = await syncArticleToFeishu(articleId);

      Taro.showToast({
        title: '同步成功',
        icon: 'success'
      });

      if (onSyncSuccess && result.url) {
        onSyncSuccess(result.url);
      }
    } catch (error: any) {
      console.error('同步失败:', error);
      // 错误已经在 request 函数中处理（401 会跳转登录页）
      // 其他错误显示提示
      if (error.message !== '登录已过期') {
        Taro.showToast({
          title: error.message || '同步失败',
          icon: 'none',
          duration: 2000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button
        type='primary'
        size='small'
        loading={loading}
        disabled={loading}
        onClick={handleSync}
      >
        {loading ? '同步中...' : '飞书云文档同步'}
      </Button>
    </View>
  );
};

export default FeishuSyncButton;
