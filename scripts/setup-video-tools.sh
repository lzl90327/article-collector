#!/bin/bash

# 设置颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 开始检查和安装 Bilibili 视频转录所需环境 ===${NC}"

# 1. 检查 ffmpeg
echo -e "\n${YELLOW}[1/3] 检查 FFmpeg...${NC}"
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    echo -e "${GREEN}✅ FFmpeg 已安装: $FFMPEG_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️ FFmpeg 未找到，尝试安装...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install ffmpeg
        else
            echo -e "${RED}❌ 未安装 Homebrew，请手动安装 ffmpeg: https://ffmpeg.org/download.html${NC}"
            exit 1
        fi
    elif [[ -f /etc/debian_version ]]; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    elif [[ -f /etc/redhat-release ]]; then
        sudo yum install -y ffmpeg
    else
        echo -e "${RED}❌ 无法自动安装 FFmpeg，请手动安装。${NC}"
        exit 1
    fi
fi

# 2. 检查 Python 环境
echo -e "\n${YELLOW}[2/3] 检查 Python 环境...${NC}"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ Python 已安装: $PYTHON_VERSION${NC}"
else
    echo -e "${RED}❌ Python3 未找到，请安装 Python 3.8+${NC}"
    exit 1
fi

# 3. 安装 Python 依赖 (faster-whisper)
echo -e "\n${YELLOW}[3/3] 安装 faster-whisper...${NC}"

# 检查 pip
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip3 未找到，请安装 pip${NC}"
    exit 1
fi

# 创建虚拟环境（可选，但推荐）
# if [ ! -d "venv" ]; then
#     echo "创建 Python 虚拟环境..."
#     python3 -m venv venv
# fi
# source venv/bin/activate

# 安装依赖
echo "正在安装 faster-whisper..."
pip3 install faster-whisper yt-dlp --user

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ faster-whisper 安装成功${NC}"
else
    echo -e "${RED}❌ faster-whisper 安装失败${NC}"
    exit 1
fi

# 4. 验证环境
echo -e "\n${YELLOW}[4/4] 验证环境...${NC}"
python3 -c "import faster_whisper; print('✅ faster-whisper 模块加载成功')"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}=== 环境准备完成！ ===${NC}"
else
    echo -e "${RED}❌ 环境验证失败${NC}"
    exit 1
fi
