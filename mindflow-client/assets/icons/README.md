# TabBar 图标说明

## 图标列表（需要添加）

### 1. 工作台 (Home)
- `home.png` - 普通状态
- `home-active.png` - 激活状态

### 2. 作品 (Records)
- `records.png` - 普通状态
- `records-active.png` - 激活状态

### 3. 素材 (Bookmark)
- `bookmark.png` - 普通状态
- `bookmark-active.png` - 激活状态

### 4. 我的 (User)
- `user.png` - 普通状态
- `user-active.png` - 激活状态

## 图标规格
- **尺寸**: 81x81px
- **格式**: PNG
- **透明背景**: 是
- **颜色**: 
  - 普通状态: #999999 (灰色)
  - 激活状态: #1890ff (主题蓝色)

## 获取图标方式

### 方式1: 使用Taroify官方图标库
可以从以下资源获取:
- Taroify Icons: https://taroify.gitee.io/taroify.com/components/icon/
- 或使用微信小程序官方图标库

### 方式2: 使用Iconfont
1. 访问 https://www.iconfont.cn/
2. 搜索图标: home, file, bookmark, user
3. 下载PNG格式
4. 调整尺寸为81x81px

### 方式3: 设计师提供
请UI设计师按照规格设计8个图标

## 临时解决方案
如果没有图标资源，可以修改 `app.config.ts` 暂时移除图标配置：

```typescript
tabBar: {
  list: [
    {
      pagePath: 'pages/index/index',
      text: '工作台'
      // 暂时不配置iconPath
    },
    // ...
  ]
}
```
