module.exports = {
  apps: [
    {
      name: 'vxin-server',
      script: 'src/app.js',
      cwd: __dirname,
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_memory_restart: '1G',
    },
    {
      name: 'vxin-test-loop',
      script: '../tests/loop.js',
      cwd: __dirname,
      autorestart: false,
      watch: false,
      env: { NODE_ENV: 'test' },
      out_file: '../tests/test-reports/loop-stdout.log',
      error_file: '../tests/test-reports/loop-stderr.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'vxin-acceptance-loop24',
      script: '../tests/acceptance.js',
      args: '--loop24',
      cwd: __dirname,
      autorestart: false,
      watch: false,
      env: { NODE_ENV: 'test' },
      out_file: '../tests/test-reports/loop24-stdout.log',
      error_file: '../tests/test-reports/loop24-stderr.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],

  deploy: {},
};
