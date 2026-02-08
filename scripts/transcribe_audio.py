#!/usr/bin/env python3
"""
音频转文字工具 v1.0
基于 faster-whisper 的高性能音频转录脚本

功能特性：
- 使用 faster-whisper 库进行快速转录
- 支持自动语言检测
- int8 量化优化性能
- 自动检测 CPU/CUDA 设备
- 输出详细时间戳
- 实时进度反馈

使用示例：
    python scripts/transcribe_audio.py --audio input.mp3
    python scripts/transcribe_audio.py --audio input.mp3 --model medium --language zh
    python scripts/transcribe_audio.py --audio input.mp3 --timestamps
"""

import argparse
import json
import sys
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
import traceback


def check_dependencies():
    """检查必需的依赖是否已安装"""
    try:
        import faster_whisper
        return True
    except ImportError:
        print(json.dumps({
            "error": "依赖缺失",
            "message": "请先安装 faster-whisper: pip install faster-whisper",
            "details": "如需 CUDA 加速，请参考官方文档安装对应版本"
        }, ensure_ascii=False), file=sys.stdout)
        return False


def detect_device() -> str:
    """
    检测可用的计算设备
    返回: 'cuda' 或 'cpu'
    """
    try:
        import torch
        if torch.cuda.is_available():
            device = 'cuda'
            gpu_name = torch.cuda.get_device_name(0)
            print(f"检测到 CUDA 设备: {gpu_name}", file=sys.stderr)
        else:
            device = 'cpu'
            print("未检测到 CUDA，使用 CPU", file=sys.stderr)
    except ImportError:
        device = 'cpu'
        print("PyTorch 未安装，使用 CPU", file=sys.stderr)
    
    return device


