#!/usr/bin/env python3
"""
视频下载脚本 - 使用 yt-dlp 下载视频
用法: python download_video.py <视频链接> [输出目录] [质量选项]
"""

import sys
import os
import subprocess
import argparse
from pathlib import Path


def check_yt_dlp():
    """检查 yt-dlp 是否已安装"""
    try:
        subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def install_yt_dlp():
    """安装 yt-dlp"""
    print("正在安装 yt-dlp...")
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-U', 'yt-dlp'], check=True)
        print("yt-dlp 安装成功！")
        return True
    except subprocess.CalledProcessError as e:
        print(f"安装失败: {e}")
        return False


def download_video(url, output_dir=None, quality='best'):
    """
    下载视频
    
    Args:
        url: 视频链接
        output_dir: 输出目录（默认为当前目录）
        quality: 视频质量 ('best', 'worst', 或格式代码如 'best[height<=1080]')
    """
    if not check_yt_dlp():
        print("yt-dlp 未安装，尝试自动安装...")
        if not install_yt_dlp():
            print("请手动安装 yt-dlp: pip install yt-dlp")
            return False
    
    # 设置输出目录
    if output_dir:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        output_template = str(output_path / '%(title)s.%(ext)s')
    else:
        output_template = '%(title)s.%(ext)s'
    
    # 构建命令
    cmd = [
        'yt-dlp',
        '-f', quality,
        '-o', output_template,
        '--no-warnings',
        '--progress',
        '--newline',
        url
    ]
    
    print(f"开始下载: {url}")
    print(f"输出目录: {output_dir or '当前目录'}")
    print(f"视频质量: {quality}")
    print("-" * 50)
    
    try:
        result = subprocess.run(cmd, capture_output=False, text=True)
        if result.returncode == 0:
            print("-" * 50)
            print("下载完成！")
            return True
        else:
            print("-" * 50)
            print("下载失败！")
            return False
    except Exception as e:
        print(f"下载出错: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='视频下载工具')
    parser.add_argument('url', help='视频链接')
    parser.add_argument('-o', '--output', help='输出目录', default=None)
    parser.add_argument('-q', '--quality', help='视频质量', default='best',
                        choices=['best', 'worst', '1080p', '720p', '480p', '360p'])
    
    args = parser.parse_args()
    
    # 转换质量选项为 yt-dlp 格式
    quality_map = {
        'best': 'best',
        'worst': 'worst',
        '1080p': 'best[height<=1080]',
        '720p': 'best[height<=720]',
        '480p': 'best[height<=480]',
        '360p': 'best[height<=360]'
    }
    
    quality = quality_map.get(args.quality, 'best')
    
    success = download_video(args.url, args.output, quality)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
