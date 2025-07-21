module.exports = {
  apps: [
    {
      name: 'go-backend',
      cwd: './backend',
      script: 'sh',
      args: '-c "go run main.go"',
      interpreter: '/bin/bash',
    },
    {
      name: 'vite-frontend',
      cwd: './frontend',
      script: 'sh',
      args: '-c "npm run build && npx serve dist"',
      interpreter: '/bin/bash',
    },
  ],
};
