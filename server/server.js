import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import User from './models/User.js';
import Universe from './models/Universe.js';

// ============================================
// Configuration & Constants
// ============================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret validation
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is not set!');
  console.error('   Make sure you have a .env file in the project root with JWT_SECRET=...');
  process.exit(1);
} else {
  console.log('✅ JWT_SECRET environment variable is set!');
}

// ============================================
// External Services Connection
// ============================================

// MongoDB Atlas
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

// Cloudinary
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

// ============================================
// Middleware
// ============================================

// CORS - Cross-Origin Resource Sharing
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (
      origin === 'http://localhost:3001' ||
      origin.endsWith('.netlify.app')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// JSON body parser
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// Auth Middleware (Route-level)
// ============================================

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

// ============================================
// Helper Functions
// ============================================

// Create default core node for new universe
const createDefaultUniverse = (name = 'My First Canvas') => ({
  name,
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

// ============================================
// Routes: Static Pages
// ============================================

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// Routes: Health Check
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mori Backend is running!' });
});

// ============================================
// Routes: Authentication
// ============================================

// Sign up
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
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      user: user.toJSON(),
      token,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Login
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

// Get current user (requires auth)
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user.toJSON() });
});

// ============================================
// Routes: Universe (Canvas) CRUD
// ============================================

// List all user's canvases (metadata only)
app.get('/api/universes', authenticate, async (req, res) => {
  try {
    const universes = await Universe.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .select('_id name updatedAt createdAt nodes');
    
    // Return metadata with node count
    const list = universes.map(u => ({
      _id: u._id,
      name: u.name,
      updatedAt: u.updatedAt.getTime(),
      createdAt: u.createdAt?.getTime() || u.updatedAt.getTime(),
      nodeCount: u.nodes?.length || 0,
    }));
    
    res.json(list);
  } catch (err) {
    console.error('List universes error:', err);
    res.status(500).json({ error: 'Server error listing canvases' });
  }
});

// Create new canvas
app.post('/api/universes', authenticate, async (req, res) => {
  try {
    const { name, nodes, edges } = req.body;
    
    const universe = new Universe({
      userId: req.user._id,
      name: name || 'Untitled',
      nodes: nodes || createDefaultUniverse().nodes,
      edges: edges || [],
    });
    await universe.save();
    
    res.status(201).json({
      _id: universe._id,
      name: universe.name,
      nodes: universe.nodes,
      edges: universe.edges,
      updatedAt: universe.updatedAt.getTime(),
      createdAt: universe.createdAt.getTime(),
    });
  } catch (err) {
    console.error('Create universe error:', err);
    res.status(500).json({ error: 'Server error creating canvas' });
  }
});

// Get specific canvas
app.get('/api/universe/:id', authenticate, async (req, res) => {
  try {
    const universe = await Universe.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    
    if (!universe) {
      return res.status(404).json({ error: 'Canvas not found' });
    }
    
    res.json({
      _id: universe._id,
      name: universe.name,
      nodes: universe.nodes,
      edges: universe.edges,
      updatedAt: universe.updatedAt.getTime(),
      createdAt: universe.createdAt?.getTime() || universe.updatedAt.getTime(),
    });
  } catch (err) {
    console.error('Get universe error:', err);
    res.status(500).json({ error: 'Server error fetching canvas' });
  }
});

// Update specific canvas
app.put('/api/universe/:id', authenticate, async (req, res) => {
  try {
    const { name, nodes, edges } = req.body;
    
    const universe = await Universe.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    
    if (!universe) {
      return res.status(404).json({ error: 'Canvas not found' });
    }
    
    // Update fields if provided
    if (name !== undefined) universe.name = name;
    if (nodes !== undefined) universe.nodes = nodes;
    if (edges !== undefined) universe.edges = edges;
    
    await universe.save();
    
    res.json({
      _id: universe._id,
      name: universe.name,
      nodes: universe.nodes,
      edges: universe.edges,
      updatedAt: universe.updatedAt.getTime(),
    });
  } catch (err) {
    console.error('Update universe error:', err);
    res.status(500).json({ error: 'Server error updating canvas' });
  }
});

// Delete canvas
app.delete('/api/universe/:id', authenticate, async (req, res) => {
  try {
    const result = await Universe.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    
    if (!result) {
      return res.status(404).json({ error: 'Canvas not found' });
    }
    
    res.json({ success: true, message: 'Canvas deleted' });
  } catch (err) {
    console.error('Delete universe error:', err);
    res.status(500).json({ error: 'Server error deleting canvas' });
  }
});

// ============================================
// Routes: Fallback (SPA Support)
// ============================================
if (process.env.NODE_ENV === 'production') {
  // Catch-all route for production
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
