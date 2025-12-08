<script setup>
import { ref, provide } from 'vue'
import MoriCanvas from './components/MoriCanvas.vue'
import AuthModal from './components/AuthModal.vue'
import { useAuth } from './composables/useAuth'

const { user, isAuthenticated, logout, getAuthHeaders } = useAuth()

const showAuthModal = ref(false)

const handleLogout = () => {
  logout()
  // Optionally reload to reset local state
  window.location.reload()
}

// Provide auth helpers to child components
provide('auth', { user, isAuthenticated, getAuthHeaders })
</script>

<template>
  <main class="app-shell">
    <MoriCanvas />
    
    <div class="user-controls">
      <template v-if="isAuthenticated">
        <span class="user-name">{{ user?.name || user?.email }}</span>
        <button class="user-btn logout" type="button" @click="handleLogout">
          Sign out
        </button>
      </template>
      <template v-else>
        <button class="user-btn" type="button" @click="showAuthModal = true">
          Sign in
        </button>
      </template>
    </div>
    
    <AuthModal
      :open="showAuthModal"
      @close="showAuthModal = false"
      @success="showAuthModal = false"
    />
  </main>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  margin: 0;
  background: #f9f6ef;
}

.user-controls {
  position: fixed;
  top: 20px;
  right: 140px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 15;
}

.user-name {
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(55, 65, 81, 0.15);
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-btn {
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(55, 65, 81, 0.2);
  background: linear-gradient(135deg, #ffffff, #f6f1e8);
  color: #1f2937;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.06);
  transition: transform 0.12s ease, box-shadow 0.15s ease;
}

.user-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.user-btn.logout {
  background: linear-gradient(135deg, #fef2f2, #fee2e2);
  border-color: rgba(239, 68, 68, 0.2);
  color: #dc2626;
}
</style>
