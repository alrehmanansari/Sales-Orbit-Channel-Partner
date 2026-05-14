module.exports = {
  apps: [{
    name: 'sales-orbit-api',
    script: 'src/app.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3002
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 5000
  }]
};
