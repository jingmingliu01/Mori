<script setup>
import { computed, inject, markRaw, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import MoriNode from './MoriNode.vue'
import CanvasSwitcher from './CanvasSwitcher.vue'
import { useCloudinary } from '../composables/useCloudinary'
import { logger, LogCategory } from '../utils/logger'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const API_BASE = import.meta.env.VITE_API_URL || ''
const STORAGE_KEY = 'mori:universe:v2'

const nodes = ref([])
const edges = ref([])
const nodeCount = ref(1)
const saveState = ref('idle') // idle | saving | saved | syncing | synced | offline
const zoomPercent = ref(100)
const nodeTypes = { moriNode: markRaw(MoriNode) }
const viewportState = ref({ x: 0, y: 0, zoom: 1 })
let restoring = false
let localUpdatedAt = ref(0)
const { fitView, setViewport, onViewportChange, screenToFlowCoordinate } = useVueFlow()

// Multi-canvas state
const currentCanvasId = ref(null) // null = local-only mode
const currentCanvasName = ref('Local Canvas')
const canvasList = ref([]) // [{_id, name, updatedAt, nodeCount}]

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
    
    // Support both old v1 format and new v2 format
    if (parsed.currentCanvasId !== undefined || parsed.canvases) {
      // v2 format with multi-canvas
      
      // Load canvas list
      canvasList.value = getAllLocalCanvases().sort((a, b) => b.updatedAt - a.updatedAt)
      
      // Determine which canvas to load
      let canvasId = parsed.currentCanvasId
      if (!canvasId && canvasList.value.length > 0) {
        canvasId = canvasList.value[0]._id
      }
      
      if (!canvasId) return null
      
      currentCanvasId.value = canvasId
      const canvasData = parsed.canvases?.[canvasId]
      if (!canvasData) return null
      
      localUpdatedAt.value = canvasData.updatedAt || 0
      currentCanvasName.value = canvasData.name || 'Local Canvas'
      return {
        nodes: ensureCore(canvasData.nodes || []),
        edges: canvasData.edges || [],
        updatedAt: canvasData.updatedAt || 0,
      }
    } else {
      // v1 legacy format - migrate to v2
      const newCanvasId = generateLocalCanvasId()
      localUpdatedAt.value = parsed.updatedAt || Date.now()
      currentCanvasId.value = newCanvasId
      currentCanvasName.value = 'My Canvas'
      
      // Save in new format
      const canvasData = {
        name: 'My Canvas',
        nodes: ensureCore(parsed.nodes || []),
        edges: parsed.edges || [],
        updatedAt: localUpdatedAt.value,
      }
      saveLocalCanvas(newCanvasId, canvasData.name, canvasData.nodes, canvasData.edges, canvasData.updatedAt)
      
      // Update canvasList
      canvasList.value = [{ _id: newCanvasId, name: 'My Canvas', updatedAt: localUpdatedAt.value, nodeCount: canvasData.nodes.length }]
      
      return {
        nodes: canvasData.nodes,
        edges: canvasData.edges,
        updatedAt: canvasData.updatedAt,
      }
    }
  } catch (err) {
    console.warn('Failed to load local data', err)
    return null
  }
}

// ============================================
// Local Canvas Management (Offline Support)
// ============================================

// Generate unique ID for local canvases
const generateLocalCanvasId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// Get all canvases from localStorage
const getAllLocalCanvases = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!parsed.canvases) return []
    return Object.entries(parsed.canvases).map(([id, data]) => ({
      _id: id,
      name: data.name || 'Untitled',
      nodes: data.nodes || [],
      edges: data.edges || [],
      updatedAt: data.updatedAt || 0,
      nodeCount: data.nodes?.length || 0,
    }))
  } catch (err) {
    console.warn('Failed to get local canvases:', err)
    return []
  }
}

