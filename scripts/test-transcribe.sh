#!/bin/bash
# 快速测试脚本：验证 transcribe_audio.py 的基本功能

set -e

echo "=========================================="
echo "音频转文字脚本快速测试"
echo "=========================================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_pass() {
    echo -e "${GREEN}✓ $1${NC}"
}

test_fail() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

test_skip() {
    echo -e "${YELLOW}⊘ $1${NC}"
}

# 1. 检查脚本文件存在
echo -e "\n[1/7] 检查脚本文件..."
if [ -f "scripts/transcribe_audio.py" ]; then
    test_pass "脚本文件存在"
else
    test_fail "脚本文件不存在"
fi

# 2. 检查 Python 版本
echo -e "\n[2/7] 检查 Python 环境..."
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python 版本: $PYTHON_VERSION"
if python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)"; then
    test_pass "Python 版本符合要求 (>= 3.8)"
else
    test_fail "Python 版本过低，需要 >= 3.8"
fi

# 3. 检查帮助信息
echo -e "\n[3/7] 测试帮助信息..."
if python3 scripts/transcribe_audio.py --help > /dev/null 2>&1; then
    test_pass "帮助信息显示正常"
else
    test_fail "帮助信息显示失败"
fi

# 4. 检查依赖
echo -e "\n[4/7] 检查 faster-whisper 依赖..."
if python3 -c "import faster_whisper" 2>/dev/null; then
    test_pass "faster-whisper 已安装"
    
    # 显示版本
    VERSION=$(python3 -c "import faster_whisper; print(faster_whisper.__version__)" 2>/dev/null || echo "未知")
    echo "   版本: $VERSION"
else
    test_skip "faster-whisper 未安装（运行 pip install faster-whisper）"
    DEPS_MISSING=1
fi

# 5. 检查 ffmpeg
echo -e "\n[5/7] 检查 ffmpeg..."
if command -v ffmpeg &> /dev/null; then
    test_pass "ffmpeg 已安装"
    FFMPEG_VERSION=$(ffmpeg -version 2>&1 | head -n1)
    echo "   $FFMPEG_VERSION"
else
    test_skip "ffmpeg 未安装（某些音频格式可能无法处理）"
fi

# 6. 测试错误处理
echo -e "\n[6/7] 测试错误处理..."

# 测试文件不存在
OUTPUT=$(python3 scripts/transcribe_audio.py --audio nonexistent.mp3 2>&1 || true)
if echo "$OUTPUT" | grep -q '"error"'; then
    test_pass "文件不存在错误处理正常"
else
    test_fail "文件不存在错误处理失败"
fi

# 7. 功能测试（如果依赖齐全且有测试文件）
echo -e "\n[7/7] 功能测试..."

if [ -z "$DEPS_MISSING" ]; then
    # 创建一个 1 秒的静音测试文件（如果 ffmpeg 可用）
    if command -v ffmpeg &> /dev/null; then
        TEST_AUDIO="/tmp/test_audio_$(date +%s).mp3"
        
        echo "   创建测试音频文件..."
        ffmpeg -f lavfi -i "sine=frequency=1000:duration=1" -ac 1 -ar 16000 "$TEST_AUDIO" -y 2>/dev/null
        
        if [ -f "$TEST_AUDIO" ]; then
            echo "   运行转录测试（使用 tiny 模型）..."
            
            # 运行转录
            RESULT=$(python3 scripts/transcribe_audio.py \
                --audio "$TEST_AUDIO" \
                --model tiny \
                --device cpu 2>&1 || true)
            
            # 检查是否有 JSON 输出
            if echo "$RESULT" | python3 -c "import sys, json; json.loads(sys.stdin.read())" 2>/dev/null; then
                test_pass "转录功能测试通过"
                
                # 显示结果摘要
                TEXT=$(echo "$RESULT" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('text', 'N/A')[:50])" 2>/dev/null || echo "N/A")
                LANG=$(echo "$RESULT" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('language', 'N/A'))" 2>/dev/null || echo "N/A")
                echo "   检测语言: $LANG"
                echo "   文本片段: $TEXT..."
            else
                test_fail "转录功能测试失败"
                echo "$RESULT"
            fi
            
            # 清理测试文件
            rm -f "$TEST_AUDIO"
        else
            test_skip "无法创建测试音频文件"
        fi
    else
        test_skip "ffmpeg 不可用，跳过功能测试"
    fi
else
    test_skip "依赖缺失，跳过功能测试"
fi

# 总结
echo -e "\n=========================================="
echo "测试完成！"
echo "=========================================="

if [ -z "$DEPS_MISSING" ]; then
    echo -e "${GREEN}所有依赖已安装，脚本可以正常使用${NC}"
    echo ""
    echo "快速开始："
    echo "  python scripts/transcribe_audio.py --audio your_audio.mp3"
else
    echo -e "${YELLOW}部分依赖缺失，请先安装：${NC}"
    echo "  pip install faster-whisper"
    echo ""
    echo "可选（GPU 加速）："
    echo "  pip install torch"
fi

echo ""
echo "完整文档："
echo "  cat docs/transcribe-audio-usage.md"
echo "=========================================="
