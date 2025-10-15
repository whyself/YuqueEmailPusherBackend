const mongoose = require('mongoose');
require('dotenv').config();

const subscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: false },
  // docSlug: { type: String, required: false, default: process.env.KNOWLEDGE_BASE_ID },
  docUuid: { type: String, required: false, default: '' },
  title: { type: String, default: '' },
  single: { type: Boolean, default: false },
  author: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  subscribedAt: { type: Date, default: Date.now }
});

const pushHistorySchema = new mongoose.Schema({
  docTitle: String,
  author: String,
  pushDate: { type: Date, default: Date.now },
  successCount: Number,
  failCount: Number
});

const docTreeSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  type: { type: String, default: '' },
  slug: { type: String, required: true },
  uuid: { type: String, required: true, unique: true },
  level: { type: Number, default: 0 },
  parentUuid: { type: String, default: null },
  url: { type: String, default: '' },
  publishedAt: { type: String, default: '' },
  description: { type: String, default: '' },
  wordCount: { type: Number, default: 0 },
  update: { type: Boolean, default: false },
  children: { type: [String], default: [] },
  author: { type: String, default: '' },
  size: { type: Number, default: 0 }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // 加密存储
  createdAt: { type: Date, default: Date.now }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
const PushHistory = mongoose.model('PushHistory', pushHistorySchema);
const DocTree = mongoose.model('DocTree', docTreeSchema);
const User = mongoose.model('User', userSchema);

module.exports = {
  Subscription,
  PushHistory,
  DocTree,
  User,
};