// Save a canvas to localStorage
const saveLocalCanvas = (canvasId, name, canvasNodes, canvasEdges, updatedAt = Date.now()) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    let data = {}
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch (e) {}
    
    if (!data.canvases) data.canvases = {}
    data.canvases[canvasId] = {
      name,
      nodes: canvasNodes,
      edges: canvasEdges,
      updatedAt,
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save local canvas:', err)
  }
}

// Delete a canvas from localStorage
const deleteLocalCanvas = (canvasId) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.canvases && data.canvases[canvasId]) {
      delete data.canvases[canvasId]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch (err) {
    console.warn('Failed to delete local canvas:', err)
  }
}

// Rename a canvas in localStorage
const renameLocalCanvas = (canvasId, newName) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.canvases && data.canvases[canvasId]) {
      data.canvases[canvasId].name = newName
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch (err) {
    console.warn('Failed to rename local canvas:', err)
  }
}

// Replace a local canvas ID with a remote ID (after sync)
const replaceLocalCanvasId = (oldId, newId) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.canvases && data.canvases[oldId]) {
      data.canvases[newId] = data.canvases[oldId]
      delete data.canvases[oldId]
      if (data.currentCanvasId === oldId) {
        data.currentCanvasId = newId
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch (err) {
    console.warn('Failed to replace canvas ID:', err)
  }
}

// ============================================
// Multi-Canvas Remote API Functions
// ============================================

// Fetch list of all user's canvases
const fetchCanvasList = async () => {
  if (!auth.isAuthenticated.value) return []
  try {
    const res = await fetch(`${API_BASE}/api/universes`, {
      headers: auth.getAuthHeaders(),
    })
    if (!res.ok) throw new Error('Failed to fetch canvas list')
    return await res.json()
  } catch (err) {
    console.warn('Failed to fetch canvas list:', err)
    return []
  }
}

// Fetch a specific canvas by ID
const fetchCanvas = async (canvasId) => {
  if (!auth.isAuthenticated.value || !canvasId) return null
  try {
    const res = await fetch(`${API_BASE}/api/universe/${canvasId}`, {
      headers: auth.getAuthHeaders(),
    })
    if (!res.ok) throw new Error('Failed to fetch canvas')
    return await res.json()
  } catch (err) {
    console.warn('Failed to fetch canvas:', err)
    return null
  }
}

// Create a new canvas
const createCanvas = async (name, canvasNodes, canvasEdges) => {
  if (!auth.isAuthenticated.value) return null
  try {
    const res = await fetch(`${API_BASE}/api/universes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.getAuthHeaders(),
      },
      body: JSON.stringify({
        name: name || 'Untitled',
        nodes: canvasNodes || nodes.value.map(sanitizeNode),
        edges: canvasEdges || edges.value.map(sanitizeEdge),
      }),
    })
    if (!res.ok) throw new Error('Failed to create canvas')
    return await res.json()
  } catch (err) {
    console.warn('Failed to create canvas:', err)
    return null
  }
}

// Update current canvas
const updateCanvas = async (canvasId) => {
  if (!auth.isAuthenticated.value || !canvasId) return
  try {
    const res = await fetch(`${API_BASE}/api/universe/${canvasId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...auth.getAuthHeaders(),
      },
      body: JSON.stringify({
        nodes: nodes.value.map(sanitizeNode),
        edges: edges.value.map(sanitizeEdge),
      }),
    })
    if (!res.ok) throw new Error('Failed to update canvas')
    return await res.json()
  } catch (err) {
    console.warn('Failed to update canvas:', err)
  }
}

