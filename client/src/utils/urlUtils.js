// Common image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']

/**
 * Quick check: does the URL end with a common image extension?
 * @param {string} url 
 * @returns {boolean}
 */
export function hasImageExtension(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * Attempt to load the URL as an image (Promise-based)
 * @param {string} url 
 * @param {number} timeout - timeout in ms (default 5000)
 * @returns {Promise<boolean>}
 */
export function tryLoadImage(url, timeout = 5000) {
  return new Promise((resolve) => {
    const img = new Image()
    const timer = setTimeout(() => {
      img.src = ''
      resolve(false)
    }, timeout)
    
    img.onload = () => {
      clearTimeout(timer)
      resolve(true)
    }
    img.onerror = () => {
      clearTimeout(timer)
      resolve(false)
    }
    img.src = url
  })
}

/**
 * Combined detection: is this URL pointing to an image?
 * Fast path: check extension
 * Slow path: try to load the image
 * @param {string} url 
 * @returns {Promise<boolean>}
 */
export async function isImageUrl(url) {
  // Fast path: has image extension
  if (hasImageExtension(url)) {
    return true
  }
  // Slow path: try to load
  return await tryLoadImage(url)
}

