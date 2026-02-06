#!/bin/bash
set -e

echo "====================================="
echo "开始安装 Redis (源码编译方式)"
echo "====================================="

# Redis 版本
REDIS_VERSION="7.2.4"
REDIS_DIR="$HOME/redis"
REDIS_DOWNLOAD_URL="https://download.redis.io/releases/redis-${REDIS_VERSION}.tar.gz"

# 检查是否已安装
if [ -f "$REDIS_DIR/bin/redis-server" ]; then
    echo "Redis 已安装: $($REDIS_DIR/bin/redis-server --version)"
    
    # 检查是否正在运行
    if pgrep redis-server &> /dev/null; then
        echo "Redis 服务正在运行"
        
        # 测试连接
        if $REDIS_DIR/bin/redis-cli ping 2>/dev/null | grep -q "PONG"; then
            echo "✅ Redis 服务已启动"
            echo "✅ Redis 连接测试成功"
            exit 0
        fi
    else
        echo "启动 Redis 服务..."
        $REDIS_DIR/bin/redis-server --daemonize yes --bind 127.0.0.1 --dir $REDIS_DIR/data --logfile $REDIS_DIR/redis.log
        sleep 2
        
        if $REDIS_DIR/bin/redis-cli ping 2>/dev/null | grep -q "PONG"; then
            echo "✅ Redis 服务已启动"
            echo "✅ Redis 连接测试成功"
            exit 0
        fi
    fi
fi

echo "下载 Redis ${REDIS_VERSION}..."
cd /tmp

# 清理旧文件
rm -rf redis-${REDIS_VERSION}* 2>/dev/null || true

# 下载
curl -L -o redis-${REDIS_VERSION}.tar.gz ${REDIS_DOWNLOAD_URL}

if [ ! -f redis-${REDIS_VERSION}.tar.gz ]; then
    echo "❌ Redis 下载失败"
    exit 1
fi

echo "解压..."
tar -xzf redis-${REDIS_VERSION}.tar.gz
cd redis-${REDIS_VERSION}

echo "编译 Redis..."
make -j$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 2)

echo "安装 Redis 到 $REDIS_DIR..."
mkdir -p $REDIS_DIR/{bin,etc,data}

# 复制二进制文件
cp src/redis-server $REDIS_DIR/bin/
cp src/redis-cli $REDIS_DIR/bin/
cp src/redis-benchmark $REDIS_DIR/bin/
cp src/redis-check-aof $REDIS_DIR/bin/
cp src/redis-check-rdb $REDIS_DIR/bin/

# 创建配置文件
REDIS_CONF="$REDIS_DIR/etc/redis.conf"
cp redis.conf "$REDIS_CONF"

# 修改配置
sed -i '' 's|^bind .*|bind 127.0.0.1|' "$REDIS_CONF" 2>/dev/null || \
    sed -i 's|^bind .*|bind 127.0.0.1|' "$REDIS_CONF"

sed -i '' 's|^daemonize no|daemonize yes|' "$REDIS_CONF" 2>/dev/null || \
    sed -i 's|^daemonize no|daemonize yes|' "$REDIS_CONF"

sed -i '' "s|^dir .*|dir $REDIS_DIR/data|" "$REDIS_CONF" 2>/dev/null || \
    sed -i "s|^dir .*|dir $REDIS_DIR/data|" "$REDIS_CONF"

sed -i '' "s|^logfile .*|logfile $REDIS_DIR/redis.log|" "$REDIS_CONF" 2>/dev/null || \
    sed -i "s|^logfile .*|logfile $REDIS_DIR/redis.log|" "$REDIS_CONF"

echo "配置文件位置: $REDIS_CONF"

# 启动 Redis
echo ""
echo "====================================="
echo "启动 Redis 服务"
echo "====================================="

# 停止可能存在的旧进程
pkill redis-server 2>/dev/null || true
sleep 1

# 启动
$REDIS_DIR/bin/redis-server "$REDIS_CONF"
sleep 3

# 测试连接
if $REDIS_DIR/bin/redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "✅ Redis 服务已启动"
    echo "✅ Redis 连接测试成功"
else
    echo "❌ Redis 连接测试失败"
    cat $REDIS_DIR/redis.log 2>/dev/null || true
    exit 1
fi

echo ""
echo "====================================="
echo "Redis 安装完成"
echo "====================================="
$REDIS_DIR/bin/redis-cli --version
echo "Redis 服务端口: 6379"
echo "Redis 安装目录: $REDIS_DIR"
echo "Redis 配置文件: $REDIS_CONF"
echo "Redis 数据目录: $REDIS_DIR/data"
echo "Redis 日志文件: $REDIS_DIR/redis.log"

# 清理临时文件
cd /tmp
rm -rf redis-${REDIS_VERSION}*

echo ""
echo "将以下内容添加到 ~/.zshrc 或 ~/.bashrc 以便使用 redis-cli:"
echo "export PATH=\"\$HOME/redis/bin:\$PATH\""