// Rename canvas
const renameCanvas = async (canvasId, newName) => {
  if (!auth.isAuthenticated.value || !canvasId) return
  try {
    const res = await fetch(`${API_BASE}/api/universe/${canvasId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...auth.getAuthHeaders(),
      },
      body: JSON.stringify({ name: newName }),
    })
    if (!res.ok) throw new Error('Failed to rename canvas')
    const data = await res.json()
    // Update local list
    const idx = canvasList.value.findIndex(c => c._id === canvasId)
    if (idx !== -1) canvasList.value[idx].name = newName
    if (canvasId === currentCanvasId.value) currentCanvasName.value = newName
    return data
  } catch (err) {
    console.warn('Failed to rename canvas:', err)
  }
}

// Delete canvas
const deleteCanvas = async (canvasId) => {
  if (!auth.isAuthenticated.value || !canvasId) return
  try {
    const res = await fetch(`${API_BASE}/api/universe/${canvasId}`, {
      method: 'DELETE',
      headers: auth.getAuthHeaders(),
    })
    if (!res.ok) throw new Error('Failed to delete canvas')
    
    // Remove from list
    canvasList.value = canvasList.value.filter(c => c._id !== canvasId)
    
    // If deleted current canvas, switch to another
    if (canvasId === currentCanvasId.value) {
      if (canvasList.value.length > 0) {
        await switchCanvas(canvasList.value[0]._id)
      } else {
        // Create new default canvas
        const newCanvas = await createCanvas('My Canvas')
        if (newCanvas) {
          canvasList.value = [{ _id: newCanvas._id, name: newCanvas.name, updatedAt: newCanvas.updatedAt, nodeCount: 1 }]
          await switchCanvas(newCanvas._id)
        }
      }
    }
  } catch (err) {
    console.warn('Failed to delete canvas:', err)
  }
}

// Switch to a different canvas
const switchCanvas = async (canvasId) => {
  restoring = true
  saveState.value = 'saving'
  
  try {
    // Save current canvas first
    if (currentCanvasId.value) {
      const sanitizedNodes = nodes.value.map(sanitizeNode)
      const sanitizedEdges = edges.value.map(sanitizeEdge)
      saveLocalCanvas(currentCanvasId.value, currentCanvasName.value, sanitizedNodes, sanitizedEdges, localUpdatedAt.value)
      
      // Also push to remote if authenticated
      if (auth.isAuthenticated.value && !currentCanvasId.value.startsWith('local-')) {
        await updateCanvas(currentCanvasId.value)
      }
    }
    
    // Load new canvas - first try from remote if authenticated and not a local ID
    let canvas = null
    if (auth.isAuthenticated.value && !canvasId.startsWith('local-')) {
      canvas = await fetchCanvas(canvasId)
    }
    
    // If no remote canvas, load from localStorage
    if (!canvas) {
      const localCanvases = getAllLocalCanvases()
      canvas = localCanvases.find(c => c._id === canvasId)
    }
    
    if (!canvas) {
      logger.warn(LogCategory.CANVAS, 'Canvas not found', { canvasId })
      saveState.value = 'idle'
      restoring = false
      return
    }
    
    // Load canvas data
    currentCanvasId.value = canvas._id
    currentCanvasName.value = canvas.name
    nodes.value = ensureCore(canvas.nodes || [])
    edges.value = canvas.edges || []
    localUpdatedAt.value = canvas.updatedAt
    recalcNodeCount(nodes.value)
    
    // Update localStorage
    persistLocal()
    
    logger.success(LogCategory.CANVAS, 'Switched to canvas', { canvasId: canvas._id, name: canvas.name, nodeCount: nodes.value.length })
    
    saveState.value = 'saved'
    setTimeout(() => (saveState.value = 'idle'), 1000)
    setTimeout(fitAll, 100)
  } catch (err) {
    logger.error(LogCategory.CANVAS, 'Switch canvas failed', { canvasId, error: err.message })
    saveState.value = 'offline'
  } finally {
    restoring = false
  }
}

// Sync after user signs in - multi-canvas aware
const syncAfterAuth = async () => {
  if (!auth.isAuthenticated.value) return
  
  logger.info(LogCategory.SYNC, 'Starting sync after authentication')
  saveState.value = 'syncing'
  restoring = true
  
  try {
    // Fetch remote canvas list
    const remoteList = await fetchCanvasList()
    const localCanvases = getAllLocalCanvases()
    logger.info(LogCategory.SYNC, 'Fetched canvas lists', { remoteCount: remoteList.length, localCount: localCanvases.length })
    
    // Sync each local canvas
    for (const localCanvas of localCanvases) {
      const remote = remoteList.find(r => r._id === localCanvas._id)
      
      if (remote) {
        // Canvas exists in both - compare timestamps, newer wins
        if (localCanvas.updatedAt >= remote.updatedAt) {
          // Local is newer - push to remote
          await fetch(`${API_BASE}/api/universe/${remote._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...auth.getAuthHeaders(),
            },
            body: JSON.stringify({
              name: localCanvas.name,
              nodes: localCanvas.nodes,
              edges: localCanvas.edges,
            }),
          })
        } else {
          // Remote is newer - update local
          const fullRemote = await fetchCanvas(remote._id)
          if (fullRemote) {
            saveLocalCanvas(remote._id, fullRemote.name, fullRemote.nodes, fullRemote.edges, fullRemote.updatedAt)
          }
        }
      } else if (localCanvas._id.startsWith('local-')) {
        // New local canvas - push to remote and update local ID
        const newRemote = await createCanvas(localCanvas.name, localCanvas.nodes, localCanvas.edges)
        if (newRemote) {
          replaceLocalCanvasId(localCanvas._id, newRemote._id)
          // If this was the current canvas, update the ID
          if (currentCanvasId.value === localCanvas._id) {
            currentCanvasId.value = newRemote._id
          }
        }
      }
      // If canvas has a non-local ID but doesn't exist in remote, keep it locally
      // (it might have been deleted on another device, but user might want to keep it)
    }
    
    // Fetch any remote-only canvases (exist in remote but not locally)
    for (const remote of remoteList) {
      const existsLocally = localCanvases.some(l => l._id === remote._id)
      if (!existsLocally) {
        const fullRemote = await fetchCanvas(remote._id)
        if (fullRemote) {
          saveLocalCanvas(fullRemote._id, fullRemote.name, fullRemote.nodes, fullRemote.edges, fullRemote.updatedAt)
        }
      }
    }
    
    // Reload canvas list from localStorage (now updated)
    canvasList.value = getAllLocalCanvases().sort((a, b) => b.updatedAt - a.updatedAt)
    
    // If current canvas ID changed (was local-, now remote), reload it
    const currentInList = canvasList.value.find(c => c._id === currentCanvasId.value)
    if (currentInList) {
      // Refresh current canvas data
      const fullCanvas = await fetchCanvas(currentCanvasId.value) || currentInList
      nodes.value = ensureCore(fullCanvas.nodes || [])
      edges.value = fullCanvas.edges || []
      currentCanvasName.value = fullCanvas.name
      localUpdatedAt.value = fullCanvas.updatedAt
      recalcNodeCount(nodes.value)
    } else if (canvasList.value.length > 0) {
      // Current canvas not found, switch to first one
      await switchCanvas(canvasList.value[0]._id)
    }
    
    // Update localStorage
    persistLocal()
    
    saveState.value = 'synced'
    logger.success(LogCategory.SYNC, 'Sync completed successfully', { canvasCount: canvasList.value.length })
    setTimeout(() => (saveState.value = 'idle'), 1000)
  } catch (err) {
    logger.error(LogCategory.SYNC, 'Sync failed', { error: err.message })
    saveState.value = 'offline'
  } finally {
    restoring = false
  }
}

