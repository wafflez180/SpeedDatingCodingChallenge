import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Use the ngrok URL for the backend
export const API_BASE_URL = 'https://11f8-96-242-7-124.ngrok-free.app';

// Configure axios instance with default settings
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://early-bats-wave.loca.lt',
  },
  withCredentials: false, // Disable credentials for cross-origin requests
  timeout: 10000, // 10 second timeout
});

// Create the request interceptor function
const requestInterceptor = (config: InternalAxiosRequestConfig) => {
  // Ensure config exists
  if (!config) {
    config = {} as InternalAxiosRequestConfig;
  }
  
  // Ensure headers exist
  config.headers = config.headers || {};
  
  // Add CORS headers
  config.headers['Origin'] = 'https://early-bats-wave.loca.lt';
  
  // Don't override Content-Type for FormData
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }
  
  // Force the base URL if not already set
  if (!config.baseURL) {
    config.baseURL = API_BASE_URL;
  }

  // Replace any localhost URLs with the ngrok URL
  if (config.url) {
    // Handle full URLs
    if (config.url.includes('localhost') || config.url.includes('127.0.0.1')) {
      config.url = config.url.replace(/https?:\/\/[^\/]+/, API_BASE_URL);
    }
    
    // Handle relative URLs
    if (config.url.startsWith('/')) {
      config.url = `${API_BASE_URL}${config.url}`;
    }
  }

  // Log the final request configuration
  console.log('API Request Config:', {
    url: config.url,
    baseURL: config.baseURL,
    method: config.method,
    headers: config.headers,
    data: config.data instanceof FormData ? 'FormData' : config.data,
    timestamp: new Date().toISOString()
  });

  return config;
};

// Create the response interceptor functions
const responseInterceptor = (response: AxiosResponse) => {
  console.log('API Response:', {
    status: response.status,
    statusText: response.statusText,
    url: response.config.url,
    headers: response.headers,
    data: response.data,
    timestamp: new Date().toISOString()
  });
  return response;
};

const errorInterceptor = (error: any) => {
  // Log detailed error information
  console.error('API Error:', {
    message: error.message,
    name: error.name,
    stack: error.stack,
    config: {
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers,
      data: error.config?.data instanceof FormData ? 'FormData' : error.config?.data,
      baseURL: error.config?.baseURL,
      timeout: error.config?.timeout,
    },
    response: error.response ? {
      status: error.response.status,
      statusText: error.response.statusText,
      headers: error.response.headers,
      data: error.response.data,
    } : 'No response',
    request: error.request ? {
      readyState: error.request.readyState,
      status: error.request.status,
      responseURL: error.request.responseURL,
    } : 'No request',
    timestamp: new Date().toISOString()
  });

  // Check if it's a CORS error
  if (error.message.includes('Network Error') || error.response?.status === 0) {
    console.error('Possible CORS error detected. Please check CORS configuration.');
  }

  return Promise.reject(error);
};

// Add interceptors to the API instance
api.interceptors.request.use(requestInterceptor, errorInterceptor);
api.interceptors.response.use(responseInterceptor, errorInterceptor);

// Override axios defaults to ensure they're used everywhere
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['Accept'] = 'application/json, text/plain, */*';
axios.defaults.headers.common['Origin'] = 'https://early-bats-wave.loca.lt';
axios.defaults.withCredentials = false;
axios.defaults.timeout = 10000;

// Add the same interceptors to the global axios instance
axios.interceptors.request.use(requestInterceptor, errorInterceptor);
axios.interceptors.response.use(responseInterceptor, errorInterceptor);

export default api; 