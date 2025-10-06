// routes.js 负责定义所有 HTTP API 路由
// 1. 订阅、取消订阅、手动推送、查询订阅列表等接口
// 2. 每个接口对应一个业务逻辑方法（services.js）

const express = require('express');
const router = express.Router();
const services = require('./services'); // 加载业务逻辑服务
const { PushHistory ,Subscription,DocTree} = require('./models');
require('dotenv').config();

// 订阅接口：用户提交邮箱，添加订阅
router.post('/subscribe', async (req, res) => {
  const { email ,docSlug=process.env.KNOWLEDGE_BASE_ID, single, author} = req.body;
  const result = await services.subscribe(email, docSlug, single, author); // 调用订阅方法
  res.json(result); // 返回结果
});

// 取消订阅接口：用户提交邮箱，取消订阅
router.post('/unsubscribe', async (req, res) => {
  const { email ,docSlug, single, author} = req.body;
  const result = await services.unsubscribe(email, docSlug, single, author); // 调用取消订阅方法
  res.json(result);
});

router.post('/unsubscribeAll', async (req, res) => {
  const { email } = req.body;
  const result = await services.unsubscribeAll(email); // 调用取消订阅方法
  res.json(result);
});

// 手动触发推送接口：管理员可手动执行一次推送任务
router.post('/push/manual', async (req, res) => {
  await services.manualPush(); // 调用手动推送方法
  res.json({ message: '手动推送任务已触发' });
});

// 查询所有订阅者接口：用于管理界面展示订阅列表
router.get('/subscriptions', async (req, res) => {
  const { Subscription } = require('./models');
  const { email } = req.query;
  let subscriptions;
  if (email) {
    subscriptions = await Subscription.find({ email: email });
  } else {
    subscriptions = await Subscription.find();
  }
  res.json(subscriptions);
});

router.post('/clear-db', async (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ success: false, message: '无权限' });
  }
  await Subscription.deleteMany({});
  await PushHistory.deleteMany({});
  await DocTree.deleteMany({});
  res.json({ success: true, message: '数据库已清空' });
});

// 导出路由，供 app.js 加载
module.exports = router;