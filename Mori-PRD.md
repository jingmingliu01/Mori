# Mori - Product Requirements Document

> Last Updated: 2025-12-10

## Product Overview

**Mori** is a visual canvas application for organizing thoughts in a "core node + surrounding ideas" format. Users can create, connect, and drag sticky-note-style nodes on an infinite canvas, with support for images and links.

### Core Philosophy
- **Local-first**: Local storage priority, works offline
- **Visual thinking**: Organize ideas visually
- **Simplicity**: Clean interactions, no over-engineering

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3 + Vite + Vue Flow |
| Backend | Express.js + Bun |
| Database | MongoDB Atlas |
| Media | Cloudinary (image upload) |
| Auth | JWT |

---

## Feature List

### 1. Canvas

| Feature | Status | Description |
|---------|--------|-------------|
| Infinite canvas | ✅ Done | Pannable and zoomable canvas |
| Paper background | ✅ Done | Cream gradient + dot pattern |
| Zoom control | ✅ Done | Slider control 20%-100%, 100% = fit all |
| Center button | ✅ Done | Click to reset view to core node |
| Double-click create | ✅ Done | Double-click empty space to create new node |
| Image paste | ✅ Done | Paste image to auto-create node and upload |
| Multi-canvas support | ✅ Done | Users can have multiple canvases, switch via dropdown |
| Canvas management | ✅ Done | Create, rename, delete canvases |
| Offline multi-canvas | ✅ Done | Multi-canvas management works when logged out/offline |

### 2. Node

| Feature | Status | Description |
|---------|--------|-------------|
| Sticky note style | ✅ Done | Paper gradient, rounded corners, shadow |
| Handwritten font | ✅ Done | Caveat, Handlee fonts |
| Random tilt | ✅ Done | ±2° random rotation |
| Core node | ✅ Done | Gold style, cannot be deleted |
| Drag to move | ✅ Done | Auto-save position after drag |
| Double-click edit | ✅ Done | Double-click text to enter edit mode |
| Delete node | ✅ Done | Toolbar delete button |
| Image display | ✅ Done | Support displaying uploaded images |
| Image upload | ✅ Done | 📷 button to upload images to Cloudinary |
| URL detection | ✅ Done | Detect URLs and display as clickable links |
| Image URL rendering | ✅ Done | Detect image URLs and render directly as images |

### 3. Edge (Connection)

| Feature | Status | Description |
|---------|--------|-------------|
| Dashed connection | ✅ Done | Gray dashed line style |
| Auto-connect | ✅ Done | New nodes auto-connect to core |
| Manual connect | ✅ Done | Drag from node handle to create connection |
| Delete cleanup | ✅ Done | Clean up related connections when deleting node |

### 4. Persistence

| Feature | Status | Description |
|---------|--------|-------------|
| Local storage | ✅ Done | LocalStorage auto-save |
| Debounced save | ✅ Done | 300ms debounce to avoid frequent writes |
| Status indicator | ✅ Done | Display Saving/Saved/Syncing/Synced/Offline/Local-first |
| Guest storage | ✅ Done | Guest user data stored only in localStorage |
| Post-login sync | ✅ Done | Logged-in users use local-first strategy, sync to MongoDB |
| Data sanitization | ✅ Done | Strip Vue Flow runtime properties before saving, store only essential data |

### 5. Cloud Sync

| Feature | Status | Description |
|---------|--------|-------------|
| User registration | ✅ Done | Email + password registration |
| User login | ✅ Done | JWT token authentication |
| Token validation | ✅ Done | Validate token on app init, auto-logout if invalid |
| Cloud storage | ✅ Done | MongoDB Atlas storage |
| Auto sync | ✅ Done | Auto-sync all canvases after login |
| Full sync | ✅ Done | Sync all local canvases on login: ID match uses timestamp comparison, new local canvases push to cloud |
| Multi-canvas sync | ✅ Done | Each canvas syncs independently, auto-save on canvas switch |
| Offline mode | ✅ Done | Full multi-canvas functionality offline, auto-sync after login |
| User data isolation | ✅ Done | Clear local canvas cache on logout to prevent data leakage to next user |

### 6. Media

| Feature | Status | Description |
|---------|--------|-------------|
| Cloudinary upload | ✅ Done | Client-side direct upload with unsigned preset |
| Image preview | ✅ Done | Display image thumbnail in node |
| Image delete | ✅ Done | Show delete button on hover |
| Paste upload | ✅ Done | Paste image on canvas to auto-upload |

### 7. Developer Tools

| Feature | Status | Description |
|---------|--------|-------------|
| Comprehensive logging | ✅ Done | Colored console logs covering Auth/Canvas/Node/Edge/Sync/Image operations |
| Log levels | ✅ Done | info/success/warn/error four-level logging |
| Timestamps | ✅ Done | ISO format timestamps for debugging |

---

## User Interface

### Layout
```
┌─────────────────────────────────────────────────┐
│ [Canvas ▼][+]  [Sign in]         [+ Add node]   │
├─────────────────────────────────────────────────┤
│                                                 │
│                   [Core: Me]                    │
│                  /    |    \                    │
│           [Idea 1] [Idea 2] [Idea 3]           │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│                    [====○====] 75%  [◎]         │
│                                    [Saved ✓]    │
└─────────────────────────────────────────────────┘
```

