# Mori - Product Requirements Document

> 最后更新：2025-12-08

## 产品概述

**Mori** 是一个 Kinopio 风格的可视化画布应用，用于以「核心节点 + 周边想法」的形式组织思维。用户可以在无限画布上创建、连接、拖拽便签式节点，支持图片和链接。

### 核心理念
- **Local-first**：优先本地存储，离线可用
- **Visual thinking**：以视觉化方式组织想法
- **Simplicity**：简洁的交互，无过度设计

---

## 技术栈

| 层级 | 技术 |
|------|------|
| Frontend | Vue 3 + Vite + Vue Flow |
| Backend | Express.js + Bun |
| Database | MongoDB Atlas |
| Media | Cloudinary (图片上传) |
| Auth | JWT |

---

## 功能清单

### 1. 画布 (Canvas)

| 功能 | 状态 | 描述 |
|------|------|------|
| 无限画布 | ✅ Done | 可平移、缩放的画布 |
| 纸质背景 | ✅ Done | 奶油色渐变 + 点阵图案 |
| 缩放控制 | ✅ Done | 滑块控制 20%-100%，100%=fit all |
| 中心按钮 | ✅ Done | 点击重置视图到核心节点 |
| 双击创建 | ✅ Done | 双击空白处创建新节点 |
| 图片粘贴 | ✅ Done | 粘贴图片自动创建节点并上传 |
| 多画布支持 | ✅ Done | 用户可拥有多个画布，通过下拉菜单切换 |
| 画布管理 | ✅ Done | 创建、重命名、删除画布 |
| 离线多画布 | ✅ Done | 未登录/离线状态也支持多画布管理 |

### 2. 节点 (Node)

| 功能 | 状态 | 描述 |
|------|------|------|
| 便签样式 | ✅ Done | 纸质渐变、圆角、阴影 |
| 手写字体 | ✅ Done | Caveat, Handlee 字体 |
| 随机倾斜 | ✅ Done | ±2° 随机旋转 |
| 核心节点 | ✅ Done | 金色样式，不可删除 |
| 拖拽移动 | ✅ Done | 拖拽后自动保存位置 |
| 双击编辑 | ✅ Done | 双击文字进入编辑模式 |
| 删除节点 | ✅ Done | 工具栏删除按钮 |
| 图片显示 | ✅ Done | 支持显示上传的图片 |
| 图片上传 | ✅ Done | 📷 按钮上传图片到 Cloudinary |
| URL 识别 | ✅ Done | 识别 URL 并显示为可点击链接 |
| 图片 URL 渲染 | ✅ Done | 识别图片 URL 并直接渲染为图片 |

### 3. 连接 (Edge)

| 功能 | 状态 | 描述 |
|------|------|------|
| 虚线连接 | ✅ Done | 灰色虚线样式 |
| 自动连接 | ✅ Done | 新节点自动连接到核心 |
| 手动连接 | ✅ Done | 从节点手柄拖拽创建连接 |
| 删除清理 | ✅ Done | 删除节点时清理相关连接 |

### 4. 持久化 (Persistence)

| 功能 | 状态 | 描述 |
|------|------|------|
| 本地存储 | ✅ Done | LocalStorage 自动保存 |
| 防抖保存 | ✅ Done | 300ms 防抖避免频繁写入 |
| 状态指示 | ✅ Done | 显示 Saving/Saved/Syncing/Synced/Offline/Local-first |
| 未登录存储 | ✅ Done | 未登录用户数据仅存储在 localStorage |
| 登录后同步 | ✅ Done | 登录用户采用 local-first 策略，本地优先并同步到 MongoDB |
| 数据精简 | ✅ Done | 保存前剔除 Vue Flow 运行时属性，仅存储必要数据 |

### 5. 云同步 (Sync)

| 功能 | 状态 | 描述 |
|------|------|------|
| 用户注册 | ✅ Done | 邮箱 + 密码注册 |
| 用户登录 | ✅ Done | JWT token 认证 |
| Token 验证 | ✅ Done | 应用初始化时验证 token 有效性，无效则自动登出 |
| 云端存储 | ✅ Done | MongoDB Atlas 存储 |
| 自动同步 | ✅ Done | 登录后自动同步所有画布到云端 |
| 全量同步 | ✅ Done | 登录时同步所有本地画布：ID匹配则时间戳决定胜负，本地新画布推送到云端 |
| 多画布同步 | ✅ Done | 每个画布独立同步，切换画布时自动保存 |
| 离线模式 | ✅ Done | 离线时完整多画布功能，登录后自动同步 |
| 用户数据隔离 | ✅ Done | 登出时清除本地画布缓存，防止数据泄露给下一个用户 |

### 6. 媒体 (Media)

| 功能 | 状态 | 描述 |
|------|------|------|
| Cloudinary 上传 | ✅ Done | 客户端直传 unsigned preset |
| 图片预览 | ✅ Done | 节点内显示图片缩略图 |
| 图片删除 | ✅ Done | 悬停显示删除按钮 |
| 粘贴上传 | ✅ Done | 画布上粘贴图片自动上传 |

### 7. 开发者工具 (Developer Tools)

