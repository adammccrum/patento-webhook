/**
 * Client-side Authentication Module
 * Handles JWT tokens, session management, API requests
 */

const AUTH_STORAGE_KEY = 'auth';
const USER_STORAGE_KEY = 'user';
const TOKEN_REFRESH_BUFFER = 60; // Refresh 60 seconds before expiry

/**
 * Get current authenticated user
 */
function getCurrentUser() {
  try {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    return userJson ? JSON.parse(userJson) : null;
  } catch (error) {
    console.error('Error parsing user from storage:', error);
    return null;
  }
}

/**
 * Get current access token
 */
function getAccessToken() {
  return localStorage.getItem('accessToken');
}

/**
 * Get refresh token
 */
function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  const token = getAccessToken();
  if (!token) return false;

  try {
    const decoded = decodeJWT(token);
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp > now;
  } catch (error) {
    return false;
  }
}

/**
 * Decode JWT without verification (client-side only)
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');

    const decoded = JSON.parse(atob(parts[1]));
    return decoded;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    throw error;
  }
}

/**
 * Check if token needs refresh
 */
function shouldRefreshToken() {
  const token = getAccessToken();
  if (!token) return false;

  try {
    const decoded = decodeJWT(token);
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    return timeUntilExpiry < TOKEN_REFRESH_BUFFER;
  } catch (error) {
    return false;
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    logout();
    return false;
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include'
    });

    if (!response.ok) {
      console.warn('Token refresh failed');
      logout();
      return false;
    }

    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    logout();
    return false;
  }
}

/**
 * Login user
 */
async function login(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Logout user
 */
async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout error:', error);
  }

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem(USER_STORAGE_KEY);

  // Redirect to login if not already there
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login.html';
  }
}

/**
 * Get user info from server
 */
async function getCurrentUserInfo() {
  try {
    const response = await authenticatedFetch('/api/auth/me');
    if (!response.ok) {
      logout();
      return null;
    }

    const data = await response.json();
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    return data.user;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

/**
 * Make authenticated API request
 * Automatically refreshes token if needed
 */
async function authenticatedFetch(url, options = {}) {
  // Check if token needs refresh
  if (shouldRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401
      });
    }
  }

  const token = getAccessToken();
  if (!token) {
    logout();
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401
    });
  }

  // Merge headers
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };

  // Generate correlation ID for request tracing
  const correlationId = options.correlationId || generateCorrelationId();
  headers['x-correlation-id'] = correlationId;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  // Handle 401 - token might have expired
  if (response.status === 401) {
    logout();
  }

  return response;
}

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get authorization header value
 */
function getAuthorizationHeader() {
  const token = getAccessToken();
  return token ? `Bearer ${token}` : null;
}

/**
 * Check if user has permission
 */
function hasPermission(action, resource = null) {
  // This is a client-side hint only
  // Real authorization happens on the server
  const user = getCurrentUser();
  if (!user) return false;

  // Owner has all permissions
  if (user.roles?.some(r => r.name === 'owner')) {
    return true;
  }

  // For more detailed checks, the server must validate
  // This is just a client-side UI hint
  return true; // Assume permitted; server will deny if not
}

/**
 * Setup global error handling for API responses
 */
function setupAuthenticationErrorHandling() {
  // Intercept fetch globally (for non-authenticatedFetch calls)
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    // Handle 401 responses
    if (response.status === 401) {
      const data = await response.clone().json().catch(() => ({}));
      if (data.code === 'INVALID_TOKEN' || data.code === 'MISSING_TOKEN') {
        logout();
      }
    }

    return response;
  };
}

/**
 * Initialize authentication system
 */
function initializeAuthentication() {
  // Check if user is authenticated on page load
  if (!isAuthenticated()) {
    // Redirect to login if not on login page
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login.html';
    }
  } else {
    // Setup refresh timer
    setupTokenRefreshTimer();
  }

  // Setup global error handling
  setupAuthenticationErrorHandling();
}

/**
 * Setup automatic token refresh
 */
function setupTokenRefreshTimer() {
  const token = getAccessToken();
  if (!token) return;

  try {
    const decoded = decodeJWT(token);
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;

    if (timeUntilExpiry > TOKEN_REFRESH_BUFFER) {
      // Schedule refresh buffer before expiry
      const refreshIn = (timeUntilExpiry - TOKEN_REFRESH_BUFFER) * 1000;
      setTimeout(() => {
        if (isAuthenticated()) {
          refreshAccessToken();
          setupTokenRefreshTimer(); // Reschedule
        }
      }, refreshIn);
    }
  } catch (error) {
    console.error('Error setting up token refresh:', error);
  }
}

// Initialize on page load if not already done
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAuthentication);
} else {
  // Already loaded
  initializeAuthentication();
}
