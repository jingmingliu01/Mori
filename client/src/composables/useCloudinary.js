import { ref } from 'vue'

// Configure these in your .env file or environment
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''

export function useCloudinary() {
  const uploading = ref(false)
  const error = ref(null)
  const progress = ref(0)

  const uploadImage = async (file) => {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      console.warn('Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.')
      return null
    }

    uploading.value = true
    error.value = null
    progress.value = 0

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      progress.value = 100
      return data.secure_url
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      uploading.value = false
    }
  }

  const isConfigured = () => {
    return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET)
  }

  return {
    uploading,
    error,
    progress,
    uploadImage,
    isConfigured,
  }
}

