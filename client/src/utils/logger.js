/**
 * Mori Logger - Comprehensive logging for important user actions
 * 
 * Log levels:
 * - info: General information about user actions
 * - success: Successful operations
 * - warn: Warnings or potential issues
 * - error: Errors and failures
 */

const APP_PREFIX = '[Mori]'

const formatTimestamp = () => {
  return new Date().toISOString()
}

const formatMessage = (level, category, action, details = {}) => {
  const timestamp = formatTimestamp()
  const detailsStr = Object.keys(details).length > 0 
    ? ` | ${JSON.stringify(details)}` 
    : ''
  return `${APP_PREFIX} ${timestamp} [${level.toUpperCase()}] [${category}] ${action}${detailsStr}`
}

// Styled console output for better visibility
const styles = {
  info: 'color: #3b82f6; font-weight: bold',
  success: 'color: #10b981; font-weight: bold',
  warn: 'color: #f59e0b; font-weight: bold',
  error: 'color: #ef4444; font-weight: bold',
}

export const logger = {
  /**
   * Log info level message
   * @param {string} category - Category of action (Auth, Canvas, Node, etc.)
   * @param {string} action - Description of the action
   * @param {object} details - Optional additional details
   */
  info(category, action, details = {}) {
    console.log(`%c${formatMessage('info', category, action, details)}`, styles.info)
  },

  /**
   * Log success level message
   * @param {string} category - Category of action
   * @param {string} action - Description of the action
   * @param {object} details - Optional additional details
   */
  success(category, action, details = {}) {
    console.log(`%c${formatMessage('success', category, action, details)}`, styles.success)
  },

  /**
   * Log warning level message
   * @param {string} category - Category of action
   * @param {string} action - Description of the action
   * @param {object} details - Optional additional details
   */
  warn(category, action, details = {}) {
    console.warn(`%c${formatMessage('warn', category, action, details)}`, styles.warn)
  },

  /**
   * Log error level message
   * @param {string} category - Category of action
   * @param {string} action - Description of the action
   * @param {object} details - Optional additional details
   */
  error(category, action, details = {}) {
    console.error(`%c${formatMessage('error', category, action, details)}`, styles.error)
  },
}

// Predefined categories for consistency
export const LogCategory = {
  AUTH: 'Auth',
  CANVAS: 'Canvas',
  NODE: 'Node',
  EDGE: 'Edge',
  SYNC: 'Sync',
  IMAGE: 'Image',
}

export default logger