// Handle canvas switcher events
const handleCanvasSwitch = (canvasId) => {
  logger.info(LogCategory.CANVAS, 'Switching canvas', { from: currentCanvasId.value, to: canvasId })
  switchCanvas(canvasId)
}

const handleCanvasCreate = async () => {
  logger.info(LogCategory.CANVAS, 'Creating new canvas', { isOnline: auth.isAuthenticated.value })
  
  // Create new canvas with just the default core node
  const defaultNodes = [{
    id: 'core',
    type: 'moriNode',
    position: { x: 0, y: 0 },
    data: { label: 'Me', isCore: true, tilt: 0 },
  }]
  
  let newCanvasId, newCanvasName
  const now = Date.now()
  
  if (auth.isAuthenticated.value) {
    // Online: create on server
    const newCanvas = await createCanvas('New Canvas', defaultNodes, [])
    if (newCanvas) {
      newCanvasId = newCanvas._id
      newCanvasName = newCanvas.name
    }
  } else {
    // Offline: create locally
    newCanvasId = generateLocalCanvasId()
    newCanvasName = 'New Canvas'
    saveLocalCanvas(newCanvasId, newCanvasName, defaultNodes, [], now)
  }
  
  if (newCanvasId) {
    canvasList.value.unshift({ _id: newCanvasId, name: newCanvasName, updatedAt: now, nodeCount: 1 })
    logger.success(LogCategory.CANVAS, 'Canvas created', { canvasId: newCanvasId, name: newCanvasName })
    await switchCanvas(newCanvasId)
  } else {
    logger.error(LogCategory.CANVAS, 'Failed to create canvas')
  }
}

