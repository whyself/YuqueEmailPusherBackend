# 简化版语雀邮件推送系统架构

作为新手，我为你设计一个更简单直观的架构，保留核心功能但减少复杂性：

## 📁 简化项目结构

```
yuque-email-pusher/
├── app.js              # 主程序入口
├── config.js           # 所有配置集中在这里
├── models.js           # 所有数据模型集中在这里
├── services.js         # 所有业务逻辑集中在这里
├── routes.js           # 所有API路由集中在这里
├── package.json
└── .env
```

## 🔧 各文件详细说明

### 1. `app.js` - 主程序入口
**作用**：程序的启动文件，包含服务器启动、数据库连接和中间件设置

```javascript
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// 中间件
app.use(express.json());

// 引入路由
const routes = require('./routes');
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: '语雀邮件推送' });
});

// 启动服务器
async function startServer() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('数据库连接成功');
    
    // 启动定时任务
    const services = require('./services');
    services.startCronJob();
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
  }
}

startServer();
```

### 2. `config.js` - 统一配置
**作用**：所有配置信息集中管理

```javascript
module.exports = {
  // 服务器配置
  port: process.env.PORT || 3000,
  
  // 数据库配置
  database: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/yuque_pusher'
  },
  
  // 语雀配置
  yuque: {
    token: process.env.YUQUE_TOKEN,
    baseURL: 'https://www.yuque.com/api/v2',
    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
    targetAuthor: process.env.TARGET_AUTHOR
  },
  
  // 邮件配置
  email: {
    service: process.env.EMAIL_SERVICE || 'QQ',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM
  },
  
  // 定时任务配置
  cron: {
    schedule: process.env.CRON_SCHEDULE || '0 8 * * 1' // 每周一8点
  }
};
```

### 3. `models.js` - 数据模型
**作用**：定义数据库表和字段

```javascript
const mongoose = require('mongoose');

// 订阅者模型
const subscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  subscribedAt: { type: Date, default: Date.now }
});

// 推送历史模型
const pushHistorySchema = new mongoose.Schema({
  docTitle: String,
  author: String,
  pushDate: { type: Date, default: Date.now },
  successCount: Number,
  failCount: Number
});

// 创建模型
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const PushHistory = mongoose.model('PushHistory', pushHistorySchema);

module.exports = {
  Subscription,
  PushHistory
};
```

### 4. `services.js` - 业务逻辑
**作用**：包含所有核心功能实现

