// services.js 负责实现所有核心业务逻辑
// 1. 语雀 API 数据获取
// 2. 邮件发送
// 3. 定时任务
// 4. 订阅管理
// 5. 推送历史记录

const axios = require('axios'); // 用于请求语雀 API
const nodemailer = require('nodemailer'); // 用于发送邮件
const cron = require('node-cron'); // 用于定时任务
const config = require('./config'); // 加载配置
const fs = require('fs');
const { Subscription, PushHistory ,DocTree, User } = require('./models'); // 加载数据模型
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

class YuqueEmailService {
  constructor() {
    // 创建语雀 API 客户端
    this.yuqueClient = axios.create({
      baseURL: config.yuque.baseURL,
      headers: {
        'X-Auth-Token': config.yuque.token,
        'User-Agent': 'Yuque-Email-Pusher/1.0'
      }
    });
    // 创建邮件发送器
    this.emailTransporter = nodemailer.createTransport({
      service: config.email.service,
      auth: {
        user: config.email.user,
        pass: config.email.password
      }
    });
    this.jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret';
  }

  

  // 用户注册和登录方法已迁移到 userService.js
  // 请通过 userService.registerUser 和 userService.loginUser 调用
  async compare(oldOne,newOne){
    const date1 = new Date(oldOne.publishedAt);
    const date2 = new Date(newOne.published_at);
    // console.log(date1,date2);
    const d1 = date1.getTime();
    const d2 = date2.getTime();
    // console.log("update: ",d1,d2,(Math.abs(d1 - d2) > 0));
    const ftime = Boolean(Math.abs(d1 - d2) > 1000 * 60 * 60 * 1);
    const fword = Boolean(Math.abs(oldOne.wordCount - newOne.word_count) > 50);
    return (ftime===true &&fword===true);
  }
  // 获取语雀知识库中特定作者的文档
  async getYuqueDocs() {
    try {
      memberList = [];
      await this.getAllMember();
      // 获取知识库目录（toc）
      //console.log(config.yuque.baseURL+`/repos/${config.yuque.baseSlug}/toc`)
      const tocResponse = await this.yuqueClient.get(
        `/repos/${config.yuque.baseSlug}/toc`
      );
      if(tocResponse.status !== 200) {
        throw new Error('无法获取知识库目录');
      }
      if(!tocResponse.data.data || tocResponse.data.data.length === 0) {
        throw new Error('知识库目录为空');
      }
      console.log('初始化知识库数据');
      if(await DocTree.countDocuments({uuid:process.env.KNOWLEDGE_BASE_ID})===0){
      const newNode = new DocTree({
        title: '社团活动',
        type: 'KNOWLEDGE_BASE',
        slug: process.env.KNOWLEDGE_BASE_ID,
        uuid: process.env.KNOWLEDGE_BASE_ID,
        update: false,
        children: []
      });
      await newNode.save();
      }
      const rootDoc = await DocTree.findOne({uuid:'Root'});
      if(!rootDoc.children.includes(process.env.KNOWLEDGE_BASE_ID)){
        await DocTree.findOneAndUpdate(
      { uuid: 'Root' },
      { $push: { children: process.env.KNOWLEDGE_BASE_ID } }
      );
      }
      let lv=[process.env.KNOWLEDGE_BASE_ID,null,null,null,null,null,null,null,null];//console.log(config.yuque.baseURL+`/repos/${config.yuque.baseSlug}/toc`);
      let i=1;
      for (const item of tocResponse.data.data) {
         // 跳过分组节点
        // ...后续处理文档节点...
        // fs.appendFileSync('test.json', JSON.stringify(item, null, 2)+'\n', 'utf-8');
        // i++;
        // if(i>30) break;
        let level=item.level+1;
        let fa=lv[level-1];
        lv[level]=item.uuid;
        // console.log(lv);
        // while(String(fa)==='#') level--,fa=lv[level-1];
        // if(item.slug.startsWith('#')) continue;
        // console.log(fa);
        const parentDoc = await DocTree.findOne({uuid:fa});
        if(!parentDoc.children.includes(item.uuid)){
          await DocTree.findOneAndUpdate(
        { uuid: fa },
        { $push: { children: item.uuid } }
        );
        }

        let cur= await DocTree.findOne({uuid:item.uuid});
        // if(cur) console.log(cur.publishedAt);
        if(cur&&cur.publishedAt!==null&&Date.now()-new Date(cur.publishedAt).getTime()>1000*60*60*24*14)
        {
          console.log(cur.title + '文档超过两周未更新，跳过');
          continue;
        }
        
        let docContent={};
        let title=(Boolean)(String(item.slug)!=="#");
        let url='';
        if (title) {
        console.log(item.title);
        url=`https://nova.yuque.com/${config.yuque.teamBaseId}`;
        url+='/'+item.slug;
        const docResponse = await this.yuqueClient.get(
          `/repos/${config.yuque.baseSlug}/docs/${item.slug}`
        );
        if(docResponse.status !== 200) {
          throw new Error('无法获取文档内容');
        }
        docContent = docResponse.data.data;
        }
        // fs.createWriteStream(`./test.json`).write(JSON.stringify(docContent, null, 2)),f=false;
        if(await DocTree.findOne({uuid:item.uuid}).then(async doc=>{
          if(!doc) {
            // 新建节点
            const newNode = new DocTree({
              title: item.title,
              type: item.type,
              slug: item.slug,
              uuid: item.uuid,
              level: item.level+1,
              parentUuid: fa,
              url: url,
              publishedAt:  title ? docContent.published_at : null,
              description: title ? docContent.description : null,
              wordCount: title ? docContent.word_count : null,
              update: true,
              children: [],
              author: title ? docContent.user.name : null
            });
            await newNode.save();
          } else if (await this.compare(doc,docContent)) {
          console.log(Date(docContent.published_at), Date(doc.publishedAt));
            await DocTree.findOneAndUpdate(
              { uuid: item.uuid },
              {
                title: item.title,
                type: item.type,
                slug: item.slug,
                uuid: item.uuid,
                level: item.level+1,
                parentUuid: fa,
                url: url,
                publishedAt: title ? docContent.published_at : null,
                description: title ? docContent.description : null,
                wordCount: title ? docContent.word_count : null,
                update: true,
                children: [],
                author: title ? docContent.user.name : null
              }
            );
          } else {
            // 只更新 update 字段
            if(title) console.log('文档无更新');
            else console.log('分组节点，无需更新');
            await DocTree.findOneAndUpdate(
              { uuid: item.uuid },
              {
                title: item.title,
                type: item.type,
                slug: item.slug,
                uuid: item.uuid,
                level: item.level+1,
                parentUuid: fa,
                url: url,
                description: title ? docContent.description : null,
                update: false,
                children: [],
                author: title ? docContent.user.name : null
              }
            );
          }
        }));
      }
    } catch (error) {
      console.error('获取语雀文档失败:', error.message);
      return [];
    }
  }

