<script setup>
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import MoriNode from './MoriNode.vue'
import { useCloudinary } from '../composables/useCloudinary'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const API_BASE = import.meta.env.VITE_API_URL || ''
const STORAGE_KEY = 'mori:universe:v1'

const nodes = ref([])
const edges = ref([])
const nodeCount = ref(1)
const saveState = ref('idle') // idle | saving | saved | syncing | synced | offline
const zoomPercent = ref(100)
const nodeTypes = computed(() => ({ moriNode: MoriNode }))
const viewportState = ref({ x: 0, y: 0, zoom: 1 })
let restoring = false
let localUpdatedAt = ref(0)
const { fitView, setViewport, onViewportChange, screenToFlowCoordinate } = useVueFlow()

// Inject auth from App.vue
const auth = inject('auth', { isAuthenticated: ref(false), getAuthHeaders: () => ({}) })

// Cloudinary for image uploads
const { uploadImage, isConfigured: isCloudinaryConfigured } = useCloudinary()

const defaultEdgeOptions = {
  style: {
    stroke: '#95a1b3',
    strokeDasharray: '6 6',
    strokeWidth: 1.3,
    opacity: 0.9,
  },
}

const ensureCore = (list) => {
  if (!list.some((n) => n.id === 'core')) {
    list.unshift({
      id: 'core',
      type: 'moriNode',
      position: { x: 0, y: 0 },
      data: { label: 'Me', isCore: true, tilt: 0 },
    })
  }
  return list
}

// Strip Vue Flow runtime properties from nodes before saving
const sanitizeNode = (node) => ({
  id: node.id,
  type: node.type,
  position: { x: node.position.x, y: node.position.y },
  data: {
    label: node.data.label,
    tilt: node.data.tilt,
    ...(node.data.isCore && { isCore: true }),
    ...(node.data.image && { image: node.data.image }),
    ...(node.data.url && { url: node.data.url }),
    // Exclude isNew - it's temporary UI state
  },
})

// Strip Vue Flow runtime properties from edges before saving
const sanitizeEdge = (edge) => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  style: edge.style,
})

const loadLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    localUpdatedAt.value = parsed.updatedAt || 0
    return {
      nodes: ensureCore(parsed.nodes || []),
      edges: parsed.edges || [],
      updatedAt: parsed.updatedAt || 0,
    }
  } catch (err) {
    console.warn('Failed to load local data', err)
    return null
  }
}

// Remote sync functions
const fetchRemote = async () => {
  if (!auth.isAuthenticated.value) return null
  try {
    const res = await fetch(`${API_BASE}/api/universe`, {
      headers: auth.getAuthHeaders(),
    })
    if (!res.ok) throw new Error('Failed to fetch')
    return await res.json()
  } catch (err) {
    console.warn('Failed to fetch remote:', err)
    return null
  }
}

