// config.js 负责集中管理所有配置信息
// 1. 端口、数据库、语雀、邮箱、定时任务等配置都在这里统一设置
// 2. 支持从环境变量（.env 文件）读取配置，方便本地和服务器部署

module.exports = {
  // 服务器端口配置
  port: process.env.PORT || 3000,
  
  // 数据库连接配置
  database: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/yuque_pusher'
  },
  
  // 语雀 API 配置
  yuque: {
    token: process.env.YUQUE_TOKEN, // 语雀 API 令牌
    baseURL: 'https://nova.yuque.com/api/v2', // 语雀 API 基础地址
    baseSlug: process.env.TEAM_BASE_ID + '/' + process.env.KNOWLEDGE_BASE_ID, // 知识库 ID（如 ph25ri/ua1c3q）
    targetAuthor: process.env.TARGET_AUTHOR // 只推送特定作者的文档
  },
  
  // 邮件服务配置
  email: {
    service: process.env.EMAIL_SERVICE || 'QQ', // 邮箱服务商
    user: process.env.EMAIL_USER, // 邮箱账号
    password: process.env.EMAIL_PASSWORD, // 邮箱密码
    from: process.env.EMAIL_FROM // 发件人地址
  },
  
  // 定时任务配置（如每周一8点自动推送）
  cron: {
    schedule: process.env.CRON_SCHEDULE || '0 8 * * 1'
  }
};