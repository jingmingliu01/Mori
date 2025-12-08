<script setup>
import { ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'

const props = defineProps({
  open: Boolean,
})

const emit = defineEmits(['close', 'success'])

const { login, signup, loading, error } = useAuth()

const mode = ref('login') // login | signup
const email = ref('')
const password = ref('')
const name = ref('')
const localError = ref('')

watch(() => props.open, (val) => {
  if (val) {
    localError.value = ''
    email.value = ''
    password.value = ''
    name.value = ''
  }
})

const switchMode = () => {
  mode.value = mode.value === 'login' ? 'signup' : 'login'
  localError.value = ''
}

const handleSubmit = async () => {
  localError.value = ''
  
  if (!email.value || !password.value) {
    localError.value = 'Email and password are required'
    return
  }
  
  try {
    if (mode.value === 'login') {
      await login(email.value, password.value)
    } else {
      await signup(email.value, password.value, name.value)
    }
    emit('success')
    emit('close')
  } catch (e) {
    localError.value = e.message
  }
}

const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click="handleBackdropClick">
      <div class="modal-card">
        <button class="close-btn" type="button" @click="$emit('close')">×</button>
        
        <h2 class="modal-title">{{ mode === 'login' ? 'Welcome back' : 'Create account' }}</h2>
        <p class="modal-subtitle">
          {{ mode === 'login' ? 'Sign in to sync your ideas across devices' : 'Join Mori to save your universe' }}
        </p>
        
        <form class="auth-form" @submit.prevent="handleSubmit">
          <div v-if="mode === 'signup'" class="form-field">
            <label for="name">Name (optional)</label>
            <input
              id="name"
              v-model="name"
              type="text"
              placeholder="Your name"
              autocomplete="name"
            />
          </div>
          
          <div class="form-field">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="hello@example.com"
              autocomplete="email"
              required
            />
          </div>
          
          <div class="form-field">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              minlength="6"
              required
            />
          </div>
          
          <p v-if="localError || error" class="error-msg">{{ localError || error }}</p>
          
          <button class="submit-btn" type="submit" :disabled="loading">
            {{ loading ? 'Please wait...' : (mode === 'login' ? 'Sign in' : 'Create account') }}
          </button>
        </form>
        
        <p class="switch-mode">
          {{ mode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
          <button type="button" class="link-btn" @click="switchMode">
            {{ mode === 'login' ? 'Sign up' : 'Sign in' }}
          </button>
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 380px;
  padding: 32px;
  border-radius: 20px;
  background: linear-gradient(175deg, #fffbf4, #f7f3ea);
  border: 1.5px solid rgba(51, 65, 85, 0.12);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(55, 65, 81, 0.2);
  background: #ffffff;
  color: #374151;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.close-btn:hover {
  background: #f3f4f6;
}

.modal-title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  font-family: 'Caveat', 'Handlee', system-ui, sans-serif;
}

.modal-subtitle {
  margin: 0 0 24px;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.form-field input {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(55, 65, 81, 0.2);
  background: #ffffff;
  font-size: 15px;
  color: #1f2937;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-field input:focus {
  outline: none;
  border-color: #d97706;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.1);
}

.form-field input::placeholder {
  color: #9ca3af;
}

.error-msg {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #dc2626;
  font-size: 13px;
}

.submit-btn {
  margin-top: 8px;
  padding: 14px 20px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(217, 119, 6, 0.25);
  transition: transform 0.12s ease, box-shadow 0.15s ease;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(217, 119, 6, 0.3);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.switch-mode {
  margin: 20px 0 0;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
}

.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: #d97706;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.link-btn:hover {
  color: #b45309;
}
</style>

