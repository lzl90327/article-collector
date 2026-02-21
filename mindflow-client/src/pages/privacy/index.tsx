import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function PrivacyPage() {
  return (
    <View className='privacy-page'>
      <View className='header'>
        <Text className='title'>隐私政策</Text>
      </View>
      <ScrollView className='content' scrollY>
        <Text className='text'>
          MindFlow 隐私政策

          1. 信息收集
          我们收集的信息包括：
          - 微信 openid（用于身份识别）
          - 昵称和头像（用于展示）
          - 您创建的想法和素材

          2. 信息使用
          我们使用您的信息用于：
          - 提供小程序服务
          - 同步数据到飞书
          - 改善用户体验

          3. 信息共享
          我们不会将您的个人信息出售给第三方。

          4. 信息安全
          我们采取合理的安全措施保护您的信息。

          5. 您的权利
          您可以随时删除您的账户和相关数据。
        </Text>
      </ScrollView>
    </View>
  );
}
