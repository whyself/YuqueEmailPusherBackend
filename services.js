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
const { Subscription, PushHistory ,DocTree} = require('./models'); // 加载数据模型
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
  }
  async compareDate(date1,date2){
    const d1 = date1.getTime();
    const d2 = date2.getTime();
    // console.log("update: ",d1,d2,(Math.abs(d1 - d2) > 0));
    return Boolean(Math.abs(d1 - d2) > 1000 * 60 * 60 * 1);
  }
  // 获取语雀知识库中特定作者的文档
  async getYuqueDocs() {
    try {
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
        lv[level]=item.slug;
        // console.log(lv);
        while(String(fa)==='#') level--,fa=lv[level-1];
        if(item.slug.startsWith('#')) continue;
        // console.log(fa);
        const parentDoc = await DocTree.findOne({slug:fa});
        if(!parentDoc.children.includes(item.slug)){
          await DocTree.findOneAndUpdate(
        { slug: fa },
        { $push: { children: item.slug } }
        );
        }
        console.log(item.title);
        let url=`https://nova.yuque.com/${config.yuque.teamBaseId}`;
        url+='/'+item.slug;
        const docResponse = await this.yuqueClient.get(
          `/repos/${config.yuque.baseSlug}/docs/${item.slug}`
        );
        if(docResponse.status !== 200) {
          throw new Error('无法获取文档内容');
        }
        let docContent = docResponse.data.data;
        // fs.createWriteStream(`./test.json`).write(JSON.stringify(docContent, null, 2)),f=false;
        if(await DocTree.findOne({slug:item.slug}).then(async doc=>{
          if(!doc) {
            // 新建节点
            const newNode = new DocTree({
              title: item.title,
              type: item.type,
              slug: item.slug,
              url: url,
              publishedAt: docContent.published_at,
              description: docContent.description,
              update: true,
              children: [],
              author: docContent.user.name
            });
            await newNode.save();
          } else if (await this.compareDate(new Date(docContent.published_at), new Date(doc.publishedAt))) {
          console.log(Date(docContent.published_at), Date(doc.publishedAt));
            await DocTree.findOneAndUpdate(
              { slug: item.slug },
              {
                title: item.title,
                type: item.type,
                slug: item.slug,
                url: url,
                publishedAt: docContent.published_at,
                description: docContent.description,
                update: true,
                children: [],
                author: docContent.user.name
              }
            );
          } else {
            // 只更新 update 字段
            console.log('文档无更新');
            await DocTree.findOneAndUpdate(
              { slug: item.slug },
              { update: false }
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
        <p>作者: ${doc.author} | 更新: ${new Date(doc.updatedAt).toLocaleDateString()}</p>
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

  // 执行推送任务（获取文档、发送邮件、记录历史）
  async runPushTask() {
    console.log('开始执行推送任务...');
    try {
      // 1. 获取目标文档
      
      await this.getYuqueDocs();
      // 2. 获取所有活跃订阅者
      const subscribers = await Subscription.find({ isActive: true });
      if (subscribers.length === 0) {
        console.log('没有活跃的订阅者');
        return;
      }
      
      // 3. 逐个发送邮件
      let successCount = 0;
      let failCount = 0;
      for (const subscriber of subscribers) {
        if(!subscriber.isActive) continue;
        let docs=[];
        const doc=await DocTree.findOne({slug:subscriber.docSlug});
        // console.log(doc.update);
        if(doc&&doc.update===true&&doc.slug!==process.env.KNOWLEDGE_BASE_ID&&(subscriber.author==='' || subscriber.author===doc.author)){
            docs.push({
              title: doc.title,
              author: doc.author,
              url: doc.url,
              updatedAt: doc.publishedAt,
              description: doc.description
            });
        } 
        if (!subscriber.single){
          let docList=[];
            docList.push(...doc.children);
            while(docList.length>0){
              const childSlug=docList.shift();
              const childDoc=await DocTree.findOne({slug:childSlug});
              if(childDoc&&childDoc.update===true&&(subscriber.author==='' || childDoc.author===subscriber.author)){
                // console.log(childDoc.update);
                docs.push({
                  title: childDoc.title,
                  author: childDoc.author,
                  url: childDoc.url,
                  updatedAt: childDoc.publishedAt,
                  description: childDoc.description
                });
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
    await DocTree.updateMany({}, { $set: { children: [] ,update:false} });
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
  async subscribe(email, docSlug, single, author) {
    try {
      const existing = await Subscription.findOne({ email ,docSlug, single, author});
      if (existing) {
        existing.isActive = true;
        await existing.save();
        return { success: false, message: '该邮箱已保持活跃状态，single = ' + single };
      }
      await Subscription.create({ email ,docSlug, single, author});
      return { success: true, message: '订阅成功' };
    } catch (error) {
      return { success: false, message: '订阅失败: ' + error.message };
    }
  }

  // 取消订阅
  async unsubscribe(email, docSlug, single, author) {
    try {
      const result = await Subscription.findOneAndUpdate(
        { email ,docSlug, single, author},
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