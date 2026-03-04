export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/editor/index',
    'pages/review/index',
    'pages/artifacts/index',
    'pages/sources/index',
    'pages/sources/detail',
    'pages/sources/full-content',
    'pages/me/index',
    'pages/workflow/index',
    'pages/login/index',
    'pages/agreement/index',
    'pages/privacy/index',
    'pages/feishu-auth/index',
    'pages/feishu-wiki/index',
    'pages/feishu-doc/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'MindFlow',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#999',
    selectedColor: '#1890ff',
    backgroundColor: '#fff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '创作'
      },
      {
        pagePath: 'pages/artifacts/index',
        text: '稿件'
      },
      {
        pagePath: 'pages/sources/index',
        text: '灵感'
      },
      {
        pagePath: 'pages/me/index',
        text: '我的'
      }
    ]
  }
})
