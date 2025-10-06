# YuqueEmailPusherBackend
the backend of YuqueEmailPusher

API:
```javascript
// 订阅接口：用户提交邮箱，添加订阅
router.post('/subscribe', async (req, res) => {
  const { email ,docSlug=process.env.KNOWLEDGE_BASE_ID, single, author} = req.body;
  const result = await services.subscribe(email, docSlug, single, author); // 调用订阅方法
  res.json(result); // 返回结果
});
/*
url {{baseURL}}/api/subscribe

method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
    email: 'test@example.com',
    docSlug: 'ua1c3q',//选择的文档的 url
    single: false,//单个文档还是包含其所有子文档
    author: '作者名'//空白代表不限
})
*/
```
```javascript
// 取消订阅接口：用户提交邮箱，取消特定的一条订阅信息
router.post('/unsubscribe', async (req, res) => {
  const { email ,docSlug, single, author} = req.body;
  const result = await services.unsubscribe(email, docSlug, single, author); // 调用取消订阅方法
  res.json(result);
});
/*
url {{baseURL}}/api/unsubscribe

method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
    email: 'test@example.com',
    docSlug: 'ua1c3q',//选择的文档的 url
    single: false,//单个文档还是包含其所有子文档
    author: '作者名'//空白代表不限
})
*/
```
```javascript
// 取消订阅接口：用户提交邮箱，取消特定的邮箱所有订阅信息
router.post('/unsubscribeAll', async (req, res) => {
  const { email } = req.body;
  const result = await services.unsubscribeAll(email); // 调用取消订阅方法
  res.json(result);
});
/*
url {{baseURL}}/api/unsubscribeAll

method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
    email: 'test@example.com'
})
*/
```
```javascript
// 手动触发推送接口：管理员可手动执行一次推送任务
router.post('/push/manual', async (req, res) => {
  await services.manualPush(); // 调用手动推送方法
  res.json({ message: '手动推送任务已触发' });
});
/*
url {{baseURL}}/api/push/manual

method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
})
*/
```
```javascript
// 查询所有或者单个订阅者接口：用于管理界面展示订阅列表
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
/*
url {{baseURL}}/api/subscriptions?mail=test@example.com

*/
```
```javascript
//清除数据库，需要密钥
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

/*
url {{baseURL}}/api/clear-db

method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
      secret:""
})
*/
```