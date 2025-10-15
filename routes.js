
// routes.js 负责定义所有 HTTP API 路由
// 1. 订阅、取消订阅、手动推送、查询订阅列表等接口
// 2. 每个接口对应一个业务逻辑方法（services.js）

const express = require('express');
const router = express.Router();
const services = require('./services'); // 加载业务逻辑服务
const userService = require('./userService'); // 加载用户服务
const { PushHistory ,Subscription,DocTree} = require('./models');
require('dotenv').config();

// 用户注册接口
router.post('/user/register', async (req, res) => {
  const { username, email, password } = req.body;
  const result = await userService.registerUser({ username, email, password });
  res.json(result);
});

// 用户登录接口
router.post('/user/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const result = await userService.loginUser({ usernameOrEmail, password });
  res.json(result);
});
// 订阅接口：用户提交邮箱，添加订阅
router.post('/subscribe', async (req, res) => {
  const { email ,title,docUuid, single, author} = req.body;
  const result = await services.subscribe(email, title,docUuid, single, author); // 调用订阅方法
  console.log(result);
  res.json(result); // 返回结果
});

// 取消订阅接口：用户提交邮箱，取消订阅
router.post('/unsubscribe', async (req, res) => {
  const { email ,title,docUuid, single, author} = req.body;
  const result = await services.unsubscribe(email, title,docUuid, single, author); // 调用取消订阅方法
  console.log(result);
  res.json(result);
});

router.post('/unsubscribeAll', async (req, res) => {
  const { email } = req.body;
  const result = await services.unsubscribeAll(email); // 调用取消订阅方法
  console.log(result);
  res.json(result);
});

// 手动触发推送接口：管理员可手动执行一次推送任务
router.post('/push/manual', async (req, res) => {
  services.manualPush(); // 调用手动推送方法
  res.json({ message: '手动推送任务已触发' });
});

// 查询所有订阅者接口：用于管理界面展示订阅列表
router.get('/subscriptions', async (req, res) => {
  const { Subscription } = require('./models');
  const { email } = req.query;
  let subscriptions;
  if (email) {
    subscriptions = await Subscription.find({ email: email ,isActive:true});
  } else {
    subscriptions = await Subscription.find();
  }
  console.log(`查询订阅列表，数量：${subscriptions.length}`);
  console.log(subscriptions);
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

// 查询 DocTree 数据接口
router.get('/docTree', async (req, res) => {
  try {
    const docs = await DocTree.find();
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 导出路由，供 app.js 加载
module.exports = router;