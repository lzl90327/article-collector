# MindFlow 云服务器部署指南

## 🚀 服务器信息

- **服务器地址**: 100.117.165.59
- **用户名**: lizuolin_cloud
- **部署目录**: ~/mindflow
- **服务端口**: 3001

---

## 📋 前置要求

服务器需要安装：
1. Node.js (v18+)
2. PM2 (进程管理器)
3. Git (可选)

---

## 🔧 步骤 1: 在服务器上安装 Node.js

SSH 登录到服务器：
```bash
ssh lizuolin_cloud@100.117.165.59
```

安装 Node.js：
```bash
# 使用 nvm 安装
 curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 验证安装
node --version  # 应该显示 v20.x.x
npm --version   # 应该显示 10.x.x
```

---

## 📦 步骤 2: 上传部署文件

在本地执行：
```bash
cd /Users/zuolin1/article-collector/mindflow-project

# 构建后端
npm run build

# 创建部署包
tar -czf mindflow-deploy.tar.gz backend/

# 上传到服务器
scp mindflow-deploy.tar.gz lizuolin_cloud@100.117.165.59:~/
```

---

## 🚀 步骤 3: 在服务器上部署

SSH 登录到服务器：
```bash
ssh lizuolin_cloud@100.117.165.59
```

解压并安装：
```bash
# 创建目录
mkdir -p ~/mindflow
cd ~/mindflow

# 解压
tar -xzf ~/mindflow-deploy.tar.gz

# 进入后端目录
cd backend

# 安装依赖
npm install --production

# 复制生产环境配置
cp .env.production .env
```

---

## 🔄 步骤 4: 使用 PM2 启动服务

安装 PM2：
```bash
npm install -g pm2
```

启动服务：
```bash
cd ~/mindflow/backend

# 启动服务
pm2 start dist/index.js --name mindflow-backend --env production

# 保存配置
pm2 save

# 设置开机自启
pm2 startup systemd
```

---

## ✅ 步骤 5: 验证部署

检查服务状态：
```bash
pm2 status mindflow-backend
```

查看日志：
```bash
pm2 logs mindflow-backend
```

测试 API：
```bash
curl http://localhost:3001/health
```

---

## 🌐 步骤 6: 配置防火墙（如果需要）

如果服务器有防火墙，需要开放 3001 端口：
```bash
# Ubuntu/Debian
sudo ufw allow 3001

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

---

## 🔗 步骤 7: 更新小程序 API 地址

部署完成后，需要更新小程序的 API 地址：

编辑 `frontend/src/utils/request.ts`：
```typescript
const BASE_URL = 'http://100.117.165.59:3001/api/mindflow';
```

然后重新构建小程序：
```bash
cd frontend
npm run build:weapp
```

---

## 📊 管理命令

```bash
# 查看服务状态
pm2 status mindflow-backend

# 查看日志
pm2 logs mindflow-backend

# 重启服务
pm2 restart mindflow-backend

# 停止服务
pm2 stop mindflow-backend

# 删除服务
pm2 delete mindflow-backend
```

---

## 🔄 更新部署

当代码更新后，重新部署：

1. 本地构建并上传
2. 服务器上执行：
```bash
cd ~/mindflow/backend
pm2 stop mindflow-backend
npm install
npm run build
pm2 start mindflow-backend
```

---

## 🐛 故障排查

### 服务无法启动
```bash
# 检查日志
pm2 logs mindflow-backend

# 检查端口占用
lsof -i :3001
```

### 数据库连接失败
检查 `.env` 文件中的 Supabase 配置是否正确。

### API 无响应
```bash
# 检查服务是否运行
pm2 status

# 检查端口监听
netstat -tlnp | grep 3001
```

---

## 📞 联系支持

如有问题，请检查：
1. 服务器 Node.js 版本
2. 环境变量配置
3. 防火墙设置
4. PM2 日志输出