| 功能 | 状态 | 描述 |
|------|------|------|
| 综合日志 | ✅ Done | 彩色控制台日志，覆盖 Auth/Canvas/Node/Edge/Sync/Image 操作 |
| 日志分级 | ✅ Done | info/success/warn/error 四级日志 |
| 时间戳 | ✅ Done | ISO 格式时间戳便于调试 |

---

## 用户界面

### 布局
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

### 节点样式
- **普通节点**：奶油色纸质背景
- **核心节点**：金色/琥珀色背景
- **选中状态**：蓝色光晕边框

---

## API 接口

### 认证

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth/signup` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/me` | 获取当前用户 |

### 画布 (Multi-Canvas)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/universes` | 获取用户所有画布列表 |
| POST | `/api/universes` | 创建新画布 |
| GET | `/api/universe/:id` | 获取指定画布数据 |
| PUT | `/api/universe/:id` | 更新指定画布 |
| DELETE | `/api/universe/:id` | 删除画布 |

### 系统

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |

---

## 数据模型

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
  userId: ObjectId (ref User),  // 用户可拥有多个画布
  name: String,                 // 画布名称
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

## 环境配置

### .env (项目根目录)
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

## 待开发功能 (Roadmap)

### 近期 (Next)
- [x] 图片 URL 自动识别与渲染
- [ ] 键盘快捷键 (add/delete/copy)

### 中期 (Later)
- [ ] 连接线颜色选择
- [ ] 节点抖动动画
- [ ] 多画布支持

### 远期 (Future)
- [ ] 协作编辑
- [ ] 导出为图片/PDF
- [ ] 移动端适配

---

## 更新日志

### 2025-12-08 (v8)
- **用户数据隔离修复**：登出时清除本地画布缓存 (`mori:universe:v2`)
  - 防止不同用户在同一浏览器上看到彼此的数据
  - 登录同步逻辑不变：本地画布推送到云端，ID 匹配的画布按时间戳决定胜负

### 2025-12-08 (v7)
- **Token 验证**：应用初始化时自动验证 localStorage 中的 JWT token
  - 调用 `/api/auth/me` 验证 token 有效性
  - 无效 token 自动清除，用户显示为未登录状态
  - 新增 `initializing` 状态，防止 UI 闪烁
- **综合日志系统**：新增 `logger.js` 工具，为重要操作添加彩色控制台日志
  - Auth 类：登录、登出、注册、token 验证
  - Canvas 类：创建、切换、重命名、删除画布
  - Node 类：添加、删除节点
  - Edge 类：创建连接
  - Sync 类：同步操作
  - Image 类：图片粘贴上传

### 2024-12-08 (v6)
- **离线多画布支持**：未登录/离线状态也支持完整的多画布管理
- 新增本地画布管理函数：`generateLocalCanvasId()`, `getAllLocalCanvases()`, `saveLocalCanvas()`, `deleteLocalCanvas()`, `renameLocalCanvas()`, `replaceLocalCanvasId()`
- 登录同步逻辑升级：同步所有本地画布到云端
  - ID 匹配的画布：比较时间戳，较新者胜
  - 本地新画布（local-前缀）：推送到云端，更新本地 ID
  - 云端独有画布：下载到本地
- 移除 `isLocalEmpty()` 空画布检查逻辑

### 2024-12-08 (v5)
- **多画布支持**：用户可拥有多个画布，通过下拉菜单切换
- 新增 CanvasSwitcher 组件：创建、重命名、删除画布
- 更新 Universe schema：添加 name, createdAt 字段，移除 userId unique 约束
- 新增 API endpoints：GET/POST `/api/universes`，GET/PUT/DELETE `/api/universe/:id`
- localStorage 升级到 v2 格式，支持多画布缓存

### 2024-12-08 (v4)
- 优化数据存储：新增 `sanitizeNode()` 和 `sanitizeEdge()` 函数
- 保存前剔除 Vue Flow 运行时属性（dimensions, handleBounds, selected, dragging 等）
- 剔除边的 sourceNode/targetNode 重复数据，存储减少约 80-90%
- Node 仅保存：id, type, position, data（不含 isNew）
- Edge 仅保存：id, source, target, style

### 2024-12-08 (v3)
- 新增登录后自动同步功能：用户登录时触发 `syncAfterAuth()`，比较本地与云端时间戳
- 冲突解决策略：较新时间戳优先（本地 >= 云端则推送本地数据，否则拉取云端数据）
- 添加 auth 状态监听：`watch(auth.isAuthenticated)` 检测登录状态变化

### 2024-12-08 (v2)
- 修复 Mongoose middleware bug：User.js 和 Universe.js 的 pre('save') 钩子不再使用 next() 回调（Mongoose 6+ 不再传递 next 函数）
- 明确 local-first 策略：未登录用户仅使用 localStorage，登录用户本地优先 + MongoDB 云同步
- 注意：MongoDB 连接字符串需包含数据库名（如 `/mori`），否则默认使用 `test` 数据库

### 2024-12-08
- 完成核心功能开发
- 修复节点拖拽位置不保存的问题
- 修复缩放滑块不工作的问题
- 添加 Cloudinary 连接检查
- 统一 .env 配置到根目录
- 新增图片 URL 自动检测与渲染功能 (扩展名快速检测 + 图片加载检测)

