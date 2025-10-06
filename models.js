const mongoose = require('mongoose');
require('dotenv').config();

const subscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: false },
  docSlug: { type: String, required: false, default: process.env.KNOWLEDGE_BASE_ID },
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
  url: { type: String, default: '' },
  publishedAt: { type: String, default: '' },
  description: { type: String, default: '' },
  update: { type: Boolean, default: false },
  children: { type: [String], default: [] },
  author: { type: String, default: '' }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
const PushHistory = mongoose.model('PushHistory', pushHistorySchema);
const DocTree = mongoose.model('DocTree', docTreeSchema);

module.exports = {
  Subscription,
  PushHistory,
  DocTree,
};