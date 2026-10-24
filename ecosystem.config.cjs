module.exports = {
  apps: [
    {
      name: "casper-web",
      script: "server.js",
      cwd: "/var/www/casper-web",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "450M",
      env: {
        NODE_ENV: "production",
        PORT: 3005,
      },
    },
  ],
};
