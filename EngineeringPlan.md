# Mori 迭代式实施蓝图（Kinopio + 中心节点锚定）

> 目标：做一个 Kinopio 风格的数字花园，但所有节点在结构上都围绕一个中心节点（Core）相连；视觉是纸质/便利贴而非太空。

## 0. 项目上下文
- **隐喻**：纸质桌面/便利贴拼贴，核心头像是桌面的锚点，其他节点散落但逻辑上都挂在核心上。
- **技术栈**：Vue 3 + Vite + Vue Flow；Bun/Node；Express；MongoDB Atlas；Cloudinary。
- **数据理念（local-first）**：参考 Kinopio 的公开仓库思路，始终本地优先（Local Storage 快速落盘、可离线），其后再与远端同步；即便接入数据库后也保持 local-first。
- **开发命令**：`bun dev`（并行启动 server/client）或进入 `client` 用 `bun dev`。

## 1. 迭代路线（由浅入深）

### 1.0 已有脚手架（基线）
- Vite + Vue 3 + Bun 运行通路已通；Docker 可运行。

### 1.1 Visual Core MVP（无存储，仅交互）
- **要求**：
  - 画布：Kinopio 纸质背景（浅色纸感、淡噪声/网点）；隐藏控件；允许平移缩放。
  - 核心节点：初始化在 (0,0)，特殊样式（头像卡/更醒目便利贴）。
  - 节点：便利贴/纸片风格，手写/随意字体，细阴影，轻微随机旋转（±2°）。
  - 连接点：隐藏。
  - 添加节点：按钮生成新节点，位置在核心周围随机环带；自动创建一条从核心到新节点的浅色虚线（手绘草稿线感）。可以允许节点再连子节点，但默认始终有一条核心连线。
- **输出**：`MoriCanvas.vue` + `MoriNode.vue`，可拖动、可缩放、可添加。

### 1.2 轻量编辑体验
- 节点标题可直接点击编辑（textarea/input）。
- 节点支持删除（小叉/快捷键）。
- 连线保持自动：删除节点自动移除相关边；若有子节点链路，仍保留核心连线或重新连到核心。

### 1.3 本地持久化（Local-first Snapshot）
- 使用 Local Storage 存储完整 `nodes` / `edges` 快照（key 如 `mori:universe`），加载时优先从本地恢复，没有则创建核心节点。
- 监听 Vue Flow 变更，debounce 1–2s 自动写入本地；状态提示 “Saving…” -> “Saved”。
- 可加版本/时间戳，避免老数据覆盖新数据（简单比较 `updatedAt`）。
- 目标：离线可用，刷新不丢。

### 1.4 远端同步（Memory）
- 后端：`Universe` 文档（userId 写死 demo-user），存 `nodes` / `edges`。
- API：`GET /api/universe`（无则返回仅核心节点）；`POST /api/universe` 覆盖保存。
- 同步策略：启动时先用本地数据渲染，再请求远端；若远端比本地新且用户未修改，替换/合并；本地修改后优先写本地，再 debounce 推送远端。冲突策略简单采用“最新时间戳覆盖”即可（MVP）。

### 1.5 媒体扩展
- 节点可上传图片（Cloudinary unsigned）；成功后写入 `node.data.image` 并触发本地/远端保存。

### 1.6 体验打磨
- 对齐/网格吸附开关、轻微抖动动画、选中高光、边线色盘、键盘快捷键（新增/删除/复制）。

## 2. 详细拆解（当前聚焦 1.1）

### 2.1 MoriNode.vue（便利贴卡片）
- Props: `label: string; image?: string; isCore?: boolean`.
- 样式要点：
  - 纸质底：浅米/浅灰背景 + 细噪声/渐变；圆角；细阴影。
  - 手写字体优先（如 Caveat/Handlee），退化到常规无衬线。
  - 轻微随机旋转可通过内联 style 在节点 data 中设置（例如 `data.tilt`），初始创建时生成。
  - 连接点隐藏（Handle opacity 0）。

### 2.2 MoriCanvas.vue（画布 + 逻辑）
- 初始化核心节点（id: `core`, pos (0,0), type: `moriNode`, `isCore: true`）。
- NodeTypes 注册自定义节点。
- 添加按钮：
  - 计算随机环带位置（可配置半径范围，避免太近/太远）。
  - 生成 `tilt` 随机值存 data。
  - 创建节点 + 一条核心虚线边（浅灰/浅褐，虚线）。
- 交互：pan/zoom 开启；连接、更新连线交互禁用；控件隐藏。
- 背景：淡纸色，必要时自定义背景层替代 Vue Flow 默认背景。

### 2.3 Local-first 细节（针对 1.3 / 1.4）
- Local Storage key 建议：`mori:universe:v1`。
- 写入策略：监听 nodes/edges 变化 -> debounce 1–2s -> JSON.stringify 存本地；附 `updatedAt`。
- 读取策略：启动时先读本地；无则生成核心节点；随后异步请求远端，若远端新，则替换/合并（以时间戳为准）。
- 同步 UI：右下角状态 “Saving…”/“Saved”；远端失败不阻塞本地使用，可提示“离线模式”。
- 参考 Kinopio：快速落盘、可离线、UI 反馈及时；我们用 Vue Flow +快照式存储实现同样的体验节奏。

### 2.4 验收标准（1.1）
- 页面加载有核心节点，样式明显。
- 点击添加按钮，节点出现在核心周围随机位置，并被一条虚线连到核心。
- 节点可拖动；画布可平移/缩放。
- UI 无太空/银河视觉元素，整体更像纸质桌面。

## 3. 后续提示模板（给 AI 使用）
- “生成 Kinopio 风格的 Vue Flow 画布，核心节点在中心，添加按钮生成环带位置的新节点并自动用虚线连到核心；节点纸质/手写风格，隐藏 handles。”
