<script setup>
import { ref, computed, inject, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  currentCanvasId: { type: String, default: null },
  canvasList: { type: Array, default: () => [] },
  isAuthenticated: { type: Boolean, default: false },
})

const emit = defineEmits(['switch', 'create', 'rename', 'delete'])

const isOpen = ref(false)
const editingId = ref(null)
const editingName = ref('')
const deleteConfirmId = ref(null)

const currentCanvas = computed(() => {
  if (!props.currentCanvasId) return { name: 'Local Canvas' }
  return props.canvasList.find(c => c._id === props.currentCanvasId) || { name: 'Untitled' }
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
  if (!isOpen.value) {
    editingId.value = null
    deleteConfirmId.value = null
  }
}

const closeDropdown = (e) => {
  if (!e.target.closest('.canvas-switcher')) {
    isOpen.value = false
    editingId.value = null
    deleteConfirmId.value = null
  }
}

const selectCanvas = (canvas) => {
  if (canvas._id !== props.currentCanvasId) {
    emit('switch', canvas._id)
  }
  isOpen.value = false
}

const createNew = () => {
  emit('create')
  isOpen.value = false
}

const startRename = (canvas, e) => {
  e.stopPropagation()
  editingId.value = canvas._id
  editingName.value = canvas.name
  deleteConfirmId.value = null
}

const saveRename = (canvas, e) => {
  e.stopPropagation()
  if (editingName.value.trim() && editingName.value !== canvas.name) {
    emit('rename', { id: canvas._id, name: editingName.value.trim() })
  }
  editingId.value = null
}

const cancelRename = (e) => {
  e.stopPropagation()
  editingId.value = null
}

const confirmDelete = (canvas, e) => {
  e.stopPropagation()
  deleteConfirmId.value = canvas._id
  editingId.value = null
}

const doDelete = (canvas, e) => {
  e.stopPropagation()
  emit('delete', canvas._id)
  deleteConfirmId.value = null
}

const cancelDelete = (e) => {
  e.stopPropagation()
  deleteConfirmId.value = null
}

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDropdown)
})
</script>

<template>
  <div class="canvas-switcher">
    <button class="switcher-trigger" @click="toggleDropdown">
      <span class="canvas-name">{{ currentCanvas.name }}</span>
      <span class="arrow" :class="{ open: isOpen }">▾</span>
    </button>
    
    <button 
      class="create-btn" 
      @click="createNew" 
      title="Create new canvas"
    >
      +
    </button>

    <div v-if="isOpen" class="dropdown">
      <div 
        v-for="canvas in canvasList" 
        :key="canvas._id" 
        class="canvas-item"
        :class="{ active: canvas._id === currentCanvasId }"
        @click="selectCanvas(canvas)"
      >
        <!-- Normal view -->
        <template v-if="editingId !== canvas._id && deleteConfirmId !== canvas._id">
          <div class="canvas-info">
            <span class="item-name">{{ canvas.name }}</span>
            <span class="item-meta">{{ canvas.nodeCount }} nodes · {{ formatDate(canvas.updatedAt) }}</span>
          </div>
          <div class="item-actions">
            <button class="action-btn" @click="startRename(canvas, $event)" title="Rename">✎</button>
            <button class="action-btn delete" @click="confirmDelete(canvas, $event)" title="Delete">✕</button>
          </div>
        </template>

        <!-- Editing name -->
        <template v-else-if="editingId === canvas._id">
          <input 
            v-model="editingName"
            class="rename-input"
            @click.stop
            @keyup.enter="saveRename(canvas, $event)"
            @keyup.escape="cancelRename"
            autofocus
          />
          <div class="item-actions">
            <button class="action-btn save" @click="saveRename(canvas, $event)">✓</button>
            <button class="action-btn" @click="cancelRename">✕</button>
          </div>
        </template>

        <!-- Delete confirmation -->
        <template v-else-if="deleteConfirmId === canvas._id">
          <span class="confirm-text">Delete?</span>
          <div class="item-actions">
            <button class="action-btn delete" @click="doDelete(canvas, $event)">Yes</button>
            <button class="action-btn" @click="cancelDelete">No</button>
          </div>
        </template>
      </div>

      <div v-if="canvasList.length === 0" class="empty-state">
        No canvases yet
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-switcher {
  display: flex;
  align-items: center;
  gap: 0;
  position: relative;
  z-index: 100;
}

.switcher-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px 0 0 12px;
  border: 1px solid rgba(55, 65, 81, 0.18);
  border-right: none;
  background: #ffffff;
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: background 0.15s ease;
  min-width: 140px;
  text-align: left;
}

.switcher-trigger:hover {
  background: #fafafa;
}

.canvas-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  font-size: 12px;
  color: #9ca3af;
  transition: transform 0.15s ease;
}

.arrow.open {
  transform: rotate(180deg);
}

.create-btn {
  padding: 10px 12px;
  border-radius: 0 12px 12px 0;
  border: 1px solid rgba(55, 65, 81, 0.18);
  background: #ffffff;
  color: #1f2937;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.create-btn:hover {
  background: #fef3c7;
  color: #d97706;
}

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 280px;
  max-height: 320px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid rgba(55, 65, 81, 0.15);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  animation: dropIn 0.15s ease;
}

@keyframes dropIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.canvas-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(55, 65, 81, 0.08);
  cursor: pointer;
  transition: background 0.12s ease;
}

.canvas-item:last-child {
  border-bottom: none;
}

.canvas-item:hover {
  background: #fafafa;
}

.canvas-item.active {
  background: #fef3c7;
}

.canvas-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  font-size: 11px;
  color: #9ca3af;
}

.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.canvas-item:hover .item-actions,
.canvas-item .item-actions:has(button:focus) {
  opacity: 1;
}

.action-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: rgba(55, 65, 81, 0.08);
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.action-btn:hover {
  background: rgba(55, 65, 81, 0.15);
  color: #374151;
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.save {
  background: #d1fae5;
  color: #059669;
}

.action-btn.save:hover {
  background: #a7f3d0;
}

.rename-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d97706;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  min-width: 0;
}

.confirm-text {
  font-weight: 600;
  font-size: 13px;
  color: #dc2626;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
</style>

