import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import User from './models/User.js';
import Universe from './models/Universe.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mori-secret-change-in-production';

// 1. Middleware
app.use(cors());
app.use(express.json());

// 2. Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!');
  console.error('   Make sure you have a .env file in the project root with MONGODB_URI=your_connection_string');
} else {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected!'))
    .catch(err => {
      console.error('❌ MongoDB Connection Error:', err.message);
      console.error('   Connection string starts with:', MONGODB_URI.substring(0, 20) + '...');
    });
}

// 3. Connect to Cloudinary
const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
if (!CLOUDINARY_URL) {
  console.error('❌ CLOUDINARY_URL environment variable is not set!');
  console.error('   Make sure you have a .env file in the project root with CLOUDINARY_URL=cloudinary://...');
} else {
  // Cloudinary auto-configures from CLOUDINARY_URL env var
  cloudinary.api.ping()
    .then(() => console.log('✅ Cloudinary Connected!'))
    .catch(err => {
      console.error('❌ Cloudinary Connection Error:', err.message);
      console.error('   Check your CLOUDINARY_URL credentials');
    });
}

// Auth middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper to create default core node
const createDefaultUniverse = () => ({
  nodes: [
    {
      id: 'core',
      type: 'moriNode',
      position: { x: 0, y: 0 },
      data: { label: 'Me', isCore: true, tilt: 0 },
    },
  ],
  edges: [],
});

// 3. API routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mori Backend is running!' });
});

// Auth: Sign up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    
    const user = new User({ email, password, name: name || '' });
    await user.save();
    
    // Create default universe for new user
    const universe = new Universe({
      userId: user._id,
      ...createDefaultUniverse(),
    });
    await universe.save();
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.status(201).json({
      user: user.toJSON(),
      token,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      user: user.toJSON(),
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Auth: Get current user
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user.toJSON() });
});

// Universe: Get user's universe
app.get('/api/universe', authenticate, async (req, res) => {
  try {
    let universe = await Universe.findOne({ userId: req.user._id });
    
    // Create default universe if none exists
    if (!universe) {
      universe = new Universe({
        userId: req.user._id,
        ...createDefaultUniverse(),
      });
      await universe.save();
    }
    
    res.json({
      nodes: universe.nodes,
      edges: universe.edges,
      updatedAt: universe.updatedAt.getTime(),
    });
  } catch (err) {
    console.error('Get universe error:', err);
    res.status(500).json({ error: 'Server error fetching universe' });
  }
});

// Universe: Save/update user's universe
app.post('/api/universe', authenticate, async (req, res) => {
  try {
    const { nodes, edges, updatedAt } = req.body;
    
    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Nodes array required' });
    }
    
    let universe = await Universe.findOne({ userId: req.user._id });
    
    if (universe) {
      // Simple conflict resolution: latest timestamp wins
      const clientTime = updatedAt || Date.now();
      const serverTime = universe.updatedAt.getTime();
      
      if (clientTime < serverTime) {
        // Client data is older, return server data
        return res.status(409).json({
          conflict: true,
          nodes: universe.nodes,
          edges: universe.edges,
          updatedAt: serverTime,
        });
      }
      
      // Update existing universe
      universe.nodes = nodes;
      universe.edges = edges || [];
      await universe.save();
    } else {
      // Create new universe
      universe = new Universe({
        userId: req.user._id,
        nodes,
        edges: edges || [],
      });
      await universe.save();
    }
    
    res.json({
      nodes: universe.nodes,
      edges: universe.edges,
      updatedAt: universe.updatedAt.getTime(),
    });
  } catch (err) {
    console.error('Save universe error:', err);
    res.status(500).json({ error: 'Server error saving universe' });
  }
});

// ----------------------------------------------------
// 4. Production hosting (Deployment Magic)
// ----------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
