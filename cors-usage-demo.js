// 跨域配置说明：
// 1. 先安装依赖：npm install cors
// 2. 在 app.js 顶部引入 cors 并注册中间件

const cors = require('cors');

// ...existing code...

// 在 express 实例 app 创建后，use 路由前添加如下代码：
app.use(cors({
  origin: 'http://localhost:8080', // 只允许前端端口访问
  credentials: true // 如有需要支持 cookie，可加此项
}));

// ...existing code...
