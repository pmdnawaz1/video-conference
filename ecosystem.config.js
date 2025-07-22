module.exports = {
  apps: [
    {
      name: 'go-backend',
      cwd: './backend',
      script: 'go',
      args: 'run main.go',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'vite-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development'
      }
    },
  ],
};
