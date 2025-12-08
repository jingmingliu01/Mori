<script setup>
import { computed, inject, ref, watch, onMounted, nextTick } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useCloudinary } from '../composables/useCloudinary'
import { isImageUrl, hasImageExtension } from '../utils/urlUtils'

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
  updateNodeImage: () => {},
  removeNode: () => {},
  clearNewFlag: () => {},
})

const { uploading, uploadImage, isConfigured } = useCloudinary()

const isEditing = ref(false)
const draft = ref(props.data?.label || '')
const fileInput = ref(null)
const textareaRef = ref(null)

// Image URL detection state
const isDetecting = ref(false)
const detectedImageUrl = ref(false)

// URL detection regex
const urlRegex = /^(https?:\/\/[^\s]+)$/i

const isUrl = computed(() => {
  const label = props.data?.label || ''
  return urlRegex.test(label.trim())
})

const displayUrl = computed(() => {
  if (!isUrl.value) return ''
  try {
    const url = new URL(props.data?.label?.trim())
    return url.hostname + (url.pathname !== '/' ? url.pathname.slice(0, 20) + '...' : '')
  } catch {
    return props.data?.label?.slice(0, 30) + '...'
  }
})

watch(
  () => props.data?.label,
  (val) => {
    if (!isEditing.value) draft.value = val || ''
  },
)

// Watch for URL changes and detect if it's an image
watch(
  () => props.data?.label,
  async (val) => {
    const label = val?.trim() || ''
    // Reset detection state
    detectedImageUrl.value = false
    
    // Only detect if it's a URL
    if (!urlRegex.test(label)) {
      return
    }
    
    // Fast path: if has image extension, mark as image immediately
    if (hasImageExtension(label)) {
      detectedImageUrl.value = true
      return
    }
    
    // Slow path: try loading the image
    isDetecting.value = true
    try {
      detectedImageUrl.value = await isImageUrl(label)
    } finally {
      isDetecting.value = false
    }
  },
  { immediate: true }
)

// Auto-edit for new nodes
onMounted(() => {
  if (props.data?.isNew) {
    isEditing.value = true
    draft.value = ''
    nextTick(() => {
      textareaRef.value?.focus()
      textareaRef.value?.select()
      // Clear the isNew flag
      actions.clearNewFlag?.(props.id)
    })
  }
})

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

const triggerUpload = (event) => {
  event.stopPropagation()
  fileInput.value?.click()
}

const handleFileChange = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  
  const url = await uploadImage(file)
  if (url) {
    actions.updateNodeImage(props.id, url)
  }
  
  // Reset input
  if (fileInput.value) fileInput.value.value = ''
}

const removeImage = (event) => {
  event.stopPropagation()
  actions.updateNodeImage(props.id, null)
}
</script>

<template>
  <div
    class="mori-node"
    :class="{ 'is-core': data?.isCore, selected, uploading }"
    :style="{ transform: `rotate(${tiltStyle})` }"
  >
    <Handle type="target" :position="Position.Top" class="ghost-handle" />
    <Handle type="source" :position="Position.Top" class="ghost-handle" />

    <div class="node-toolbar" :class="{ visible: selected || isEditing }">
      <button v-if="!data?.isCore" class="node-btn" type="button" title="Delete" @mousedown.stop @click="requestDelete">
        ×
      </button>
      <button v-if="isConfigured()" class="node-btn" type="button" title="Add image" @mousedown.stop @click="triggerUpload">
        📷
      </button>
      <button class="node-btn" type="button" title="Edit" @mousedown.stop @click="startEdit">✎</button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden-input"
      @change="handleFileChange"
    />

    <div v-if="uploading" class="upload-overlay">
      <span>Uploading...</span>
    </div>

    <div v-if="isDetecting" class="detecting-overlay">
      <span>Detecting...</span>
    </div>

    <div v-if="data?.image" class="node-image">
      <img :src="data.image" alt="" />
      <button class="remove-image-btn" type="button" title="Remove image" @mousedown.stop @click="removeImage">×</button>
    </div>

    <template v-if="!isEditing">
      <!-- Image URL: render as image -->
      <div v-if="detectedImageUrl && !data?.image" class="node-image auto-detected" @dblclick.stop="startEdit">
        <img :src="data?.label" alt="" />
      </div>
      <!-- Regular URL: render as link -->
      <a
        v-else-if="isUrl && !detectedImageUrl"
        :href="data?.label"
        target="_blank"
        rel="noopener noreferrer"
        class="node-link"
        @click.stop
        @dblclick.stop="startEdit"
      >
        🔗 {{ displayUrl }}
      </a>
      <!-- Plain text -->
      <p v-else class="node-label" @dblclick="startEdit">
        {{ data?.label }}
      </p>
    </template>
    <textarea
      v-else
      ref="textareaRef"
      v-model="draft"
      class="node-editor"
      rows="2"
      placeholder="type or paste url"
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

.mori-node.uploading {
  opacity: 0.7;
  pointer-events: none;
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

.node-link {
  display: block;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: #2563eb;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  line-height: 1.4;
  word-break: break-all;
  transition: background 0.15s ease;
}

.node-link:hover {
  background: rgba(59, 130, 246, 0.15);
  text-decoration: underline;
}

.node-image {
  position: relative;
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

.remove-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.node-image:hover .remove-image-btn {
  opacity: 1;
}

.hidden-input {
  display: none;
}

.upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #6b7280;
  z-index: 5;
}

.detecting-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #6b7280;
  z-index: 5;
}

.auto-detected {
  cursor: pointer;
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
  display: flex;
  align-items: center;
  justify-content: center;
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
