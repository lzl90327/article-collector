#!/bin/bash

##############################################################################
# Crontab 配置助手
# 
# 功能: 快速配置文件清理定时任务
# 使用: ./scripts/setup-crontab.sh
##############################################################################

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "  Crontab 定时清理任务配置助手"
echo "=========================================="
echo ""

# 检查清理脚本
if [ ! -f "$PROJECT_ROOT/scripts/cleanup-old-files.sh" ]; then
    echo -e "${RED}[错误]${NC} 清理脚本不存在: $PROJECT_ROOT/scripts/cleanup-old-files.sh"
    exit 1
fi

# 确保脚本有执行权限
chmod +x "$PROJECT_ROOT/scripts/cleanup-old-files.sh"

# 创建日志目录
mkdir -p "$PROJECT_ROOT/logs"

echo -e "${BLUE}[信息]${NC} 项目路径: $PROJECT_ROOT"
echo -e "${BLUE}[信息]${NC} 日志目录: $PROJECT_ROOT/logs"
echo ""

# 选择清理频率
echo "请选择清理频率："
echo ""
echo "  1) 每天凌晨 2 点清理（推荐，适合中频使用）"
echo "  2) 每周日凌晨 2 点清理（适合低频使用）"
echo "  3) 每 12 小时清理一次（适合高频使用）"
echo "  4) 自定义时间"
echo "  5) 查看当前 Crontab 配置"
echo "  6) 删除所有清理任务"
echo ""
read -p "请输入选项 [1-6]: " choice

case $choice in
    1)
        CRON_SCHEDULE="0 2 * * *"
        DESCRIPTION="每天凌晨 2 点"
        ;;
    2)
        CRON_SCHEDULE="0 2 * * 0"
        DESCRIPTION="每周日凌晨 2 点"
        ;;
    3)
        CRON_SCHEDULE="0 */12 * * *"
        DESCRIPTION="每 12 小时"
        ;;
    4)
        echo ""
        echo "Crontab 时间格式: 分钟(0-59) 小时(0-23) 日期(1-31) 月份(1-12) 星期(0-6)"
        echo "示例: 0 3 * * * (每天凌晨 3 点)"
        echo ""
        read -p "请输入 Crontab 时间表达式: " CRON_SCHEDULE
        DESCRIPTION="自定义时间"
        ;;
    5)
        echo ""
        echo -e "${BLUE}[信息]${NC} 当前 Crontab 配置："
        echo ""
        crontab -l 2>/dev/null || echo "（无配置）"
        echo ""
        exit 0
        ;;
    6)
        echo ""
        echo -e "${YELLOW}[警告]${NC} 将删除所有包含 'cleanup-old-files.sh' 的 Crontab 任务"
        read -p "确认删除？(y/N): " confirm
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            crontab -l 2>/dev/null | grep -v "cleanup-old-files.sh" | crontab - 2>/dev/null || true
            echo -e "${GREEN}[完成]${NC} 清理任务已删除"
        else
            echo "取消操作"
        fi
        exit 0
        ;;
    *)
        echo -e "${RED}[错误]${NC} 无效选项"
        exit 1
        ;;
esac

# 构建 Crontab 命令
CRON_COMMAND="cd $PROJECT_ROOT && ./scripts/cleanup-old-files.sh >> logs/cleanup.log 2>&1"
CRON_LINE="$CRON_SCHEDULE $CRON_COMMAND"

echo ""
echo -e "${BLUE}[信息]${NC} 将添加以下定时任务："
echo ""
echo "  时间: $DESCRIPTION"
echo "  命令: $CRON_COMMAND"
echo ""

read -p "确认添加？(y/N): " confirm

if [[ $confirm != "y" && $confirm != "Y" ]]; then
    echo "取消操作"
    exit 0
fi

# 获取现有的 Crontab（如果有）
CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)

# 检查是否已存在相同的任务
if echo "$CURRENT_CRONTAB" | grep -q "cleanup-old-files.sh"; then
    echo ""
    echo -e "${YELLOW}[警告]${NC} 已存在清理任务，将替换为新配置"
    # 删除旧的清理任务
    NEW_CRONTAB=$(echo "$CURRENT_CRONTAB" | grep -v "cleanup-old-files.sh")
else
    NEW_CRONTAB="$CURRENT_CRONTAB"
fi

# 添加新任务
if [ -n "$NEW_CRONTAB" ]; then
    echo "$NEW_CRONTAB
$CRON_LINE" | crontab -
else
    echo "$CRON_LINE" | crontab -
fi

echo ""
echo -e "${GREEN}[完成]${NC} Crontab 定时任务配置成功！"
echo ""
echo "任务详情："
echo "  ✅ 清理频率: $DESCRIPTION"
echo "  ✅ 清理目标: 30 天以上的临时文件"
echo "  ✅ 日志位置: $PROJECT_ROOT/logs/cleanup.log"
echo ""

# 测试脚本
echo -e "${BLUE}[提示]${NC} 是否立即测试清理脚本？(y/N): "
read -p "" test_now

if [[ $test_now == "y" || $test_now == "Y" ]]; then
    echo ""
    echo "执行清理脚本..."
    echo ""
    "$PROJECT_ROOT/scripts/cleanup-old-files.sh"
fi

echo ""
echo "=========================================="
echo "  配置完成"
echo "=========================================="
echo ""
echo "查看 Crontab 配置:"
echo "  $ crontab -l"
echo ""
echo "查看清理日志:"
echo "  $ tail -f $PROJECT_ROOT/logs/cleanup.log"
echo ""
echo "手动执行清理:"
echo "  $ $PROJECT_ROOT/scripts/cleanup-old-files.sh"
echo ""