def format_timestamp(seconds: float) -> str:
    """
    将秒数格式化为 HH:MM:SS.mmm
    
    Args:
        seconds: 秒数（支持小数）
    
    Returns:
        格式化的时间字符串
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


def transcribe_audio(
    audio_path: str,
    model_name: str = "large-v3",
    language: Optional[str] = None,
    device: Optional[str] = None,
    compute_type: str = "int8",
    include_timestamps: bool = False
) -> Dict[str, Any]:
    """
    使用 faster-whisper 转录音频文件
    
    Args:
        audio_path: 音频文件路径
        model_name: Whisper 模型名称 (tiny, base, small, medium, large-v2, large-v3)
        language: 语言代码 (如 'zh', 'en')，None 表示自动检测
        device: 计算设备 ('cuda' 或 'cpu')，None 表示自动检测
        compute_type: 计算类型 ('int8', 'float16', 'float32')
        include_timestamps: 是否包含详细时间戳
    
    Returns:
        包含转录结果的字典
    """
    from faster_whisper import WhisperModel
    
    # 检查文件是否存在
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"音频文件不存在: {audio_path}")
    
    # 检查文件大小
    file_size = os.path.getsize(audio_path)
    print(f"音频文件大小: {file_size / 1024 / 1024:.2f} MB", file=sys.stderr)
    
    if file_size == 0:
        raise ValueError("音频文件为空")
    
    # 自动检测设备
    if device is None:
        device = detect_device()
    
    # 根据设备调整计算类型
    if device == 'cpu' and compute_type == 'float16':
        print("CPU 不支持 float16，切换到 int8", file=sys.stderr)
        compute_type = 'int8'
    
    # 加载模型
    print(f"正在加载 Whisper 模型: {model_name} ({compute_type})", file=sys.stderr)
    start_time = datetime.now()
    
    try:
        model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            # 性能优化参数
            cpu_threads=4 if device == 'cpu' else None,
            num_workers=1,
        )
        
        load_time = (datetime.now() - start_time).total_seconds()
        print(f"模型加载完成，耗时: {load_time:.2f}s", file=sys.stderr)
    except Exception as e:
        raise RuntimeError(f"模型加载失败: {str(e)}")
    
    # 转录参数
    transcribe_params = {
        'beam_size': 5,  # 束搜索大小，平衡质量和速度
        'best_of': 5,    # 采样最佳候选数
        'temperature': 0.0,  # 温度为 0 使用贪婪解码（更快更稳定）
        'vad_filter': True,  # 启用语音活动检测（去除静音）
        'vad_parameters': {
            'threshold': 0.5,
            'min_speech_duration_ms': 250,
            'min_silence_duration_ms': 2000,
        },
    }
    
    # 如果指定了语言，添加到参数中
    if language and language.lower() != 'auto':
        transcribe_params['language'] = language
        print(f"使用指定语言: {language}", file=sys.stderr)
    else:
        print("自动检测语言", file=sys.stderr)
    
    # 开始转录
    print(f"开始转录音频: {audio_path}", file=sys.stderr)
    transcribe_start = datetime.now()
    
    try:
        segments, info = model.transcribe(audio_path, **transcribe_params)
        
        # 处理转录结果
        print(f"检测到语言: {info.language} (置信度: {info.language_probability:.2f})", file=sys.stderr)
        
        # 收集所有片段
        all_segments = []
        full_text_parts = []
        total_duration = 0
        
        for i, segment in enumerate(segments, 1):
            segment_text = segment.text.strip()
            
            # 构建片段信息
            segment_info = {
                'start': round(segment.start, 3),
                'end': round(segment.end, 3),
                'text': segment_text,
            }
            
            # 如果需要详细时间戳，添加额外信息
            if include_timestamps:
                segment_info['duration'] = round(segment.end - segment.start, 3)
                segment_info['words'] = getattr(segment, 'words', None)
            
            all_segments.append(segment_info)
            full_text_parts.append(segment_text)
            
            total_duration = max(total_duration, segment.end)
            
            # 输出进度
            if i % 10 == 0:
                elapsed = (datetime.now() - transcribe_start).total_seconds()
                progress = (segment.end / total_duration * 100) if total_duration > 0 else 0
                print(f"进度: {i} 个片段 | {format_timestamp(segment.end)} | {elapsed:.1f}s", file=sys.stderr)
        
        transcribe_time = (datetime.now() - transcribe_start).total_seconds()
        
        # 组装完整文本
        full_text = ' '.join(full_text_parts)
        
        # 输出统计信息
        print("\n" + "="*50, file=sys.stderr)
        print(f"转录完成！", file=sys.stderr)
        print(f"音频时长: {format_timestamp(total_duration)}", file=sys.stderr)
        print(f"转录耗时: {transcribe_time:.2f}s", file=sys.stderr)
        print(f"实时率: {total_duration / transcribe_time:.2f}x", file=sys.stderr)
        print(f"片段数量: {len(all_segments)}", file=sys.stderr)
        print(f"文本长度: {len(full_text)} 字符", file=sys.stderr)
        print("="*50, file=sys.stderr)
        
        # 返回结果
        result = {
            'text': full_text,
            'segments': all_segments,
            'language': info.language,
            'language_probability': round(info.language_probability, 4),
            'duration': round(total_duration, 3),
            'metadata': {
                'model': model_name,
                'device': device,
                'compute_type': compute_type,
                'transcribe_time': round(transcribe_time, 2),
                'realtime_factor': round(total_duration / transcribe_time, 2),
                'segments_count': len(all_segments),
            }
        }
        
        return result
        
    except Exception as e:
        raise RuntimeError(f"转录过程出错: {str(e)}")


def main():
    """主函数：解析命令行参数并执行转录"""
    parser = argparse.ArgumentParser(
        description='使用 faster-whisper 进行音频转文字',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 基础使用（自动检测语言）
  python transcribe_audio.py --audio input.mp3
  
  # 指定模型和语言
  python transcribe_audio.py --audio input.mp3 --model medium --language zh
  
  # 包含详细时间戳
  python transcribe_audio.py --audio input.mp3 --timestamps
  
  # 使用 CPU（即使有 GPU）
  python transcribe_audio.py --audio input.mp3 --device cpu

可用模型: tiny, base, small, medium, large-v2, large-v3
常见语言: zh (中文), en (英语), ja (日语), ko (韩语)
        """
    )
    
    parser.add_argument(
        '--audio',
        type=str,
        required=True,
        help='音频文件路径（必需）'
    )
    
    parser.add_argument(
        '--model',
        type=str,
        default='large-v3',
        choices=['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3'],
        help='Whisper 模型名称（默认: large-v3）'
    )
    
    parser.add_argument(
        '--language',
        type=str,
        default='auto',
        help='语言代码，如 zh, en, ja（默认: auto 自动检测）'
    )
    
    parser.add_argument(
        '--device',
        type=str,
        choices=['cpu', 'cuda'],
        default=None,
        help='计算设备（默认: 自动检测）'
    )
    
    parser.add_argument(
        '--compute-type',
        type=str,
        choices=['int8', 'float16', 'float32'],
        default='int8',
        help='计算精度类型（默认: int8，性能最优）'
    )
    
    parser.add_argument(
        '--timestamps',
        action='store_true',
        help='输出详细的时间戳信息'
    )
    
    parser.add_argument(
        '--output',
        type=str,
        help='输出 JSON 文件路径（可选，默认输出到 stdout）'
    )
    
    args = parser.parse_args()
    
    # 检查依赖
    if not check_dependencies():
        sys.exit(1)
    
    try:
        # 执行转录
        result = transcribe_audio(
            audio_path=args.audio,
            model_name=args.model,
            language=args.language if args.language != 'auto' else None,
            device=args.device,
            compute_type=args.compute_type,
            include_timestamps=args.timestamps
        )
        
        # 输出结果
        json_output = json.dumps(result, ensure_ascii=False, indent=2)
        
        if args.output:
            # 保存到文件
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(json_output)
            print(f"\n结果已保存到: {args.output}", file=sys.stderr)
        else:
            # 输出到 stdout
            print(json_output, file=sys.stdout)
        
    except FileNotFoundError as e:
        error_result = {
            "error": "文件不存在",
            "message": str(e),
        }
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stdout)
        sys.exit(1)
        
    except ValueError as e:
        error_result = {
            "error": "参数错误",
            "message": str(e),
        }
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stdout)
        sys.exit(1)
        
    except RuntimeError as e:
        error_result = {
            "error": "运行时错误",
            "message": str(e),
        }
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stdout)
        sys.exit(1)
        
    except KeyboardInterrupt:
        print("\n\n用户中断操作", file=sys.stderr)
        error_result = {
            "error": "用户中断",
            "message": "转录被用户中断"
        }
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stdout)
        sys.exit(130)
        
    except Exception as e:
        error_result = {
            "error": "未知错误",
            "message": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stdout)
        sys.exit(1)


if __name__ == "__main__":
    main()