### Node Styles
- **Regular node**: Cream paper background
- **Core node**: Gold/amber background
- **Selected state**: Blue glow border

---

## API Endpoints

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | User registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Get current user |

### Canvas (Multi-Canvas)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/universes` | Get all user canvases |
| POST | `/api/universes` | Create new canvas |
| GET | `/api/universe/:id` | Get specific canvas data |
| PUT | `/api/universe/:id` | Update specific canvas |
| DELETE | `/api/universe/:id` | Delete canvas |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |

---

## Data Models

### User
```javascript
{
  _id: ObjectId,
  email: String (unique),
  password: String (hashed),
  name: String,
  createdAt: Date
}
```

### Universe (Canvas)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref User),  // User can have multiple canvases
  name: String,                 // Canvas name
  nodes: [{
    id: String,
    type: 'moriNode',
    position: { x: Number, y: Number },
    data: {
      label: String,
      tilt: Number,
      isCore: Boolean,
      image: String (URL)
    }
  }],
  edges: [{
    id: String,
    source: String,
    target: String,
    style: Object
  }],
  createdAt: Date,
  updatedAt: Date
}
```

---

## Environment Configuration

### .env (project root)
```bash
# MongoDB
MONGODB_URI=mongodb+srv://...

# Auth
JWT_SECRET=your-secret-key

# Cloudinary
CLOUDINARY_URL=cloudinary://...
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-preset

# API
VITE_API_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

---

## Roadmap

### Near-term (Next)
- [x] Image URL auto-detection and rendering
- [ ] Keyboard shortcuts (add/delete/copy)

### Mid-term (Later)
- [ ] Connection line color selection
- [ ] Node shake animation

### Long-term (Future)
- [ ] Collaborative editing
- [ ] Export to image/PDF
- [ ] Mobile adaptation

---

## Changelog

### 2025-12-08 (v8)
- **User data isolation fix**: Clear local canvas cache (`mori:universe:v2`) on logout
  - Prevents different users on the same browser from seeing each other's data
  - Login sync logic unchanged: local canvases push to cloud, ID-matched canvases use timestamp comparison

### 2025-12-08 (v7)
- **Token validation**: Auto-validate JWT token from localStorage on app init
  - Call `/api/auth/me` to verify token validity
  - Invalid tokens auto-cleared, user shown as logged out
  - Added `initializing` state to prevent UI flicker
- **Comprehensive logging system**: New `logger.js` utility with colored console logs for important operations
  - Auth: login, logout, registration, token validation
  - Canvas: create, switch, rename, delete canvas
  - Node: add, delete nodes
  - Edge: create connections
  - Sync: sync operations
  - Image: image paste upload

### 2024-12-08 (v6)
- **Offline multi-canvas support**: Full multi-canvas management when logged out/offline
- Added local canvas management functions: `generateLocalCanvasId()`, `getAllLocalCanvases()`, `saveLocalCanvas()`, `deleteLocalCanvas()`, `renameLocalCanvas()`, `replaceLocalCanvasId()`
- Upgraded login sync logic: sync all local canvases to cloud
  - ID-matched canvases: compare timestamps, newer wins
  - New local canvases (local- prefix): push to cloud, update local ID
  - Cloud-only canvases: download to local
- Removed `isLocalEmpty()` empty canvas check logic

### 2024-12-08 (v5)
- **Multi-canvas support**: Users can have multiple canvases, switch via dropdown menu
- Added CanvasSwitcher component: create, rename, delete canvases
- Updated Universe schema: added name, createdAt fields, removed userId unique constraint
- New API endpoints: GET/POST `/api/universes`, GET/PUT/DELETE `/api/universe/:id`
- localStorage upgraded to v2 format, supports multi-canvas caching

### 2024-12-08 (v4)
- Optimized data storage: Added `sanitizeNode()` and `sanitizeEdge()` functions
- Strip Vue Flow runtime properties before saving (dimensions, handleBounds, selected, dragging, etc.)
- Strip edge sourceNode/targetNode duplicate data, ~80-90% storage reduction
- Node saves only: id, type, position, data (excluding isNew)
- Edge saves only: id, source, target, style

### 2024-12-08 (v3)
- Added post-login auto-sync: Trigger `syncAfterAuth()` on user login, compare local vs cloud timestamps
- Conflict resolution strategy: Newer timestamp wins (local >= cloud pushes local data, otherwise pull cloud data)
- Added auth state watcher: `watch(auth.isAuthenticated)` to detect login state changes

### 2024-12-08 (v2)
- Fixed Mongoose middleware bug: User.js and Universe.js pre('save') hooks no longer use next() callback (Mongoose 6+ doesn't pass next function)
- Clarified local-first strategy: Guest users use localStorage only, logged-in users use local-first + MongoDB cloud sync
- Note: MongoDB connection string must include database name (e.g., `/mori`), otherwise defaults to `test` database

### 2024-12-08
- Completed core feature development
- Fixed node drag position not saving issue
- Fixed zoom slider not working issue
- Added Cloudinary connection check
- Unified .env configuration to root directory
- Added image URL auto-detection and rendering feature (extension quick check + image load detection)
