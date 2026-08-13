/**
 * Axios 统一拦截器：CSRF token、token 刷新、错误重试、请求队列
 * 提升安全性和用户体验
 */

let csrfToken = null;
let tokenRefreshPromise = null;

/**
 * 从响应头或 Cookie 中提取 CSRF token
 */
function extractCsrfToken(response) {
  const headerToken = response.headers['x-csrf-token'];
  if (headerToken) {
    csrfToken = headerToken;
    return;
  }
  
  // 从 Cookie 中提取（备选方案）
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === 'csrf_token') {
      csrfToken = value;
      break;
    }
  }
}

/**
 * 静默刷新 token（使用 Refresh Token 换取新 Access Token）
 * v3.2: 改用 /api/auth/token-refresh 端点（Refresh Token 轮换，更安全）
 * 同时只允许一次并发刷新（防止多请求同时 401 触发多次刷新）
 */
async function refreshToken(axios) {
  if (tokenRefreshPromise) return tokenRefreshPromise;

  const isElectronOrMobile = !!(window.__ELECTRON_CONFIG__ || window.Capacitor?.isNativePlatform?.());

  tokenRefreshPromise = axios.post('/api/auth/token-refresh', {
    // Cookie 模式：服务端从 vxin_refresh cookie 读取（Web/桌面端）
    // Bearer 模式：从 localStorage 读取存储的 refresh token（Electron/移动端备用）
    refreshToken: isElectronOrMobile
      ? localStorage.getItem('vxin_refresh_token')
      : undefined,
  }, {
    withCredentials: true,
    _skipRefresh: true,   // 防止刷新请求本身触发递归刷新
  }).then(res => {
    const { token, user } = res.data;
    if (!token) throw new Error('刷新响应无 token');
    // Electron/移动端：更新 Bearer token
    if (isElectronOrMobile) {
      localStorage.setItem('vxin_electron_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    // 触发全局 token 更新事件（AuthContext 监听）
    window.dispatchEvent(new CustomEvent('vxin:token_refreshed', { detail: { token, user } }));
    return token;
  }).catch(err => {
    // 刷新失败（refresh token 也过期）→ 强制登出
    if (isElectronOrMobile) {
      localStorage.removeItem('vxin_electron_token');
      localStorage.removeItem('vxin_refresh_token');
      delete axios.defaults.headers.common['Authorization'];
    }
    window.dispatchEvent(new CustomEvent('vxin:session_expired'));
    throw err;
  }).finally(() => {
    tokenRefreshPromise = null;
  });

  return tokenRefreshPromise;
}

/**
 * 判断是否应该重试
 */
function shouldRetry(error) {
  if (!error.config || error.config.__retryCount >= 3) return false;
  
  // 网络错误或 5xx 服务器错误才重试
  if (!error.response) return true; // 网络错误
  const status = error.response.status;
  return status >= 500 && status < 600;
}

/**
 * 计算重试延迟（指数退避 + 抖动）
 */
function getRetryDelay(retryCount) {
  const baseDelay = 300;
  const maxDelay = 3000;
  const exponential = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  const jitter = Math.random() * 200; // 0-200ms 抖动
  return exponential + jitter;
}

/**
 * 初始化 Axios 拦截器
 */
export function setupAxiosInterceptors(axios) {
  // ── 请求拦截器 ──
  axios.interceptors.request.use(
    config => {
      // 自动附加 CSRF token（非 GET/HEAD/OPTIONS）
      if (csrfToken && !/^(get|head|options)$/i.test(config.method)) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
      
      // 请求计时（用于性能监控）
      config.metadata = { startTime: Date.now() };
      
      return config;
    },
    error => Promise.reject(error)
  );
  
  // ── 响应拦截器 ──
  axios.interceptors.response.use(
    response => {
      // 提取 CSRF token
      extractCsrfToken(response);
      
      // 性能监控
      if (response.config.metadata) {
        const duration = Date.now() - response.config.metadata.startTime;
        if (duration > 1000) {
          console.warn(`[axios] 慢请求: ${response.config.method?.toUpperCase()} ${response.config.url} ${duration}ms`);
        }
      }
      
      return response;
    },
    async error => {
      const originalRequest = error.config;
      
      // 401 未授权 + 非登录接口 → 尝试刷新 token
      if (error.response?.status === 401 && 
          originalRequest && 
          !originalRequest._retry && 
          !originalRequest.url?.includes('/auth/login') &&
          !originalRequest.url?.includes('/auth/refresh')) {
        
        originalRequest._retry = true;
        
        try {
          await refreshToken(axios);
          // 重试原请求
          return axios(originalRequest);
        } catch {
          // 刷新失败，由各组件处理跳转登录
          return Promise.reject(error);
        }
      }
      
      // 自动重试（网络错误或 5xx）
      if (shouldRetry(error)) {
        originalRequest.__retryCount = (originalRequest.__retryCount || 0) + 1;
        const delay = getRetryDelay(originalRequest.__retryCount);
        
        console.log(`[axios] 重试请求 (${originalRequest.__retryCount}/3): ${originalRequest.url}, 延迟 ${Math.round(delay)}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return axios(originalRequest);
      }
      
      // 性能监控（失败请求）
      if (originalRequest?.metadata) {
        const duration = Date.now() - originalRequest.metadata.startTime;
        console.error(`[axios] 请求失败: ${originalRequest.method?.toUpperCase()} ${originalRequest.url} ${duration}ms`, 
                      error.response?.status, error.message);
      }
      
      return Promise.reject(error);
    }
  );
  
  console.log('[axios] 拦截器已初始化');
}

/**
 * 手动设置 CSRF token（用于首次登录后）
 */
export function setCsrfToken(token) {
  csrfToken = token;
}

/**
 * 清除 CSRF token（用于登出）
 */
export function clearCsrfToken() {
  csrfToken = null;
}
