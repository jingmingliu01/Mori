<script setup>
import { computed, inject, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  id: {
    type: [String, Number],
    required: true,
  },
  data: {
    type: Object,
    default: () => ({}),
  },
  selected: {
    type: Boolean,
    default: false,
  },
})

const actions = inject('moriNodeActions', {
  updateNodeLabel: () => {},
  removeNode: () => {},
})

const isEditing = ref(false)
const draft = ref(props.data?.label || '')

watch(
  () => props.data?.label,
  (val) => {
    if (!isEditing.value) draft.value = val || ''
  },
)

const tiltStyle = computed(() => `${props.data?.tilt || 0}deg`)

const startEdit = (event) => {
  event.stopPropagation()
  isEditing.value = true
  setTimeout(() => {
    const el = event.currentTarget?.closest('.mori-node')?.querySelector('textarea')
    if (el) el.focus()
  })
}

const saveLabel = () => {
  const next = draft.value.trim()
  actions.updateNodeLabel(props.id, next || 'Untitled')
  isEditing.value = false
}

const onEnter = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    saveLabel()
  }
}

const requestDelete = (event) => {
  event.stopPropagation()
  actions.removeNode(props.id)
}
</script>

<template>
  <div
    class="mori-node"
    :class="{ 'is-core': data?.isCore, selected }"
    :style="{ transform: `rotate(${tiltStyle})` }"
  >
    <Handle type="target" :position="Position.Top" class="ghost-handle" />
    <Handle type="source" :position="Position.Top" class="ghost-handle" />

    <div class="node-toolbar" :class="{ visible: selected || isEditing }">
      <button v-if="!data?.isCore" class="node-btn" type="button" title="Delete" @mousedown.stop @click="requestDelete">
        ×
      </button>
      <button class="node-btn" type="button" title="Edit" @mousedown.stop @click="startEdit">✎</button>
    </div>

    <div v-if="data?.image" class="node-image">
      <img :src="data.image" alt="" />
    </div>

    <p v-if="!isEditing" class="node-label" @dblclick="startEdit">
      {{ data?.label }}
    </p>
    <textarea
      v-else
      v-model="draft"
      class="node-editor"
      rows="2"
      @keydown="onEnter"
      @blur="saveLabel"
      @mousedown.stop
    />
  </div>
</template>

<style scoped>
.mori-node {
  position: relative;
  min-width: 160px;
  max-width: 260px;
  padding: 14px 16px 16px;
  border-radius: 16px;
  border: 1.5px solid rgba(51, 65, 85, 0.18);
  background: linear-gradient(175deg, #fffbf4, #f7f3ea);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
  color: #111827;
  font-size: 18px;
  font-weight: 600;
  font-family: 'Caveat', 'Handlee', 'Comic Sans MS', 'Segoe Print', 'Segoe UI', system-ui, -apple-system, sans-serif;
  letter-spacing: 0.01em;
  backdrop-filter: blur(1px);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.mori-node.selected {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14), 0 0 0 3px rgba(59, 130, 246, 0.18);
}

.is-core {
  background: linear-gradient(185deg, #fff3d6, #ffe1a8);
  border: 1.5px solid rgba(217, 119, 6, 0.28);
  box-shadow: 0 12px 28px rgba(217, 119, 6, 0.14);
}

.mori-node::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 18px;
  background: repeating-radial-gradient(circle at 30% 30%, rgba(17, 24, 39, 0.06), rgba(17, 24, 39, 0.06) 0.4px, transparent 0.5px, transparent 6px);
  opacity: 0.22;
  z-index: -1;
  pointer-events: none;
}

.node-label {
  margin: 0;
  line-height: 1.4;
  white-space: pre-wrap;
}

.node-image {
  margin-bottom: 10px;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid rgba(55, 65, 81, 0.12);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
}

.node-image img {
  display: block;
  width: 100%;
  height: auto;
}

.ghost-handle {
  opacity: 0.25;
  pointer-events: auto;
  width: 14px;
  height: 14px;
  background: #f3f4f6;
  border: 1.5px solid #475569;
  border-radius: 3px;
  transition: opacity 0.15s ease, transform 0.15s ease;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
}

.mori-node:hover .ghost-handle,
.mori-node.selected .ghost-handle {
  opacity: 0.9;
  transform: translateX(-50%) scale(1.05);
}

.node-toolbar {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.node-toolbar.visible {
  opacity: 1;
}

.node-btn {
  width: 22px;
  height: 22px;
  border-radius: 8px;
  border: 1px solid rgba(55, 65, 81, 0.35);
  background: #ffffff;
  color: #1f2937;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.node-btn:hover {
  background: #f3f4f6;
}

.node-editor {
  width: 100%;
  border: 1px dashed rgba(55, 65, 81, 0.4);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  font-family: inherit;
  font-size: 17px;
  font-weight: 600;
  color: #1f2937;
  resize: none;
  padding: 8px 10px;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}
</style>
