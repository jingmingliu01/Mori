<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { VueFlow, useVueFlow, applyNodeChanges } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import MoriNode from './MoriNode.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const STORAGE_KEY = 'mori:universe:v1'

const nodes = ref([])
const edges = ref([])
const nodeCount = ref(1)
const saveState = ref('idle') // idle | saving | saved
const zoomPercent = ref(75)
const nodeTypes = computed(() => ({ moriNode: MoriNode }))
const viewportState = ref({ x: 0, y: 0, zoom: 1 })
let restoring = false
const { fitView, zoomIn, zoomOut, setZoom, setViewport, onViewportChange } = useVueFlow()

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

const loadLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      nodes: ensureCore(parsed.nodes || []),
      edges: parsed.edges || [],
    }
  } catch (err) {
    console.warn('Failed to load local data', err)
    return null
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
  fitView({ duration: 350, padding: 0.4, maxZoom: 1.1 })
}

const recenter = () => {
  fitView({ duration: 260, padding: 0.4, maxZoom: 1 })
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

const setZoomPercent = (val) => {
  const clamped = Math.min(180, Math.max(45, Number(val)))
  zoomPercent.value = clamped
  setZoom(clamped / 100, { duration: 80 })
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
  ]

  saveState.value = 'saving'
  persistLocal()
}

const updateNodeLabel = (id, label) => {
  nodes.value = nodes.value.map((node) =>
    node.id === id ? { ...node, data: { ...node.data, label } } : node,
  )
  setTimeout(fitAll, 120)
}

const removeNode = (id) => {
  if (id === 'core') return
  nodes.value = nodes.value.filter((node) => node.id !== id)
  edges.value = edges.value.filter((edge) => edge.source !== id && edge.target !== id)
  setTimeout(fitAll, 80)
}

const onNodesChange = (changes) => {
  nodes.value = applyNodeChanges(changes, nodes.value)
  const endedDrag = changes.some(
    (c) => c.type === 'position' && (c.dragging === false || c.dragging === undefined),
  )
  if (endedDrag && !restoring) {
    saveState.value = 'saving'
    persistLocal()
  }
}

let saveTimer = null
const persistLocal = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ nodes: nodes.value, edges: edges.value, updatedAt: Date.now() }),
    )
    saveState.value = 'saved'
    setTimeout(() => (saveState.value = 'idle'), 1000)
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

onMounted(() => {
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
  setTimeout(() => {
    restoring = false
    fitAll()
  }, 200)
})

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})

onViewportChange(({ zoom }) => {
  if (zoom) zoomPercent.value = Number((zoom * 100).toFixed(0))
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

provide('moriNodeActions', {
  updateNodeLabel,
  removeNode,
})
</script>

<template>
  <section class="canvas-shell">
    <div class="overlay header">
      <div>
        <p class="eyebrow">Visual Core - Kinopio style</p>
        <h1>Scatter ideas around your anchor</h1>
        <p class="lede">
          A sticky-note desk made for light drag-and-drop. Every node connects back to the core, like thoughts casually pinned on paper.
        </p>
      </div>
    </div>

    <div class="overlay controls">
      <button class="add-btn" type="button" @click="addNode">+ Add node</button>
    </div>

    <VueFlow
      class="mori-flow"
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :fit-view-on-init="false"
      :min-zoom="0.45"
      :max-zoom="1.8"
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
      @connect="handleConnect"
      @wheel="handleWheelPan"
      @nodes-change="onNodesChange"
    >
      <Background pattern-color="#cdd3de" variant="dots" :gap="38" :size="1.6" />
    </VueFlow>

    <div class="toolbar">
      <button type="button" class="ctrl-btn" title="Zoom out" @click="zoomOut()">−</button>
      <div class="slider-wrap">
        <input
          v-model="zoomPercent"
          class="zoom-slider"
          type="range"
          min="45"
          max="180"
          step="1"
          @input="setZoomPercent($event.target.value)"
        />
        <span class="zoom-label">{{ zoomPercent }}%</span>
      </div>
      <button type="button" class="ctrl-btn" title="Zoom in" @click="zoomIn()">+</button>
      <button type="button" class="ctrl-btn" title="Center on core" @click="recenter">◎</button>
    </div>

    <div class="save-indicator" :class="saveState">
      <span v-if="saveState === 'saving'">Saving…</span>
      <span v-else-if="saveState === 'saved'">Saved</span>
      <span v-else>Local-first</span>
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

.lede {
  margin: 4px 0 0;
  color: #4b5563;
  font-size: 15px;
  line-height: 1.5;
}

.eyebrow {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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

.save-indicator.saving {
  opacity: 1;
}

.save-indicator.saved {
  opacity: 1;
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
</style>
