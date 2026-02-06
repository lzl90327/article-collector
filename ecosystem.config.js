/**
 * PM2 Ecosystem 配置文件
 * 管理 article-collector 的多环境部署
 * 
 * 使用方法：
 *   pm2 start ecosystem.config.js --only article-collector      # 启动生产环境
 *   pm2 start ecosystem.config.js --only article-collector-dev  # 启动测试环境
 *   pm2 start ecosystem.config.js                               # 启动所有服务
 *   pm2 reload ecosystem.config.js --only article-collector     # 重载生产环境
 *   pm2 stop ecosystem.config.js                                # 停止所有
 */

module.exports = {
  apps: [
    // ========================================
    // 生产环境 - 正式服务
    // ========================================
    {
      name: 'article-collector',
      script: 'dist/index.js',
      cwd: '/Users/lizuolin_cloud/article-collector',
      
      // 环境变量
      env: {
        NODE_ENV: 'production',
      },
      
      // 进程管理
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/Users/lizuolin_cloud/.pm2/logs/article-collector-error.log',
      out_file: '/Users/lizuolin_cloud/.pm2/logs/article-collector-out.log',
      merge_logs: true,
      
      // 重启策略
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 1000,
    },
    
    // ========================================
    // 测试环境 - 开发测试
    // ========================================
    {
      name: 'article-collector-dev',
      script: 'dist/index.js',
      cwd: '/Users/lizuolin_cloud/article-collector',
      
      // 环境变量
      env: {
        NODE_ENV: 'development',
      },
      
      // 进程管理
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/Users/lizuolin_cloud/.pm2/logs/article-collector-dev-error.log',
      out_file: '/Users/lizuolin_cloud/.pm2/logs/article-collector-dev-out.log',
      merge_logs: true,
      
      // 重启策略
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 1000,
    },
    
    // ========================================
    // XHS-Downloader API 服务
    // ========================================
    {
      name: 'xhs-downloader',
      script: '/Users/lizuolin_cloud/start-xhs-api.sh',
      cwd: '/Users/lizuolin_cloud/XHS-Downloader',
      interpreter: 'bash',
      
      // 进程管理
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/Users/lizuolin_cloud/.pm2/logs/xhs-downloader-error.log',
      out_file: '/Users/lizuolin_cloud/.pm2/logs/xhs-downloader-out.log',
      merge_logs: true,
      
      // 重启策略
      max_restarts: 5,
      restart_delay: 2000,
    },
    
    // ========================================
    // Knowledge Refinery Worker - 知识提炼服务
    // ========================================
    {
      name: 'knowledge-refinery',
      script: 'dist/refinery/worker.js',
      cwd: '/Users/lizuolin_cloud/article-collector',
      
      // 环境变量
      env: {
        NODE_ENV: 'production',
        PATH: '/Users/lizuolin_cloud/redis/bin:' + process.env.PATH,
      },
      
      // 进程管理
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/Users/lizuolin_cloud/.pm2/logs/knowledge-refinery-error.log',
      out_file: '/Users/lizuolin_cloud/.pm2/logs/knowledge-refinery-out.log',
      merge_logs: true,
      
      // 重启策略
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
