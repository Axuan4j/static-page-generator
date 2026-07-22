import type {
  GenerateResponse,
  PreviewResponse,
  ProjectConfig,
  TemplateDetailResponse,
  TemplateMeta
} from './types'

export const BASE_URL = ''

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

export async function uploadAsset(file: File, folderName: string): Promise<{ success: true; url: string }> {
  const formData = new FormData()
  formData.append('folderName', folderName)
  formData.append('file', file)

  const resp = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData
  })

  if (!resp.ok) {
    let message = `上传失败: ${resp.status}`
    try {
      const errorBody = await resp.json()
      message = errorBody?.message || message
    } catch {
      // 后端未返回 JSON 时保留 HTTP 状态，避免解析异常覆盖真正的上传错误。
    }
    throw new Error(message)
  }

  return resp.json()
}
