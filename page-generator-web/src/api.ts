import type {
  GenerateResponse,
  PreviewResponse,
  ProjectConfig,
  TemplateDetailResponse,
  TemplateMeta
} from './types'

export const BASE_URL = 'http://127.0.0.1:3000'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const resp = await fetch(`${BASE_URL}${url}`, {
    headers,
    ...options
  })

  if (!resp.ok) {
    let message = `请求失败: ${resp.status}`
    try {
      const err = await resp.json()
      message = err?.message || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  return resp.json()
}

export function getTemplates() {
  return request<TemplateMeta[]>('/api/templates')
}

export function getTemplateDetail(code: string) {
  return request<TemplateDetailResponse>(`/api/templates/${code}`)
}

export function saveTemplate(code: string, content: string) {
  return request<{ success: boolean }>(`/api/templates/${code}/save`, {
    method: 'POST',
    body: JSON.stringify({ content })
  })
}

export function getProjects() {
  return request<ProjectConfig[]>('/api/projects')
}

export function previewTemplate(payload: {
  templateCode: string
  data: Record<string, any>
  templateContent?: string
}) {
  return request<PreviewResponse>('/api/preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function generatePage(payload: {
  templateCode: string
  projectCode: string
  data: Record<string, any>
  templateContent?: string
  overwrite?: boolean
}) {
  return request<GenerateResponse>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function reloadNginx(projectCode: string) {
  return request<{ success: boolean; stdout: string; stderr: string }>('/api/system/nginx/reload', {
    method: 'POST',
    body: JSON.stringify({ projectCode })
  })
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const resp = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData
  })

  if (!resp.ok) {
    throw new Error(`上传失败: ${resp.status}`)
  }

  return resp.json()
}
