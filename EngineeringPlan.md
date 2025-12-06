# Mori Iterative Implementation Blueprint (Kinopio + anchored core node)

> Goal: build a Kinopio-style digital garden where every node is structurally connected to a central core; visuals lean paper/sticky-note instead of space/sci-fi.

## 0. Project context
- **Metaphor**: paper desktop / sticky-note collage; the core avatar is the anchor and other nodes scatter but all connect back to the core.
- **Stack**: Vue 3 + Vite + Vue Flow; Bun/Node; Express; MongoDB Atlas; Cloudinary.
- **Data philosophy (local-first)**: follow Kinopio's approach: always persist locally first (Local Storage for quick, offline writes), then sync to the server; even with a database keep the local-first behavior.
- **Dev commands**: `bun dev` (runs server/client in parallel) or `bun dev` inside `client`.

## 1. Iteration path (simple to deep)

### 1.0 Existing scaffolding (baseline)
- Vite + Vue 3 + Bun path is working; Docker runs.

### 1.1 Visual Core MVP (no storage, interactions only)
- **Requirements**:
  - Canvas: Kinopio paper background (light paper texture, subtle noise/dots); hide controls; allow pan and zoom.
  - Core node: initialize at (0,0) with a special style (avatar card / more prominent sticky note).
  - Nodes: sticky-note/paper style, handwriting/casual fonts, soft shadows, slight random rotation (about +-2 degrees).
  - Handles: hidden.
  - Add node: button spawns a new node in a random orbit band around the core; automatically create a light dashed line from the core to the new node (hand-drawn sketch vibe). Allow nodes to connect to children, but always keep a core connection by default.
- **Output**: `MoriCanvas.vue` + `MoriNode.vue` with drag, zoom, and add working.

### 1.2 Lightweight editing experience
- Node titles are directly editable (textarea/input).
- Nodes can be deleted (small x / shortcut).
- Connections stay automatic: deleting a node removes related edges; if a child chain exists, keep or reroute a core edge.

### 1.3 Local persistence (local-first snapshot)
- Use Local Storage to store full `nodes` / `edges` snapshots (key like `mori:universe`); load from local first, else create the core node.
- Watch Vue Flow changes, debounce 1-2s, then write to local; status indicator "Saving..." -> "Saved".
- Optional version/timestamp to avoid old data overwriting new (compare `updatedAt`).
- Goal: usable offline, survives refresh.

### 1.4 Remote sync (Memory)
- Backend: `Universe` document (userId fixed to demo-user) storing `nodes` / `edges`.
- API: `GET /api/universe` (return core-only if none); `POST /api/universe` overwrites.
- Sync strategy: render from local first, then request remote; if remote is newer and the user has not modified locally, replace/merge; local edits write locally first, then debounce push remote. Simple conflict strategy: "latest timestamp wins" for MVP.

### 1.5 Media extension
- Nodes can upload images (Cloudinary unsigned); on success write to `node.data.image` and trigger local/remote saves.

### 1.6 Polish
- Alignment/grid snap toggle, slight jitter animation, selection highlight, edge color palette, keyboard shortcuts (add/delete/copy).

## 2. Detailed breakdown (current focus: 1.1)

### 2.1 MoriNode.vue (sticky note card)
- Props: `label: string; image?: string; isCore?: boolean`.
- Style notes:
  - Paper base: light cream/gray with fine noise/gradient; rounded corners; soft shadow.
  - Prefer handwriting fonts (e.g., Caveat/Handlee), fall back to standard sans-serif.
  - Slight random rotation via inline style in node data (e.g., `data.tilt`) set on creation.
  - Hide handles (handle opacity 0).

### 2.2 MoriCanvas.vue (canvas + logic)
- Initialize core node (id: `core`, pos (0,0), type: `moriNode`, `isCore: true`).
- Register custom node types.
- Add button:
  - Compute random orbit position (configurable radius band to avoid too near/far).
  - Generate random `tilt` and store in data.
  - Create node + one dashed edge from the core (light gray/tan, dashed).
- Interactions: pan/zoom on; disable connect/update interactions; hide controls.
- Background: light paper tone; add custom background layer if needed instead of Vue Flow default.

### 2.3 Local-first details (for 1.3 / 1.4)
- Local Storage key suggestion: `mori:universe:v1`.
- Write strategy: watch nodes/edges changes -> debounce 1-2s -> JSON.stringify to local; include `updatedAt`.
- Read strategy: on start, read local; if missing, generate core node; then async request remote and replace/merge if remote is newer (timestamp based).
- Sync UI: bottom-right status "Saving..."/"Saved"; remote failure should not block local use; optionally show "offline mode".
- Kinopio reference: fast persistence, offline friendly, timely UI feedback; replicate with Vue Flow + snapshot storage.

### 2.4 Acceptance criteria (1.1)
- Page loads with a styled core node.
- Clicking the add button spawns a node in a random orbit around the core with a dashed edge to the core.
- Nodes are draggable; canvas supports pan/zoom.
- Visuals avoid space/galaxy motifs; overall looks like a paper desk.

## 3. Prompt template (for AI use)
- "Generate a Kinopio-style Vue Flow canvas with a center core node. The add button creates a new node in a ring position and automatically connects it to the core with a dashed line; nodes are paper/handwriting styled with handles hidden."
