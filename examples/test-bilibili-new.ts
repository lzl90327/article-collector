
import dotenv from 'dotenv';
dotenv.config();

import { bilibiliService } from '../src/services/bilibili-service';
import { mediaDownloader } from '../src/services/media-downloader';
import path from 'path';
import fs from 'fs';

async function run() {
  const url = 'https://b23.tv/RGYPJN0';
  console.log(`Testing URL: ${url}`);
  
  try {
    // 1. Info
    const info = await bilibiliService.getVideoInfo(url);
    console.log('Info:', info.title);

    // 2. PlayUrl
    const streams = await bilibiliService.getPlayUrl(info.bvid, info.cid);
    console.log('Audio Streams:', streams.audio.length);
    console.log('Video Streams:', streams.video.length);

    // 3. Download Audio
    if (streams.audio.length > 0) {
      const audioUrl = streams.audio[0].url;
      const tempPath = path.join(process.cwd(), 'temp_audio.m4s');
      console.log('Downloading audio to:', tempPath);
      await bilibiliService.downloadStream(audioUrl, tempPath);
      
      // Convert
      const wavPath = path.join(process.cwd(), 'temp_audio.wav');
      console.log('Converting to:', wavPath);
      await mediaDownloader.convertMedia(tempPath, wavPath, { format: 'wav', audioOnly: true });
      
      // Check duration
      const duration = await mediaDownloader.getMediaInfo(wavPath);
      console.log('WAV Duration:', duration.duration);
      
      // Cleanup
      fs.unlinkSync(tempPath);
      fs.unlinkSync(wavPath);
    }

    // 4. Keyframes
    if (streams.video.length > 0) {
      // Pick lowest quality
      const videoStream = streams.video.sort((a, b) => a.quality - b.quality)[0];
      const tempVideo = path.join(process.cwd(), 'temp_video.m4s');
      console.log('Downloading video (low quality) to:', tempVideo);
      await bilibiliService.downloadStream(videoStream.url, tempVideo);
      
      console.log('Extracting keyframes...');
      const kfs = await mediaDownloader.extractKeyframes(tempVideo, 3);
      console.log('Keyframes:', kfs);
      
      // Cleanup
      fs.unlinkSync(tempVideo);
      kfs.forEach(k => fs.unlinkSync(k.path));
    }
    
    console.log('✅ Test Passed');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

run();
