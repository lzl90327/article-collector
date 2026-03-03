---
name: video-downloader
description: "Download videos from various websites using yt-dlp. Use when the user wants to download a video from a URL, including YouTube, Bilibili, TikTok, and 1000+ supported sites. Trigger phrases: 'download this video', 'download video from link', 'save this video', or when a video URL is provided with a download request."
---

# Video Downloader

Download videos from various websites using yt-dlp.

## Quick Start

Use the provided script to download videos:

```bash
python scripts/download_video.py <视频链接>
```

## Usage Examples

### Basic Download
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=xxxxx"
```

### Specify Output Directory
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=xxxxx" -o ./downloads
```

### Specify Quality
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=xxxxx" -q 1080p
```

### Available Quality Options
- `best` - Best available quality (default)
- `1080p` - 1080p or lower
- `720p` - 720p or lower
- `480p` - 480p or lower
- `360p` - 360p or lower
- `worst` - Lowest quality

## Supported Sites

yt-dlp supports 1000+ sites including:
- YouTube
- Bilibili (B站)
- TikTok (抖音)
- Twitter/X
- Instagram
- Vimeo
- Dailymotion
- And many more...

## Prerequisites

The script will automatically install yt-dlp if not present. Manual installation:

```bash
pip install yt-dlp
```

## Advanced Usage

For advanced options (subtitles, audio-only, etc.), use yt-dlp directly:

```bash
# Download audio only
yt-dlp -x --audio-format mp3 <url>

# Download with subtitles
yt-dlp --write-subs --sub-langs zh-CN,en <url>

# List available formats
yt-dlp -F <url>
```

## Workflow

1. Extract video URL from user request
2. Determine output directory (ask user or use default)
3. Determine quality preference (ask user or use default 'best')
4. Run the download script
5. Report success/failure to user
