module.exports = {
  apps: [
    {
      name: "casper-web",
      script: "npm",
      args: "start -- -p 3000",
      cwd: "/var/www/casper-web",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "450M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