  // 发送邮件给订阅者
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

  // 构建邮件内容（HTML 格式）
  buildEmailContent(docs) {
    const docList = docs.map(doc => `
      <div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd;">
        <h3>${doc.title}</h3>
        <p>作者: ${doc.author} | 更新: ${new Date(doc.updatedAt).toLocaleString('zh-CN', { hour12: false })}</p>
        <p>${doc.description || ''}</p>
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
  async getSize(uuid){
    const doc = await DocTree.findOne({ uuid });
    let size=0;
    for (const childUuid of doc.children) {
      size += await this.getSize(childUuid);
    }
    await DocTree.findOneAndUpdate(
      { uuid: uuid },
      { size: size }
      );
    return size+(Number)(doc.type==='DOC');
  }
  // 执行推送任务（获取文档、发送邮件、记录历史）
  async runPushTask() {
    console.log('开始执行推送任务...');
    try {
      // 1. 获取目标文档
      await DocTree.updateMany({}, { $set: { children: [] ,update:false,size:0} });
      await this.getYuqueDocs();
      await this.getSize(process.env.KNOWLEDGE_BASE_ID);
      console.log('文档获取和更新完成');
      // 2. 获取所有活跃订阅者
      const subscribers = await Subscription.find({ isActive: true });
      if (subscribers.length === 0) {
        console.log('没有活跃的订阅者');
        return;
      }
      
      // 3. 逐个发送邮件
      let successCount = 0;
      let failCount = 0;
      let uniqueEmailsPush = new Set();
      for (const subscriber of subscribers) {
        if(!subscriber.isActive) continue;
        let docs=[];
        const doc=await DocTree.findOne({uuid:subscriber.docUuid});
        // console.log(doc.update);
        if(doc&&!uniqueEmailsPush.has(subscriber.email+doc.uuid)&&doc.update===true&&doc.uuid!==process.env.KNOWLEDGE_BASE_ID&&(subscriber.author==='' || childDoc.author===subscriber.author)){
            docs.push({
              title: doc.title,
              author: doc.author,
              url: doc.url,
              updatedAt: doc.publishedAt,
              description: doc.description
            });
            uniqueEmailsPush.add(subscriber.email+doc.slug);
        } 
        if (!subscriber.single){
          let docList=[];
            docList.push(...doc.children);
            while(docList.length>0){
              const childUuid=docList.shift();
              const childDoc=await DocTree.findOne({uuid:childUuid});
              if(childDoc&&!uniqueEmailsPush.has(subscriber.email+childDoc.uuid)&&childDoc.update===true&&(subscriber.author==='' || childDoc.author===subscriber.author)){
                // console.log(childDoc.update);
                docs.push({
                  title: childDoc.title,
                  author: childDoc.author,
                  url: childDoc.url,
                  updatedAt: childDoc.publishedAt,
                  description: childDoc.description
                });
                uniqueEmailsPush.add(subscriber.email+childDoc.uuid);
              }
              if (childDoc && childDoc.children.length > 0) {
                docList.push(...childDoc.children);
              }
            }
        }
        //console.log(docs);
        if(docs.length===0) {console.log(`向 ${subscriber.email} 推送失败: 没有更新文档`);continue;}
        const result = await this.sendEmail(docs, subscriber.email);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
        console.log(`向 ${subscriber.email} 推送完成: 成功 ${successCount}, 失败 ${failCount}`);
      // 4. 记录推送历史
      await PushHistory.create({
        docTitle: docs.map(d => d.title).join(', '),
        author: docs.map(d => d.author).join(', '),
        subscriberEmail: subscribers.email,
        successCount,
        failCount
      });
      }
      
     } catch (error) {
      console.error('推送任务执行失败:', error);
    }
  }

  // 启动定时任务（定时自动执行推送）
  async startCronJob() {
    cron.schedule(config.cron.schedule, () => {
      this.runPushTask();
    });
    console.log('定时任务已启动');
  }

  // 手动触发推送任务
  async manualPush() {
    return await this.runPushTask();
  }

  // 订阅邮箱
  async subscribe(email, title, docUuid, single, author) {
    try {
      const existing = await Subscription.findOne({ email ,title, docUuid, single, author});
      if (existing) {
        existing.isActive = true;
        await existing.save();
        return { success: false, message: '该订阅已保持活跃状态' };
      }
      await Subscription.create({ email ,title, docUuid, single, author});
      return { success: true, message: '订阅成功' };
    } catch (error) {
      return { success: false, message: '订阅失败: ' + error.message };
    }
  }

  // 取消订阅
  async unsubscribe(email, title, docUuid, single, author) {
    try {
      const result = await Subscription.findOneAndUpdate(
        { email ,title, docUuid, single, author},
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
  async unsubscribeAll(email) {
    try {
      const result = await Subscription.updateMany(
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


// 导出业务服务实例，供 app.js 和 routes.js 调用
module.exports = new YuqueEmailService();