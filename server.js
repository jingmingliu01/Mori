import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middleware
app.use(cors());
app.use(express.json());

// 2. Connect to MongoDB Atlas
// Remember to set MONGODB_URI in your .env file
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 3. API routes (for basic health checks)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mori Backend is running!' });
});

// ----------------------------------------------------
// 4. Production hosting (Deployment Magic)
// Only serve built Vue assets as static files in production
// ----------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  // Tell Express where to find the built Vue assets
  app.use(express.static(path.join(__dirname, 'client/dist')));

  // For any non-API route, return index.html so Vue Router can handle it
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
