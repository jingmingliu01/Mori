import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 中间件
app.use(cors());
app.use(express.json());

// 2. 连接 MongoDB Atlas
// 记得在 .env 文件里填 MONGODB_URI
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 3. API 路由 (测试用)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mori Backend is running!' });
});

// ----------------------------------------------------
// 4. 生产环境托管 (Deployment Magic)
// 只有在生产环境，才把 Vue 打包好的文件当做静态资源返回
// ----------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  // 告诉 Express 去哪里找 Vue 打包后的文件
  app.use(express.static(path.join(__dirname, 'client/dist')));

  // 任何不匹配 API 的请求，都返回 index.html (让 Vue Router 接管)
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

// 启动
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});