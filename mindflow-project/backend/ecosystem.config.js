module.exports = {
  apps: [
    {
      name: 'mindflow-backend',
      script: 'src/server.ts',
      interpreter: 'tsx',
      instances: 1,
      autorestart: true,
      watch: true,
      ignore_watch: ['node_modules', 'logs', '.git'],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 自动重启配置
      min_uptime: '10s',
      max_restarts: 10,
      // 崩溃后重启延迟
      restart_delay: 3000,
      // 监听文件变化时重启的延迟
      watch_delay: 1000
    }
  ]
};
