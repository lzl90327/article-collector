#!/bin/bash
# 音频转文字演示脚本
# 展示常见使用场景

set -e

echo "=========================================="
echo "音频转文字脚本使用演示"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${YELLOW}请提供音频文件路径${NC}"
    echo ""
    echo "用法:"
    echo "  ./scripts/demo-transcribe.sh <audio-file>"
    echo ""
    echo "示例:"
    echo "  ./scripts/demo-transcribe.sh podcast.mp3"
    echo "  ./scripts/demo-transcribe.sh meeting.m4a"
    exit 1
fi

AUDIO_FILE="$1"

# 检查文件是否存在
if [ ! -f "$AUDIO_FILE" ]; then
    echo -e "${YELLOW}错误: 文件不存在: $AUDIO_FILE${NC}"
    exit 1
fi

# 检查依赖
echo -e "${BLUE}[1/5] 检查依赖...${NC}"
if ! python3 -c "import faster_whisper" 2>/dev/null; then
    echo -e "${YELLOW}警告: faster-whisper 未安装${NC}"
    echo "请运行: pip install faster-whisper"
    exit 1
fi
echo -e "${GREEN}✓ 依赖检查通过${NC}"
echo ""

# 获取音频信息
echo -e "${BLUE}[2/5] 音频文件信息${NC}"
FILE_SIZE=$(du -h "$AUDIO_FILE" | cut -f1)
echo "文件路径: $AUDIO_FILE"
echo "文件大小: $FILE_SIZE"

if command -v ffmpeg &> /dev/null; then
    DURATION=$(ffmpeg -i "$AUDIO_FILE" 2>&1 | grep "Duration" | awk '{print $2}' | tr -d ,)
    echo "音频时长: $DURATION"
fi
echo ""

# 场景 1: 快速预览（使用 tiny 模型）
echo -e "${BLUE}[3/5] 场景 1: 快速预览（tiny 模型）${NC}"
echo "适用场景: 快速了解音频内容"
echo ""
echo "命令: python scripts/transcribe_audio.py --audio \"$AUDIO_FILE\" --model tiny"
echo ""
read -p "是否运行此场景？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    OUTPUT_FILE="${AUDIO_FILE%.*}_preview.json"
    python3 scripts/transcribe_audio.py \
        --audio "$AUDIO_FILE" \
        --model tiny \
        --output "$OUTPUT_FILE"
    
    echo ""
    echo -e "${GREEN}✓ 预览完成，结果已保存到: $OUTPUT_FILE${NC}"
    
    # 显示摘要
    if [ -f "$OUTPUT_FILE" ]; then
        LANG=$(python3 -c "import json; print(json.load(open('$OUTPUT_FILE'))['language'])" 2>/dev/null || echo "未知")
        TEXT_LEN=$(python3 -c "import json; print(len(json.load(open('$OUTPUT_FILE'))['text']))" 2>/dev/null || echo "0")
        echo "检测语言: $LANG"
        echo "文本长度: $TEXT_LEN 字符"
    fi
fi
echo ""

# 场景 2: 高质量转录（使用 medium 模型）
echo -e "${BLUE}[4/5] 场景 2: 高质量转录（medium 模型）${NC}"
echo "适用场景: 播客、采访、会议记录"
echo ""
echo "命令: python scripts/transcribe_audio.py --audio \"$AUDIO_FILE\" --model medium --language zh --timestamps"
echo ""
read -p "是否运行此场景？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    OUTPUT_FILE="${AUDIO_FILE%.*}_transcript.json"
    python3 scripts/transcribe_audio.py \
        --audio "$AUDIO_FILE" \
        --model medium \
        --language zh \
        --timestamps \
        --output "$OUTPUT_FILE"
    
    echo ""
    echo -e "${GREEN}✓ 转录完成，结果已保存到: $OUTPUT_FILE${NC}"
    
    # 显示详细信息
    if [ -f "$OUTPUT_FILE" ]; then
        echo ""
        echo "转录结果摘要:"
        python3 -c "
import json
with open('$OUTPUT_FILE') as f:
    data = json.load(f)
    print(f\"  语言: {data['language']} (置信度: {data['language_probability']:.2%})\")
    print(f\"  音频时长: {data['duration']:.1f} 秒\")
    print(f\"  转录耗时: {data['metadata']['transcribe_time']:.1f} 秒\")
    print(f\"  实时率: {data['metadata']['realtime_factor']:.1f}x\")
    print(f\"  片段数量: {data['metadata']['segments_count']}\")
    print(f\"  文本长度: {len(data['text'])} 字符\")
    print()
    print(f\"前 100 字符: {data['text'][:100]}...\")
" 2>/dev/null || echo "无法解析结果"
    fi
fi
echo ""

# 场景 3: 专业级转录（使用 large-v3 模型）
echo -e "${BLUE}[5/5] 场景 3: 专业级转录（large-v3 模型）${NC}"
echo "适用场景: 正式文档、字幕制作、专业用途"
echo -e "${YELLOW}注意: 此模型较大（约 3GB），转录速度较慢${NC}"
echo ""
echo "命令: python scripts/transcribe_audio.py --audio \"$AUDIO_FILE\" --model large-v3 --timestamps"
echo ""
read -p "是否运行此场景？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    OUTPUT_FILE="${AUDIO_FILE%.*}_professional.json"
    python3 scripts/transcribe_audio.py \
        --audio "$AUDIO_FILE" \
        --model large-v3 \
        --timestamps \
        --output "$OUTPUT_FILE"
    
    echo ""
    echo -e "${GREEN}✓ 专业级转录完成，结果已保存到: $OUTPUT_FILE${NC}"
fi
echo ""

# 总结
echo "=========================================="
echo "演示完成！"
echo "=========================================="
echo ""
echo "生成的文件:"
ls -lh "${AUDIO_FILE%.*}"*.json 2>/dev/null || echo "无文件生成"
echo ""
echo "更多使用方法："
echo "  1. 查看帮助: python scripts/transcribe_audio.py --help"
echo "  2. 阅读文档: cat docs/transcribe-audio-usage.md"
echo "  3. 运行测试: ./scripts/test-transcribe.sh"
echo ""
echo "模型对比:"
echo "  tiny    - 最快，准确度较低，适合快速预览"
echo "  base    - 很快，准确度一般，适合日常使用"
echo "  small   - 快速，准确度良好，平衡选择"
echo "  medium  - 中等，准确度很好，推荐使用"
echo "  large-v3 - 最慢，准确度最高，专业用途"
echo ""
echo "性能提示:"
echo "  - 使用 GPU 可提升 10-20 倍速度"
echo "  - 指定语言可提高准确度和速度"
echo "  - 音频质量越好，转录越准确"
echo "=========================================="
