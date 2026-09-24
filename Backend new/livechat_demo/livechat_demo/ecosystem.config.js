module.exports = {
  apps: [{
    name: "livechat",
    script: "server.js",
    env: { NODE_ENV: "production", PORT: 3000 }
  }]
};
