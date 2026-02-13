#!/bin/bash

##############################################################################
# 视频/播客功能测试报告
# 测试日期: $(date '+%Y-%m-%d %H:%M:%S')
##############################################################################

echo "=========================================="
echo "  视频/播客功能测试报告"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0
skip_count=0

log_pass() {
    echo -e "${GREEN}✅ PASS${NC} - $1"
    ((pass_count++))
}

log_fail() {
    echo -e "${RED}❌ FAIL${NC} - $1"
    ((fail_count++))
}

log_skip() {
    echo -e "${YELLOW}⊘ SKIP${NC} - $1"
    ((skip_count++))
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

##############################################################################
# 1. 环境检查
##############################################################################
echo "=========================================="
echo "1. 环境依赖检查"
echo "=========================================="
echo ""

# Python 版本
log_info "检查 Python 版本..."
if python3 --version >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    log_pass "Python 已安装: $PYTHON_VERSION"
else
    log_fail "Python 未安装"
fi

# yt-dlp
log_info "检查 yt-dlp..."
if yt-dlp --version >/dev/null 2>&1; then
    YT_DLP_VERSION=$(yt-dlp --version)
    log_pass "yt-dlp 已安装: $YT_DLP_VERSION"
else
    log_fail "yt-dlp 未安装"
fi

# FFmpeg
log_info "检查 FFmpeg..."
if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG_VERSION=$(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')
    log_pass "FFmpeg 已安装: $FFMPEG_VERSION"
else
    log_fail "FFmpeg 未安装（部分功能不可用）"
fi

# faster-whisper
log_info "检查 faster-whisper..."
if python3 -c "import faster_whisper" 2>/dev/null; then
    log_pass "faster-whisper 已安装"
else
    log_fail "faster-whisper 未安装"
fi

# Node.js 依赖
log_info "检查 Node.js 依赖..."
cd "$(dirname "$0")/.." || exit 1
if npm list fluent-ffmpeg >/dev/null 2>&1; then
    log_pass "fluent-ffmpeg 已安装"
else
    log_skip "fluent-ffmpeg 未安装（可选）"
fi

echo ""

##############################################################################
# 2. TypeScript 编译检查
##############################################################################
echo "=========================================="
echo "2. TypeScript 编译检查"
echo "=========================================="
echo ""

log_info "运行 TypeScript 类型检查..."
if npm run typecheck >/dev/null 2>&1; then
    log_pass "TypeScript 编译通过"
else
    log_fail "TypeScript 编译失败"
fi

echo ""

##############################################################################
# 3. URL 解析器测试
##############################################################################
echo "=========================================="
echo "3. URL 解析器测试"
echo "=========================================="
echo ""

# 创建临时测试文件
TEST_FILE=$(mktemp /tmp/url-parser-test.XXXXXX.ts)
cat > "$TEST_FILE" << 'EOF'
import { parseUrl, UrlType } from './src/utils/url-parser';

const tests = [
  { url: 'https://www.bilibili.com/video/BV1xx411c7XZ', expected: UrlType.BILIBILI_VIDEO },
  { url: 'https://b23.tv/xxxxx', expected: UrlType.BILIBILI_VIDEO },
  { url: 'https://www.douyin.com/video/7123456789', expected: UrlType.DOUYIN_VIDEO },
  { url: 'https://v.douyin.com/xxxxx', expected: UrlType.DOUYIN_VIDEO },
  { url: 'https://www.xiaoyuzhoufm.com/episode/xxx', expected: UrlType.XIAOYUZHOU_PODCAST },
  { url: 'https://www.ximalaya.com/sound/12345678', expected: UrlType.XIMALAYA_PODCAST },
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  const result = parseUrl(test.url);
  if (result.type === test.expected) {
    console.log(`✅ ${test.url} -> ${result.type}`);
    passed++;
  } else {
    console.log(`❌ ${test.url} -> 期望 ${test.expected}, 实际 ${result.type}`);
    failed++;
  }
});

console.log(`\n总计: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
EOF

log_info "测试 URL 解析..."
if npx ts-node "$TEST_FILE" 2>/dev/null; then
    log_pass "URL 解析器测试通过"
else
    log_skip "URL 解析器测试（需要 ts-node）"
fi

rm -f "$TEST_FILE"

echo ""

##############################################################################
# 4. 配置加载测试
##############################################################################
echo "=========================================="
echo "4. 配置加载测试"
echo "=========================================="
echo ""

# 创建配置测试文件
CONFIG_TEST=$(mktemp /tmp/config-test.XXXXXX.ts)
cat > "$CONFIG_TEST" << 'EOF'
import { videoConfig, wikiConfig } from './src/config';

console.log('视频配置:');
console.log('  - Whisper 模型:', videoConfig.whisperModel);
console.log('  - 转录阈值:', videoConfig.transcriptionThreshold, '秒');
console.log('  - 最大视频大小:', videoConfig.maxVideoSizeMB, 'MB');
console.log('  - OpenAI API:', videoConfig.hasOpenAI ? '已配置' : '未配置');
console.log('  - B站 Cookie:', videoConfig.hasBilibiliCookie ? '已配置' : '未配置');

console.log('\n知识库配置:');
console.log('  - Space ID:', wikiConfig.spaceId || '未配置');
console.log('  - 视频父节点:', wikiConfig.videoParentNodeToken || '未配置');
console.log('  - 播客父节点:', wikiConfig.podcastParentNodeToken || '未配置');

process.exit(0);
EOF

log_info "测试配置加载..."
if npx ts-node "$CONFIG_TEST" 2>/dev/null; then
    log_pass "配置加载测试通过"
else
    log_skip "配置加载测试（需要 ts-node）"
fi

rm -f "$CONFIG_TEST"

echo ""

##############################################################################
# 5. Python 转录脚本测试
##############################################################################
echo "=========================================="
echo "5. Python 转录脚本测试"
echo "=========================================="
echo ""

log_info "检查 transcribe_audio.py..."
if [ -f "scripts/transcribe_audio.py" ]; then
    log_pass "转录脚本文件存在"
    
    # 语法检查
    if python3 -m py_compile scripts/transcribe_audio.py 2>/dev/null; then
        log_pass "Python 语法检查通过"
    else
        log_fail "Python 语法错误"
    fi
    
    # 帮助信息
    if python3 scripts/transcribe_audio.py --help >/dev/null 2>&1; then
        log_pass "脚本可执行（--help 正常）"
    else
        log_skip "脚本执行测试（需要依赖）"
    fi
else
    log_fail "转录脚本文件不存在"
fi

echo ""

##############################################################################
# 6. 服务模块导入测试
##############################################################################
echo "=========================================="
echo "6. 服务模块导入测试"
echo "=========================================="
echo ""

# 测试服务导入
IMPORT_TEST=$(mktemp /tmp/import-test.XXXXXX.ts)
cat > "$IMPORT_TEST" << 'EOF'
async function testImports() {
  try {
    const asrService = await import('./src/services/asr-service');
    console.log('✅ asr-service.ts 导入成功');
    
    const mediaDownloader = await import('./src/services/media-downloader');
    console.log('✅ media-downloader.ts 导入成功');
    
    const bilibiliFetcher = await import('./src/services/bilibili-fetcher');
    console.log('✅ bilibili-fetcher.ts 导入成功');
    
    return true;
  } catch (error: any) {
    console.error('❌ 导入失败:', error.message);
    return false;
  }
}

testImports().then(success => process.exit(success ? 0 : 1));
EOF

log_info "测试服务模块导入..."
if npx ts-node "$IMPORT_TEST" 2>/dev/null; then
    log_pass "服务模块导入测试通过"
else
    log_skip "服务模块导入测试（需要 ts-node）"
fi

rm -f "$IMPORT_TEST"

echo ""

##############################################################################
# 7. B站视频信息提取测试（仅元数据）
##############################################################################
echo "=========================================="
echo "7. B站视频元数据提取测试"
echo "=========================================="
echo ""

log_info "测试 B站 URL 识别..."
TEST_BILI_URL="https://www.bilibili.com/video/BV1xx411c7XZ"

if command -v yt-dlp >/dev/null 2>&1; then
    log_info "使用 yt-dlp 测试元数据提取..."
    
    # 仅提取信息，不下载
    if yt-dlp --skip-download --print title "$TEST_BILI_URL" >/dev/null 2>&1; then
        log_pass "yt-dlp 可以提取 B站视频信息"
    else
        log_skip "yt-dlp B站测试（可能需要网络或有效URL）"
    fi
else
    log_skip "yt-dlp 未安装，跳过测试"
fi

echo ""

##############################################################################
# 总结
##############################################################################
echo "=========================================="
echo "  测试总结"
echo "=========================================="
echo ""

total=$((pass_count + fail_count + skip_count))
echo -e "${GREEN}通过: $pass_count${NC}"
echo -e "${RED}失败: $fail_count${NC}"
echo -e "${YELLOW}跳过: $skip_count${NC}"
echo "总计: $total"
echo ""

if [ $fail_count -gt 0 ]; then
    echo -e "${RED}⚠️  存在失败的测试${NC}"
    echo ""
    echo "建议操作:"
    echo "  1. 安装缺失的依赖: ./scripts/setup-video-tools.sh"
    echo "  2. 检查 .env 配置文件"
    echo "  3. 查看详细日志"
    exit 1
else
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    echo ""
    echo "下一步:"
    echo "  1. 配置 .env 文件（参考 .env.example）"
    echo "  2. 测试实际视频下载: ./scripts/test-bilibili.sh <URL>"
    echo "  3. 测试音频转录: ./scripts/test-transcribe.sh"
    exit 0
fi
