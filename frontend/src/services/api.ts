import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

const apiClient: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authData = localStorage.getItem('auth-storage')
    if (authData) {
      const parsed = JSON.parse(authData)
      const token = parsed?.state?.token
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (data: { username: string; password: string }) =>
    apiClient.post('/auth/login', data),
  register: (data: { username: string; email: string; password: string }) =>
    apiClient.post('/auth/register', data),
  refresh: () =>
    apiClient.post('/auth/refresh'),
}

export const familyApi = {
  create: (data: { name: string }) =>
    apiClient.post('/families/', data),
  get: (familyId: string) =>
    apiClient.get(`/families/${familyId}`),
  invite: (familyId: string, username: string) =>
    apiClient.post(`/families/${familyId}/invite?username=${username}`),
}

export const childApi = {
  list: (familyId: string) =>
    apiClient.get(`/children/families/${familyId}/children`),
  create: (familyId: string, data: { name: string; birth_date: string; gender: string }) =>
    apiClient.post(`/children/families/${familyId}/children`, data),
  get: (childId: string) =>
    apiClient.get(`/children/${childId}`),
  update: (childId: string, data: { name?: string; birth_date?: string; gender?: string }) =>
    apiClient.put(`/children/${childId}`, data),
}

export const mediaApi = {
  initUpload: (data: { filename: string; file_type: string; file_size: number }) =>
    apiClient.post('/media/upload/init', data),
  completeUpload: (uploadId: string, formData: FormData) =>
    apiClient.post(`/media/upload/${uploadId}/complete`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: (familyId: string, params?: { page?: number; page_size?: number }) =>
    apiClient.get(`/media/families/${familyId}/media`, { params }),
  get: (mediaId: string) =>
    apiClient.get(`/media/${mediaId}`),
  delete: (mediaId: string) =>
    apiClient.delete(`/media/${mediaId}`),
}

export const analysisApi = {
  getResults: (mediaId: string) =>
    apiClient.get(`/analysis/${mediaId}/results`),
  getStatus: (mediaId: string) =>
    apiClient.get(`/analysis/${mediaId}/status`),
  reanalyze: (mediaId: string) =>
    apiClient.post(`/analysis/${mediaId}/reanalyze`),
}

export const reportApi = {
  list: (childId: string) =>
    apiClient.get(`/reports/children/${childId}/reports`),
  get: (childId: string, reportId: string) =>
    apiClient.get(`/reports/children/${childId}/reports/${reportId}`),
  downloadPdf: (childId: string, reportId: string) =>
    apiClient.get(`/reports/children/${childId}/reports/${reportId}/pdf`),
  generate: (childId: string) =>
    apiClient.post(`/reports/children/${childId}/reports/generate`),
}

export const autonomyApi = {
  getSkills: (childId: string) =>
    apiClient.get(`/autonomy/children/${childId}/skills`),
  getInitiative: (childId: string) =>
    apiClient.get(`/autonomy/children/${childId}/initiative`),
}

export const exportApi = {
  trigger: (childId: string) =>
    apiClient.post(`/export/children/${childId}/export`),
  getStatus: (childId: string, exportId: string) =>
    apiClient.get(`/export/children/${childId}/export/status?export_id=${exportId}`),
  download: (childId: string, exportId: string) =>
    apiClient.get(`/export/children/${childId}/export/download?export_id=${exportId}`),
}

export const settingsApi = {
  get: () =>
    apiClient.get('/settings'),
  update: (data: {
    llm_provider?: string
    llm_api_key?: string
    llm_base_url?: string
    llm_model?: string
    llm_vision_model?: string
  }) =>
    apiClient.put('/settings', data),
  test: () =>
    apiClient.post('/settings/test'),
}

export default apiClient
