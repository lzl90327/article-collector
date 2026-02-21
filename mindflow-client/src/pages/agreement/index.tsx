import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function AgreementPage() {
  return (
    <View className='agreement-page'>
      <View className='header'>
        <Text className='title'>用户协议</Text>
      </View>
      <ScrollView className='content' scrollY>
        <Text className='text'>
          欢迎使用 MindFlow 小程序！

          1. 服务条款
          本协议是您与 MindFlow 之间关于使用本小程序服务的协议。

          2. 账号注册
          您需要使用微信账号登录本小程序。

          3. 用户行为规范
          您在使用本服务时应遵守相关法律法规。

          4. 隐私保护
          我们重视您的隐私保护，具体请参见《隐私政策》。

          5. 免责声明
          本小程序按"现状"提供，我们不承担任何明示或暗示的保证责任。

          6. 协议修改
          我们有权随时修改本协议，修改后的协议将在小程序内公布。
        </Text>
      </ScrollView>
    </View>
  );
}
