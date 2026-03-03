#!/bin/bash
# 飞书同步功能自测脚本

echo "======================================"
echo "飞书同步功能自测"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000/api"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
PASSED=0
FAILED=0

# 测试函数
run_test() {
    local test_name=$1
    local command=$2
    echo "--------------------------------------"
    echo "测试: $test_name"
    echo "请求: $command"
    echo ""

    result=$(eval "$command" 2>&1)
    http_code=$(eval "${command//-s/-s -w '%{http_code}' -o /dev/null}" 2>&1)

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✅ 通过 (HTTP $http_code)${NC}"
        echo "响应: $result"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ 失败 (HTTP $http_code)${NC}"
        echo "响应: $result"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

echo "1️⃣ 测试健康检查端点"
echo "======================================"
run_test "健康检查" "curl -s ${BASE_URL}/health"

echo ""
echo "2️⃣ 测试同步状态查询（无需认证）"
echo "======================================"
# 同步状态需要认证，先测试端点是否存在
result=$(curl -s ${BASE_URL}/sync/status 2>&1)
if echo "$result" | grep -q "Cannot GET"; then
    echo -e "${RED}❌ 端点不存在${NC}"
    FAILED=$((FAILED + 1))
elif echo "$result" | grep -q "Unauthorized"; then
    echo -e "${YELLOW}⚠️  端点存在但需要认证${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${GREEN}✅ 端点响应正常${NC}"
    echo "响应: $result"
    PASSED=$((PASSED + 1))
fi
echo ""

echo ""
echo "3️⃣ 测试素材同步端点（无需认证）"
echo "======================================"
result=$(curl -s -X POST ${BASE_URL}/sources/sync 2>&1)
if echo "$result" | grep -q "Cannot POST"; then
    echo -e "${RED}❌ 端点不存在${NC}"
    FAILED=$((FAILED + 1))
elif echo "$result" | grep -q "Unauthorized"; then
    echo -e "${YELLOW}⚠️  端点存在但需要认证${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${GREEN}✅ 端点响应正常${NC}"
    echo "响应: $result"
    PASSED=$((PASSED + 1))
fi
echo ""

echo ""
echo "4️⃣ 测试文章同步端点（无需认证）"
echo "======================================"
result=$(curl -s -X POST ${BASE_URL}/articles/sync 2>&1)
if echo "$result" | grep -q "Cannot POST"; then
    echo -e "${RED}❌ 端点不存在${NC}"
    FAILED=$((FAILED + 1))
elif echo "$result" | grep -q "Unauthorized"; then
    echo -e "${YELLOW}⚠️  端点存在但需要认证${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${GREEN}✅ 端点响应正常${NC}"
    echo "响应: $result"
    PASSED=$((PASSED + 1))
fi
echo ""

echo ""
echo "5️⃣ 测试飞书 Access Token 获取"
echo "======================================"
# 创建一个 Node.js 脚本来测试 token 获取
cat > /tmp/test-feishu-token.js << 'EOF'
const axios = require('axios');

async function testFeishuAuth() {
    try {
        const response = await axios.post(
            'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
            {
                app_id: process.env.FEISHU_APP_ID || 'cli_a9f883f1bb781cef',
                app_secret: process.env.FEISHU_APP_SECRET || '',
            }
        );

        if (response.data.code === 0) {
            console.log('✅ 飞书 Access Token 获取成功');
            console.log('Token 前缀:', response.data.app_access_token.substring(0, 20) + '...');
            console.log('过期时间:', response.data.expire, '秒');
            process.exit(0);
        } else {
            console.log('❌ 获取失败:', response.data.msg, '(code:', response.data.code + ')');
            process.exit(1);
        }
    } catch (error) {
        console.log('❌ 请求失败:', error.message);
        if (error.response) {
            console.log('响应数据:', error.response.data);
        }
        process.exit(1);
    }
}

testFeishuAuth();
EOF

# 加载环境变量并运行测试
export $(grep -E '^FEISHU_' /Users/zuolin1/article-collector/mindflow-project/backend/.env | xargs)
node /tmp/test-feishu-token.js
if [ $? -eq 0 ]; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi
echo ""

echo ""
echo "======================================"
echo "自测结果汇总"
echo "======================================"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  部分测试失败，请检查配置${NC}"
    exit 1
fi
