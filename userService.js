// userService.js 负责用户注册和登录相关逻辑
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('./models');
require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret';

class UserService {
  // 用户注册
  async registerUser({ username, email, password }) {
    if (!username || !email || !password) {
      return { success: false, message: '用户名、邮箱和密码不能为空' };
    }
    // 检查用户名或邮箱是否已存在
    const existUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existUser) {
      return { success: false, message: '用户名或邮箱已被注册' };
    }
    // 密码加密
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hash });
    await user.save();
    return { success: true, message: '注册成功' };
  }

  // 用户登录
  async loginUser({ usernameOrEmail, password }) {
    if (!usernameOrEmail || !password) {
      return { success: false, message: '用户名/邮箱和密码不能为空' };
    }
    // 支持用户名或邮箱登录
    const user = await User.findOne({ $or: [ { username: usernameOrEmail }, { email: usernameOrEmail } ] });
    if (!user) {
      return { success: false, message: '用户不存在' };
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { success: false, message: '密码错误' };
    }
    // 生成 JWT
    const token = jwt.sign({ id: user._id, username: user.username, email: user.email }, jwtSecret, { expiresIn: '7d' });
    return { success: true, message: '登录成功', token, user: { username: user.username, email: user.email } };
  }
}

module.exports = new UserService();