```javascript
const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const config = require('./config');
const { Subscription, PushHistory } = require('./models');

class YuqueEmailService {
  constructor() {
    // 语雀API客户端
    this.yuqueClient = axios.create({
      baseURL: config.yuque.baseURL,
      headers: {
        'X-Auth-Token': config.yuque.token,
        'User-Agent': 'Yuque-Email-Pusher/1.0'
      }
    });
    
    // 邮件传输器
    this.emailTransporter = nodemailer.createTransporter({
      service: config.email.service,
      auth: {
        user: config.email.user,
        pass: config.email.password
      }
    });
  }
  
  // 获取语雀文档
  async getYuqueDocs() {
    try {
      // 获取知识库目录
      const tocResponse = await this.yuqueClient.get(
        `/repos/${config.yuque.knowledgeBaseId}/toc`
      );
      
      // 筛选特定作者的文档（这里需要根据实际API响应调整）
      const targetDocs = [];
      for (const item of tocResponse.data.data) {
        if (item.type === 'DOC') {
          const docDetail = await this.yuqueClient.get(
            `/repos/${config.yuque.knowledgeBaseId}/docs/${item.id}`
          );
          
          // 假设通过用户信息判断作者
          if (docDetail.data.user && 
              docDetail.data.user.name === config.yuque.targetAuthor) {
            targetDocs.push({
              id: docDetail.data.id,
              title: docDetail.data.title,
              author: docDetail.data.user.name,
              url: docDetail.data.url,
              updatedAt: docDetail.data.updated_at
            });
          }
        }
      }
      
      return targetDocs;
    } catch (error) {
      console.error('获取语雀文档失败:', error.message);
      return [];
    }
  }
  
  // 发送邮件
  async sendEmail(docs, subscriberEmail) {
    try {
      const mailOptions = {
        from: config.email.from,
        to: subscriberEmail,
        subject: `语雀更新：${docs.length}篇新文档`,
        html: this.buildEmailContent(docs)
      };
      
      await this.emailTransporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error(`发送邮件到 ${subscriberEmail} 失败:`, error.message);
      return { success: false, error: error.message };
    }
  }
  
  // 构建邮件内容
  buildEmailContent(docs) {
    const docList = docs.map(doc => `
      <div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd;">
        <h3>${doc.title}</h3>
        <p>作者: ${doc.author} | 更新: ${new Date(doc.updatedAt).toLocaleDateString()}</p>
        <a href="${doc.url}">阅读文档</a>
      </div>
    `).join('');
    
    return `
      <h1>📚 语雀文档更新推送</h1>
      <p>发现 ${docs.length} 篇新文档：</p>
      ${docList}
      <hr>
      <p><small>自动发送，请勿回复</small></p>
    `;
  }
  
  // 执行推送任务
  async runPushTask() {
    console.log('开始执行推送任务...');
    
    try {
      // 1. 获取文档
      const docs = await this.getYuqueDocs();
      if (docs.length === 0) {
        console.log('没有找到符合条件的文档');
        return;
      }
      
      // 2. 获取订阅者
      const subscribers = await Subscription.find({ isActive: true });
      if (subscribers.length === 0) {
        console.log('没有活跃的订阅者');
        return;
      }
      
      // 3. 发送邮件
      let successCount = 0;
      let failCount = 0;
      
      for (const subscriber of subscribers) {
        const result = await this.sendEmail(docs, subscriber.email);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      // 4. 记录推送历史
      await PushHistory.create({
        docTitle: docs.map(d => d.title).join(', '),
        author: config.yuque.targetAuthor,
        successCount,
        failCount
      });
      
      console.log(`推送完成: 成功 ${successCount}, 失败 ${failCount}`);
      
    } catch (error) {
      console.error('推送任务执行失败:', error);
    }
  }
  
  // 启动定时任务
  startCronJob() {
    cron.schedule(config.cron.schedule, () => {
      this.runPushTask();
    });
    console.log('定时任务已启动');
  }
  
  // 手动触发推送
  async manualPush() {
    return await this.runPushTask();
  }
  
  // 订阅管理
  async subscribe(email) {
    try {
      const existing = await Subscription.findOne({ email });
      if (existing) {
        return { success: false, message: '该邮箱已订阅' };
      }
      
      await Subscription.create({ email });
      return { success: true, message: '订阅成功' };
    } catch (error) {
      return { success: false, message: '订阅失败: ' + error.message };
    }
  }
  
  async unsubscribe(email) {
    try {
      const result = await Subscription.findOneAndUpdate(
        { email },
        { isActive: false }
      );
      
      if (!result) {
        return { success: false, message: '未找到订阅记录' };
      }
      
      return { success: true, message: '取消订阅成功' };
    } catch (error) {
      return { success: false, message: '取消订阅失败: ' + error.message };
    }
  }
}

module.exports = new YuqueEmailService();
```

### 5. `routes.js` - API路由
**作用**：定义所有HTTP接口

```javascript
const express = require('express');
const router = express.Router();
const services = require('./services');

// 订阅
router.post('/subscribe', async (req, res) => {
  const { email } = req.body;
  const result = await services.subscribe(email);
  res.json(result);
});

// 取消订阅
router.post('/unsubscribe', async (req, res) => {
  const { email } = req.body;
  const result = await services.unsubscribe(email);
  res.json(result);
});

// 手动触发推送（管理员用）
router.post('/push/manual', async (req, res) => {
  await services.manualPush();
  res.json({ message: '手动推送任务已触发' });
});

// 获取订阅列表（简单的管理界面用）
router.get('/subscriptions', async (req, res) => {
  const { Subscription } = require('./models');
  const subscriptions = await Subscription.find();
  res.json(subscriptions);
});

module.exports = router;
```

## 🚀 简化版工作流程

1. **启动应用** → `node app.js`
2. **用户订阅** → 调用 `/api/subscribe` 接口
3. **定时任务** → 自动获取语雀文档并发送邮件
4. **手动触发** → 调用 `/api/push/manual` 立即执行

## 📦 依赖包清单 (`package.json`)

```json
{
  "name": "yuque-email-pusher-simple",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "axios": "^1.5.0",
    "nodemailer": "^6.9.4",
    "node-cron": "^3.0.2",
    "dotenv": "^16.3.1"
  }
}
```

## 🎯 这个简化版的优势

1. **文件少**：只有5个核心文件，易于理解
2. **功能完整**：保留了订阅、推送、定时任务等核心功能
3. **易于调试**：所有逻辑集中，问题定位简单
4. **快速上手**：不需要理解复杂的分层架构
5. **便于扩展**：当需要更多功能时，可以逐步拆分

## 🔄 后续扩展建议

当项目变得复杂时，你可以按这个顺序拆分：

1. 先把 `services.js` 拆分成多个文件
2. 再把 `models.js` 拆分成多个模型文件
3. 最后考虑添加 `middleware` 和 `utils` 文件夹

这个简化版本应该能让你快速开始项目，随着经验的增长再逐步优化架构！