const pushRemote = async () => {
  if (!auth.isAuthenticated.value) return
  try {
    const res = await fetch(`${API_BASE}/api/universe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.getAuthHeaders(),
      },
      body: JSON.stringify({
        nodes: nodes.value.map(sanitizeNode),
        edges: edges.value.map(sanitizeEdge),
        updatedAt: localUpdatedAt.value,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      if (data.conflict) {
        // Server has newer data - could prompt user, for now just log
        console.warn('Conflict: server has newer data')
      }
    }
  } catch (err) {
    console.warn('Failed to push remote:', err)
  }
}

// Sync after user signs in - handles local-first with timestamp conflict resolution
const syncAfterAuth = async () => {
  if (!auth.isAuthenticated.value) return
  
  saveState.value = 'syncing'
  restoring = true
  
  try {
    const remote = await fetchRemote()
    
    if (!remote) {
      // No remote data exists, push local to cloud
      await pushRemote()
      saveState.value = 'synced'
      setTimeout(() => (saveState.value = 'idle'), 1000)
      return
    }
    
    // Compare timestamps - newer wins
    if (localUpdatedAt.value >= remote.updatedAt) {
      // Local is newer or same, push local to cloud
      await pushRemote()
      saveState.value = 'synced'
    } else {
      // Remote is newer, use remote data
      nodes.value = ensureCore(remote.nodes || [])
      edges.value = remote.edges || []
      localUpdatedAt.value = remote.updatedAt
      recalcNodeCount(nodes.value)
      // Save remote data to localStorage (already sanitized from server)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ nodes: remote.nodes, edges: remote.edges, updatedAt: localUpdatedAt.value }),
      )
      saveState.value = 'synced'
      setTimeout(fitAll, 100)
    }
    
    setTimeout(() => (saveState.value = 'idle'), 1000)
  } catch (err) {
    console.warn('Sync after auth failed:', err)
    saveState.value = 'offline'
  } finally {
    restoring = false
  }
}

const recalcNodeCount = (list) => {
  const numericIds = list
    .map((n) => {
      const match = `${n.id}`.match(/node-(\d+)/)
      return match ? Number(match[1]) : 0
    })
    .filter(Boolean)
  nodeCount.value = numericIds.length ? Math.max(...numericIds) + 1 : 1
}

const randomOrbitPosition = () => {
  const base = Math.min(window.innerWidth, window.innerHeight)
  const min = Math.max(140, base * 0.16)
  const max = Math.max(220, base * 0.26)
  const radius = min + Math.random() * (max - min)
  const angle = Math.random() * Math.PI * 2
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

const randomTilt = () => Number((Math.random() * 4 - 2).toFixed(2))

const fitAll = () => {
  // Fit all content, then set zoom to 100%
  fitView({ duration: 350, padding: 0.4, maxZoom: 1 })
  // After fit animation, ensure we're at 100%
  setTimeout(() => {
    zoomPercent.value = 100
    setViewport({
      x: viewportState.value.x,
      y: viewportState.value.y,
      zoom: 1
    }, { duration: 150 })
  }, 360)
}

const recenter = () => {
  // Center on core at 100% zoom
  fitView({ duration: 260, padding: 0.4, maxZoom: 1 })
  setTimeout(() => {
    zoomPercent.value = 100
    setViewport({
      x: viewportState.value.x,
      y: viewportState.value.y,
      zoom: 1
    }, { duration: 150 })
  }, 270)
}

const handleConnect = (connection) => {
  if (!connection?.source || !connection?.target || connection.source === connection.target) return
  const { source, target } = connection

  const id = `${source}-${target}-${Date.now()}`
  edges.value = [
    ...edges.value,
    {
      id,
      source,
      target,
      style: defaultEdgeOptions.style,
    },
  ]
  saveState.value = 'saving'
  setTimeout(fitAll, 120)
}

let isSliderDragging = false

const setZoomPercent = (val) => {
  const clamped = Math.min(100, Math.max(20, Number(val)))
  zoomPercent.value = clamped
  isSliderDragging = true
  
  // Update viewport with new zoom level
  const currentViewport = viewportState.value
  setViewport({
    x: currentViewport.x,
    y: currentViewport.y,
    zoom: clamped / 100
  }, { duration: 80 })
  
  // Reset flag after zoom animation completes
  setTimeout(() => { isSliderDragging = false }, 100)
}

const handleWheelPan = (event) => {
  if (event.ctrlKey || event.metaKey) return
  event.preventDefault()
  const z = viewportState.value.zoom || 1
  const next = {
    x: viewportState.value.x - event.deltaX / z,
    y: viewportState.value.y - event.deltaY / z,
    zoom: z,
  }
  setViewport(next, { duration: 0 })
}

const addNode = () => {
  const id = `node-${nodeCount.value}`
  const label = `Idea ${nodeCount.value}`
  nodeCount.value += 1
  const position = randomOrbitPosition()

  nodes.value = [
    ...nodes.value,
    {
      id,
      type: 'moriNode',
      position,
      data: { label, tilt: randomTilt() },
    },
  ]

  edges.value = [
    ...edges.value,
    {
      id: `core-${id}`,
      source: 'core',
      target: id,
      style: defaultEdgeOptions.style,
    },
  ]

  saveState.value = 'saving'
  persistLocal()
}

const addNodeAtPosition = (position, options = {}) => {
  const id = `node-${nodeCount.value}`
  nodeCount.value += 1

  const newNode = {
    id,
    type: 'moriNode',
    position,
    data: {
      label: options.label || 'type or paste url',
      tilt: randomTilt(),
      isNew: true, // Flag to auto-focus for editing
      ...(options.image && { image: options.image }),
      ...(options.url && { url: options.url }),
    },
  }

  nodes.value = [...nodes.value, newNode]

  // Create edge to core
  edges.value = [
    ...edges.value,
    {
      id: `core-${id}`,
      source: 'core',
      target: id,
      style: defaultEdgeOptions.style,
    },
  ]

  saveState.value = 'saving'
  persistLocal()
  
  return id
}

let lastClickTime = 0
const handlePaneClick = (event) => {
  const now = Date.now()
  const timeDiff = now - lastClickTime
  lastClickTime = now
  
  // Detect double-click (< 300ms between clicks)
  if (timeDiff < 300) {
    const flowPosition = screenToFlowCoordinate({
      x: event.clientX,
      y: event.clientY,
    })
    addNodeAtPosition(flowPosition)
  }
}

// Handle paste event for images
const handlePaste = async (event) => {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    // Handle image paste
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const file = item.getAsFile()
      if (!file) continue

      // Create node at center of viewport first (with loading state)
      const centerPosition = screenToFlowCoordinate({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      
      const nodeId = addNodeAtPosition(centerPosition, { label: 'Uploading image...' })
      
      // Upload to Cloudinary if configured
      if (isCloudinaryConfigured()) {
        const imageUrl = await uploadImage(file)
        if (imageUrl) {
          // Update node with image
          nodes.value = nodes.value.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, label: '', image: imageUrl } }
              : node
          )
          persistLocal()
        } else {
          // Upload failed
          nodes.value = nodes.value.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, label: 'Image upload failed' } }
              : node
          )
        }
      } else {
        // Cloudinary not configured - use local data URL
        const reader = new FileReader()
        reader.onload = (e) => {
          nodes.value = nodes.value.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, label: '', image: e.target.result } }
              : node
          )
          persistLocal()
        }
        reader.readAsDataURL(file)
      }
      return
    }
  }
}

const updateNodeLabel = (id, label) => {
  nodes.value = nodes.value.map((node) =>
    node.id === id ? { ...node, data: { ...node.data, label } } : node,
  )
  setTimeout(fitAll, 120)
}

const updateNodeImage = (id, imageUrl) => {
  nodes.value = nodes.value.map((node) =>
    node.id === id ? { ...node, data: { ...node.data, image: imageUrl } } : node,
  )
}

const clearNewFlag = (id) => {
  nodes.value = nodes.value.map((node) =>
    node.id === id ? { ...node, data: { ...node.data, isNew: false } } : node,
  )
}

const removeNode = (id) => {
  if (id === 'core') return
  nodes.value = nodes.value.filter((node) => node.id !== id)
  edges.value = edges.value.filter((edge) => edge.source !== id && edge.target !== id)
  setTimeout(fitAll, 80)
}

const onNodeDragStop = () => {
  // Save when drag ends - v-model already updated positions
  if (!restoring) {
    saveState.value = 'saving'
    persistLocal()
  }
}

let saveTimer = null
let remotePushTimer = null

const persistLocal = () => {
  try {
    localUpdatedAt.value = Date.now()
    const sanitizedNodes = nodes.value.map(sanitizeNode)
    const sanitizedEdges = edges.value.map(sanitizeEdge)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ nodes: sanitizedNodes, edges: sanitizedEdges, updatedAt: localUpdatedAt.value }),
    )
    saveState.value = 'saved'
    setTimeout(() => (saveState.value = 'idle'), 1000)
    
    // Debounced push to remote
    if (auth.isAuthenticated.value) {
      if (remotePushTimer) clearTimeout(remotePushTimer)
      remotePushTimer = setTimeout(() => {
        saveState.value = 'syncing'
        pushRemote().then(() => {
          saveState.value = 'synced'
          setTimeout(() => (saveState.value = 'idle'), 1000)
        }).catch(() => {
          saveState.value = 'offline'
        })
      }, 1500)
    }
  } catch (err) {
    console.warn('Failed to save local data', err)
  }
}

watch(
  [nodes, edges],
  () => {
    if (restoring) return
    saveState.value = 'saving'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(persistLocal, 300)
  },
  { deep: true },
)

onMounted(async () => {
  // Add paste event listener
  document.addEventListener('paste', handlePaste)
  
  // Load local first
  const stored = loadLocal()
  if (stored) {
    restoring = true
    nodes.value = ensureCore(stored.nodes)
    edges.value = stored.edges
  } else {
    nodes.value = ensureCore([])
    edges.value = []
  }
  recalcNodeCount(nodes.value)
  
  // Then try to fetch remote if authenticated
  if (auth.isAuthenticated.value) {
    saveState.value = 'syncing'
    const remote = await fetchRemote()
    if (remote && remote.updatedAt > localUpdatedAt.value) {
      // Remote is newer, use it
      restoring = true
      nodes.value = ensureCore(remote.nodes || [])
      edges.value = remote.edges || []
      localUpdatedAt.value = remote.updatedAt
      // Save to local storage (remote data is already sanitized)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ nodes: remote.nodes, edges: remote.edges, updatedAt: localUpdatedAt.value }),
      )
      recalcNodeCount(nodes.value)
    }
    saveState.value = 'synced'
    setTimeout(() => (saveState.value = 'idle'), 1000)
  }
  
  setTimeout(() => {
    restoring = false
    fitAll()
  }, 200)
})

onBeforeUnmount(() => {
  document.removeEventListener('paste', handlePaste)
  if (saveTimer) clearTimeout(saveTimer)
  if (remotePushTimer) clearTimeout(remotePushTimer)
})

onViewportChange(({ zoom }) => {
  if (zoom && !isSliderDragging) {
    zoomPercent.value = Math.min(100, Math.max(20, Number((zoom * 100).toFixed(0))))
  }
})

onViewportChange((vp) => {
  viewportState.value = { x: vp.x ?? viewportState.value.x, y: vp.y ?? viewportState.value.y, zoom: vp.zoom ?? viewportState.value.zoom }
})

watch(
  nodes,
  () => {
    // no-op: allow overlaps
  },
  { deep: true },
)

// Watch for auth state changes - sync after sign in
watch(
  () => auth.isAuthenticated.value,
  async (isAuth, wasAuth) => {
    // Trigger sync when user signs in (false -> true)
    if (isAuth && !wasAuth) {
      await syncAfterAuth()
    }
  },
)

provide('moriNodeActions', {
  updateNodeLabel,
  updateNodeImage,
  removeNode,
  clearNewFlag,
})
</script>

<template>
  <section class="canvas-shell">
    <div class="overlay controls">
      <button class="add-btn" type="button" @click="addNode">+ Add node</button>
    </div>

    <VueFlow
      class="mori-flow"
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :fit-view-on-init="false"
      :min-zoom="0.2"
      :max-zoom="1"
      :nodes-draggable="true"
      :pan-on-drag="true"
      :pan-on-scroll="false"
      :zoom-on-scroll="false"
      :zoom-on-pinching="false"
      :zoom-activation-key-code="['Control', 'Meta']"
      :zoom-on-double-click="false"
      :nodes-connectable="true"
      :connect-on-click="true"
      :edges-updatable="false"
      :default-edge-options="defaultEdgeOptions"
      @pane-ready="fitAll"
      @pane-click="handlePaneClick"
      @connect="handleConnect"
      @wheel="handleWheelPan"
      @node-drag-stop="onNodeDragStop"
    >
      <Background pattern-color="#cdd3de" variant="dots" :gap="38" :size="1.6" />
    </VueFlow>

    <div class="toolbar">
      <div class="slider-wrap">
        <input
          :value="zoomPercent"
          class="zoom-slider"
          type="range"
          min="20"
          max="100"
          step="1"
          @input="(e) => setZoomPercent(e.target.value)"
          @change="(e) => setZoomPercent(e.target.value)"
        />
        <span class="zoom-label">{{ zoomPercent }}%</span>
      </div>
      <button type="button" class="ctrl-btn" title="Center on core" @click="recenter">◎</button>
    </div>

    <div class="save-indicator" :class="[saveState, { 'local-only': !auth.isAuthenticated.value }]">
      <span v-if="saveState === 'saving'">Saving…</span>
      <span v-else-if="saveState === 'saved'">Saved locally</span>
      <span v-else-if="saveState === 'syncing'">Syncing…</span>
      <span v-else-if="saveState === 'synced'">Synced ✓</span>
      <span v-else-if="saveState === 'offline'">Offline mode</span>
      <span v-else-if="!auth.isAuthenticated.value" class="local-warning">⚠ Local only · Sign in to sync</span>
      <span v-else>Ready</span>
    </div>
  </section>
</template>

<style scoped>
.canvas-shell {
  position: relative;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: linear-gradient(160deg, #f7f2e9, #f5f0e4);
}

.canvas-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(17, 24, 39, 0.05) 0.6px, transparent 0.6px);
  background-size: 18px 18px;
  opacity: 0.35;
  pointer-events: none;
  z-index: 1;
}

.mori-flow {
  height: 100%;
  width: 100%;
  background: transparent;
}

.overlay {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  mix-blend-mode: normal;
}

.header {
  top: 18px;
  left: 20px;
  max-width: 520px;
  padding: 8px 10px;
}

.header h1 {
  margin: 4px 0 2px;
  font-size: 26px;
  font-weight: 750;
  letter-spacing: 0.01em;
  color: #1f2933;
}

.controls {
  top: 20px;
  right: 22px;
  pointer-events: auto;
}

.add-btn {
  padding: 11px 16px;
  border-radius: 14px;
  border: 1px dashed rgba(30, 41, 59, 0.35);
  background: linear-gradient(135deg, #fefefe, #f6f1e8);
  color: #1f2937;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  transition: transform 0.12s ease, box-shadow 0.2s ease;
  pointer-events: auto;
  cursor: pointer;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.12);
}

.add-btn:active {
  transform: translateY(0);
}

.save-indicator {
  position: fixed;
  right: 18px;
  bottom: 18px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(55, 65, 81, 0.15);
  background: #ffffff;
  color: #374151;
  font-size: 12px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.save-indicator.saving,
.save-indicator.syncing {
  opacity: 1;
}

.save-indicator.saved,
.save-indicator.synced {
  opacity: 1;
}

.save-indicator.synced {
  background: #ecfdf5;
  border-color: rgba(16, 185, 129, 0.2);
  color: #059669;
}

.save-indicator.offline {
  background: #fef3c7;
  border-color: rgba(245, 158, 11, 0.2);
  color: #d97706;
}

.save-indicator.local-only {
  background: #fff7ed;
  border-color: rgba(234, 88, 12, 0.2);
  color: #c2410c;
}

.local-warning {
  font-weight: 500;
}

.toolbar {
  position: absolute;
  right: 16px;
  bottom: 70px;
  display: flex;
  gap: 8px;
  z-index: 12;
}

.ctrl-btn {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(55, 65, 81, 0.18);
  background: #ffffff;
  color: #1f2937;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.15s ease;
}

.ctrl-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px rgba(0, 0, 0, 0.12);
}

.slider-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid rgba(55, 65, 81, 0.18);
  background: #ffffff;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.08);
}

.zoom-slider {
  width: 100px;
  height: 6px;
  appearance: none;
  background: linear-gradient(to right, #e5e7eb, #d1d5db);
  border-radius: 3px;
  cursor: pointer;
}

.zoom-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #1f2937;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.zoom-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #1f2937;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.zoom-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  min-width: 40px;
  text-align: right;
}
</style>