const handleCanvasRename = async ({ id, name }) => {
  const oldName = canvasList.value.find(c => c._id === id)?.name
  logger.info(LogCategory.CANVAS, 'Renaming canvas', { canvasId: id, from: oldName, to: name })
  
  // Always update locally first
  renameLocalCanvas(id, name)
  
  // Update canvas list
  const idx = canvasList.value.findIndex(c => c._id === id)
  if (idx !== -1) canvasList.value[idx].name = name
  if (id === currentCanvasId.value) currentCanvasName.value = name
  
  // Also update remote if authenticated and not a local ID
  if (auth.isAuthenticated.value && !id.startsWith('local-')) {
    await renameCanvas(id, name)
  }
  
  logger.success(LogCategory.CANVAS, 'Canvas renamed', { canvasId: id, name })
}

const handleCanvasDelete = async (canvasId) => {
  const canvasToDelete = canvasList.value.find(c => c._id === canvasId)
  logger.info(LogCategory.CANVAS, 'Deleting canvas', { canvasId, name: canvasToDelete?.name })
  
  // Delete locally first
  deleteLocalCanvas(canvasId)
  
  // Remove from list
  canvasList.value = canvasList.value.filter(c => c._id !== canvasId)
  
  // Also delete from remote if authenticated and not a local ID
  if (auth.isAuthenticated.value && !canvasId.startsWith('local-')) {
    await deleteCanvas(canvasId)
  }
  
  logger.success(LogCategory.CANVAS, 'Canvas deleted', { canvasId, name: canvasToDelete?.name })
  
  // If deleted current canvas, switch to another
  if (canvasId === currentCanvasId.value) {
    if (canvasList.value.length > 0) {
      await switchCanvas(canvasList.value[0]._id)
    } else {
      // Create new default canvas
      await handleCanvasCreate()
    }
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
  
  logger.success(LogCategory.EDGE, 'Edge created', { edgeId: id, source, target, canvasId: currentCanvasId.value })
  
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

  logger.success(LogCategory.NODE, 'Node added via button', { nodeId: id, label, canvasId: currentCanvasId.value })

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

  logger.success(LogCategory.NODE, 'Node added at position', { 
    nodeId: id, 
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    hasImage: !!options.image,
    canvasId: currentCanvasId.value 
  })

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

      logger.info(LogCategory.IMAGE, 'Image paste detected', { type: item.type, size: file.size })

      // Create node at center of viewport first (with loading state)
      const centerPosition = screenToFlowCoordinate({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      
      const nodeId = addNodeAtPosition(centerPosition, { label: 'Uploading image...' })
      
      // Upload to Cloudinary if configured
      if (isCloudinaryConfigured()) {
        logger.info(LogCategory.IMAGE, 'Uploading image to Cloudinary', { nodeId })
        const imageUrl = await uploadImage(file)
        if (imageUrl) {
          // Update node with image
          nodes.value = nodes.value.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, label: '', image: imageUrl } }
              : node
          )
          logger.success(LogCategory.IMAGE, 'Image uploaded successfully', { nodeId, url: imageUrl.substring(0, 50) + '...' })
          persistLocal()
        } else {
          // Upload failed
          nodes.value = nodes.value.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, label: 'Image upload failed' } }
              : node
          )
          logger.error(LogCategory.IMAGE, 'Image upload failed', { nodeId })
        }
      } else {
        // Cloudinary not configured - use local data URL
        logger.info(LogCategory.IMAGE, 'Using local data URL (Cloudinary not configured)', { nodeId })
        const reader = new FileReader()
        reader.onload = (e) => {
          nodes.value = nodes.value.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, label: '', image: e.target.result } }
              : node
          )
          logger.success(LogCategory.IMAGE, 'Image stored as data URL', { nodeId })
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
  if (id === 'core') {
    logger.warn(LogCategory.NODE, 'Attempted to delete core node (blocked)', { canvasId: currentCanvasId.value })
    return
  }
  const nodeToRemove = nodes.value.find((node) => node.id === id)
  nodes.value = nodes.value.filter((node) => node.id !== id)
  edges.value = edges.value.filter((edge) => edge.source !== id && edge.target !== id)
  
  logger.success(LogCategory.NODE, 'Node deleted', { 
    nodeId: id, 
    label: nodeToRemove?.data?.label,
    canvasId: currentCanvasId.value 
  })
  
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
    
    // Build v2 localStorage structure
    const canvasKey = currentCanvasId.value || 'local'
    const existingRaw = localStorage.getItem(STORAGE_KEY)
    let existingData = {}
    try {
      existingData = existingRaw ? JSON.parse(existingRaw) : {}
    } catch (e) {}
    
    const storageData = {
      currentCanvasId: currentCanvasId.value,
      canvases: {
        ...existingData.canvases,
        [canvasKey]: {
          name: currentCanvasName.value,
          nodes: sanitizedNodes,
          edges: sanitizedEdges,
          updatedAt: localUpdatedAt.value,
        },
      },
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData))
    saveState.value = 'saved'
    setTimeout(() => (saveState.value = 'idle'), 1000)
    
    // Debounced push to remote
    if (auth.isAuthenticated.value && currentCanvasId.value) {
      if (remotePushTimer) clearTimeout(remotePushTimer)
      remotePushTimer = setTimeout(() => {
        saveState.value = 'syncing'
        updateCanvas(currentCanvasId.value).then(() => {
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
    // No stored data - create a default canvas
    const defaultCanvasId = generateLocalCanvasId()
    const defaultNodes = ensureCore([])
    const now = Date.now()
    
    currentCanvasId.value = defaultCanvasId
    currentCanvasName.value = 'My Canvas'
    nodes.value = defaultNodes
    edges.value = []
    localUpdatedAt.value = now
    
    // Save to localStorage
    saveLocalCanvas(defaultCanvasId, 'My Canvas', defaultNodes, [], now)
    canvasList.value = [{ _id: defaultCanvasId, name: 'My Canvas', updatedAt: now, nodeCount: 1 }]
    
    // Update currentCanvasId in localStorage
    persistLocal()
  }
  recalcNodeCount(nodes.value)
  
  // If already authenticated, sync with server
  if (auth.isAuthenticated.value) {
    await syncAfterAuth()
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
    <div class="overlay header-left">
      <CanvasSwitcher
        :currentCanvasId="currentCanvasId"
        :canvasList="canvasList"
        :isAuthenticated="auth.isAuthenticated.value"
        @switch="handleCanvasSwitch"
        @create="handleCanvasCreate"
        @rename="handleCanvasRename"
        @delete="handleCanvasDelete"
      />
    </div>

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

.header-left {
  top: 20px;
  left: 22px;
  pointer-events: auto;
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
