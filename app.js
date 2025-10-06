// app.js 是主程序入口，负责启动整个服务
// 1. 加载依赖（express 用于 Web 服务，mongoose 用于数据库，dotenv 用于环境变量）
const express = require('express');
const mongoose = require('mongoose');
const {DocTree} = require('./models');
require('dotenv').config();

const app = express(); // 创建 express 应用实例

// 2. 设置中间件（解析 JSON 请求体）
app.use(express.json());

// 3. 加载路由（所有 API 路由都在 routes.js 里定义）
const routes = require('./routes');
app.use('/api', routes); // 所有 /api 开头的请求交给 routes.js 处理

// 4. 根路由和健康检查接口
app.get('/', (req, res) => {
  res.send('欢迎使用语雀邮件推送系统！');
});
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: '语雀邮件推送' });
});

// 5. 启动服务器和数据库连接
async function startServer() {
  try {
    // 连接 MongoDB 数据库，连接地址在 .env 文件或 config.js 里配置
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('数据库连接成功');
    if(await DocTree.countDocuments()===0){
      console.log('初始化文档树数据');
      const rootNode = new DocTree({
        title: 'Root',
        type: 'Root',
        slug: process.env.KNOWLEDGE_BASE_ID,
        update: false,
        children: []
      });
      await rootNode.save();
    }
    await DocTree.updateMany({}, { $set: { children: [] ,update:false} });
  // 启动定时任务（定时自动推送语雀消息，逻辑在 services.js）
  const services = require('./services');
  // 启动后立即推送一次
  // await services.manualPush();
  // 启动定时任务
  services.startCronJob();
    
    // 启动 Web 服务，监听端口（默认 3000，可在 .env 或 config.js 配置）
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    // 启动失败时输出错误
    console.error('启动失败:', error);
  }
}

// 6. 执行启动函数，正式运行服务
startServer();