<template>
  <t-layout class="page-shell">
    <t-header class="page-header" style="height: 80px">
      <div class="header-brand">
        <div class="brand-badge">TD</div>
        <div>
          <div class="brand-title">静态页面生成器</div>
          <div class="brand-subtitle">模板配置、图片上传、预览生成一站式处理</div>
        </div>
      </div>

      <t-space>
        <t-popconfirm content="确认重新加载 Nginx 配置吗？" confirm-btn="确认重启" cancel-btn="取消" @confirm="handleReloadNginx">
          <t-button theme="danger" variant="outline" :loading="loading.reload" :disabled="!selectedProjectCode">
            {{ loading.reload ? '重启中...' : '重启 Nginx' }}
          </t-button>
        </t-popconfirm>
        <t-button theme="default" variant="outline" @click="handlePreview" :loading="loading.preview">
          {{ loading.preview ? '预览中...' : '预览页面' }}
        </t-button>
        <t-button theme="warning" variant="outline" @click="handleSaveTemplate" :loading="loading.save">
          {{ loading.save ? '保存中...' : '保存模板' }}
        </t-button>
        <t-button theme="primary" @click="handleGenerate" :loading="loading.generate">
          {{ loading.generate ? '生成中...' : '生成页面' }}
        </t-button>
      </t-space>
    </t-header>

    <t-content class="page-content">
      <aside class="sidebar-column">
        <t-card title="模板与项目" class="panel-card" :bordered="false">
          <div class="section-title">模板列表</div>
          <div class="template-list">
            <button
              v-for="tpl in templates"
              :key="tpl.code"
              type="button"
              class="template-item"
              :class="{ active: tpl.code === selectedTemplateCode }"
              @click="handleSelectTemplate(tpl.code)"
            >
              <div class="template-item__name">{{ tpl.name }}</div>
              <div class="template-item__code">{{ tpl.code }}</div>
              <div class="template-item__desc">{{ tpl.description || '暂无模板说明' }}</div>
            </button>
          </div>

          <div class="section-title">项目配置</div>
          <t-select v-model="selectedProjectCode" placeholder="请选择项目" clearable>
            <t-option v-for="project in projects" :key="project.code" :value="project.code" :label="`${project.name} (${project.code})`" />
          </t-select>

          <t-descriptions
            v-if="currentProject"
            class="project-descriptions"
            table-layout="auto"
            :column="1"
            bordered
            size="small"
            :items="projectDescriptionItems"
          />

          <t-alert
            v-if="generateResult"
            theme="success"
            class="result-alert"
            title="最近一次生成成功"
            :message="`输出目录：${generateResult.outputDir}`"
          />
        </t-card>
      </aside>

      <main class="form-column">
        <t-card title="参数配置" class="panel-card" :bordered="false">
          <div class="form-scroll-area">
            <template v-if="templateMeta">
              <div class="form-section">
                <div class="section-title">固定参数</div>
                <div class="field-grid">
                  <div v-for="field in templateMeta.fixedFields" :key="field.key" class="field-block">
                    <div class="field-label">{{ field.label }}</div>
                    <template v-if="field.type === 'input'">
                      <t-input v-model="formData[field.key]" :placeholder="field.placeholder || ''" />
                    </template>
                    <template v-else-if="field.type === 'textarea'">
                      <t-textarea v-model="formData[field.key]" :placeholder="field.placeholder || ''" :autosize="{ minRows: 3, maxRows: 8 }" />
                    </template>
                    <template v-else-if="field.type === 'number'">
                      <t-input v-model="formData[field.key]" type="number" :placeholder="field.placeholder || ''" />
                    </template>
                    <template v-else-if="field.type === 'select'">
                      <t-select v-model="formData[field.key]" placeholder="请选择" clearable>
                        <t-option v-for="opt in field.options || []" :key="String(opt.value)" :value="opt.value" :label="opt.label" />
                      </t-select>
                    </template>
                    <template v-else-if="field.type === 'switch'">
                      <t-switch v-model="formData[field.key]" />
                    </template>
                    <template v-else-if="field.type === 'image'">
                      <div class="compact-upload">
                        <t-upload
                          :request-method="(file) => handleImageUploadProxy(file, field.key)"
                          :files="uploadFiles[field.key] || []"
                          @update:files="(files) => { uploadFiles[field.key] = files }"
                          @remove="() => clearImageField(field.key)"
                          :max="1"
                          theme="custom"
                          accept="image/*"
                          :show-upload-list="false"
                        >
                          <t-button theme="primary" variant="outline">选择图片</t-button>
                        </t-upload>

                        <div v-if="getSingleImageUrl(field.key)" class="upload-preview-card">
                          <img :src="getSingleImageUrl(field.key)" :alt="field.label" class="upload-preview-image" />
                          <t-button theme="danger" variant="text" size="small" @click="clearImageField(field.key)">移除图片</t-button>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>

              <div class="form-section">
                <div class="section-title">动态参数</div>
                <div class="field-grid">
                  <div v-for="field in templateMeta.dynamicFields" :key="field.key" class="field-block field-block--full">
                    <div class="field-label">{{ field.label }}</div>
                    <template v-if="field.type === 'input'">
                      <t-input v-model="formData[field.key]" :placeholder="field.placeholder || ''" />
                    </template>
                    <template v-else-if="field.type === 'textarea'">
                      <t-textarea v-model="formData[field.key]" :placeholder="field.placeholder || ''" :autosize="{ minRows: 3, maxRows: 8 }" />
                    </template>
                    <template v-else-if="field.type === 'number'">
                      <t-input v-model="formData[field.key]" type="number" :placeholder="field.placeholder || ''" />
                    </template>
                    <template v-else-if="field.type === 'select'">
                      <t-select v-model="formData[field.key]" placeholder="请选择" clearable>
                        <t-option v-for="opt in field.options || []" :key="String(opt.value)" :value="opt.value" :label="opt.label" />
                      </t-select>
                    </template>
                    <template v-else-if="field.type === 'switch'">
                      <t-switch v-model="formData[field.key]" />
                    </template>
                    <template v-else-if="field.type === 'image'">
                      <div class="compact-upload">
                        <t-upload
                          :request-method="(file) => handleImageUploadProxy(file, field.key)"
                          :files="uploadFiles[field.key] || []"
                          @update:files="(files) => { uploadFiles[field.key] = files }"
                          @remove="() => clearImageField(field.key)"
                          :max="1"
                          theme="custom"
                          accept="image/*"
                          :show-upload-list="false"
                        >
                          <t-button theme="primary" variant="outline">选择图片</t-button>
                        </t-upload>

                        <div v-if="getSingleImageUrl(field.key)" class="upload-preview-card">
                          <img :src="getSingleImageUrl(field.key)" :alt="field.label" class="upload-preview-image" />
                          <t-button theme="danger" variant="text" size="small" @click="clearImageField(field.key)">移除图片</t-button>
                        </div>
                      </div>
                    </template>
                    <template v-else-if="field.type === 'array'">
                      <div class="array-box">
                        <div v-for="(_, index) in formData[field.key]" :key="`${field.key}-${index}`" class="array-item">
                          <template v-if="isSimpleArrayField(field)">
                            <t-input v-model="formData[field.key][index]" :placeholder="field.itemFields?.[0]?.label || '请输入值'" />
                          </template>

                          <template v-else>
                            <div v-for="itemField in field.itemFields || []" :key="itemField.key" class="nested-form-item">
                              <div class="mini-label">{{ itemField.label }}</div>

                              <t-input v-if="itemField.type === 'input'" v-model="formData[field.key][index][itemField.key]" />
                              <t-textarea
                                v-else-if="itemField.type === 'textarea'"
                                v-model="formData[field.key][index][itemField.key]"
                                :autosize="{ minRows: 2, maxRows: 6 }"
                              />
                              <t-input v-else-if="itemField.type === 'number'" v-model="formData[field.key][index][itemField.key]" type="number" />
                              <t-select v-else-if="itemField.type === 'select'" v-model="formData[field.key][index][itemField.key]" placeholder="请选择" clearable>
                                <t-option v-for="opt in itemField.options || []" :key="String(opt.value)" :value="opt.value" :label="opt.label" />
                              </t-select>
                              <t-upload
                                v-else-if="itemField.type === 'image'"
                                :request-method="(file) => handleArrayImageUploadProxy(file, field.key, index, itemField.key)"
                                :files="getArrImgFiles(field.key, index, itemField.key)"
                                @remove="() => clearArrayImageField(field.key, index, itemField.key)"
                                :max="1"
                                theme="custom"
                                accept="image/*"
                                :show-upload-list="false"
                              >
                                <t-button theme="primary" variant="outline" size="small">选择图片</t-button>
                              </t-upload>

                              <div v-if="getArrayImageUrl(field.key, index, itemField.key)" class="upload-preview-card upload-preview-card--nested">
                                <img
                                  :src="getArrayImageUrl(field.key, index, itemField.key)"
                                  :alt="itemField.label"
                                  class="upload-preview-image upload-preview-image--nested"
                                />
                                <t-button
                                  theme="danger"
                                  variant="text"
                                  size="small"
                                  @click="clearArrayImageField(field.key, index, itemField.key)"
                                >
                                  移除图片
                                </t-button>
                              </div>
                            </div>
                          </template>

                          <t-button size="small" theme="danger" variant="outline" class="array-del-btn" @click="removeArrayItem(field.key, index)">
                            删除
                          </t-button>
                        </div>

                        <t-button size="small" theme="primary" variant="outline" class="array-add-btn" @click="addArrayItem(field)">
                          新增一项
                        </t-button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>

              <div class="form-section">
                <div class="section-title">生成选项</div>
                <t-checkbox v-model="overwrite">覆盖已存在目录</t-checkbox>
              </div>
            </template>

            <t-empty v-else description="请先在左侧选择模板" />
          </div>
        </t-card>
      </main>

      <section class="preview-column">
        <t-card title="预览与编辑" class="panel-card panel-card--full" :bordered="false">
          <t-tabs v-model="activeTab" class="preview-tabs">
            <t-tab-panel value="preview" label="页面预览" style="margin: 2% auto">
              <div class="preview-wrap">
                <div class="phone-preview-stage">
                  <div class="phone-preview">
                    <div class="phone-preview__speaker"></div>
                    <div class="phone-preview__screen">
                      <iframe ref="previewFrameRef" class="preview-frame"></iframe>
                    </div>
                    <div class="phone-preview__home"></div>
                  </div>
                </div>
                <div class="preview-note">
                  预览仅展示大概效果，并非真实页面，仅供参考
                </div>
              </div>
            </t-tab-panel>

            <t-tab-panel value="editor" label="模板编辑">
              <div class="editor-wrap">
                <div class="editor-toolbar">
                  <t-tag theme="primary" variant="light-outline">EJS 模板</t-tag>
                  <span class="editor-tip">已自动解除高度裁切，超出内容可正常滚动查看</span>
                </div>
                <t-textarea
                  v-model="templateContent"
                  class="code-editor"
                  :autosize="false"
                  spellcheck="false"
                />
              </div>
            </t-tab-panel>
          </t-tabs>
        </t-card>
      </section>
    </t-content>
  </t-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import type { UploadFile } from 'tdesign-vue-next'
import { BASE_URL, generatePage, getProjects, getTemplateDetail, getTemplates, previewTemplate, reloadNginx, saveTemplate, uploadImage } from './api'
import type { GenerateResponse, ProjectConfig, TemplateField, TemplateMeta } from './types'

const templates = ref<TemplateMeta[]>([])
const projects = ref<ProjectConfig[]>([])
const selectedTemplateCode = ref('')
const selectedProjectCode = ref('')
const templateMeta = ref<TemplateMeta | null>(null)
const templateContent = ref('')
const activeTab = ref<'preview' | 'editor'>('preview')
const previewFrameRef = ref<HTMLIFrameElement | null>(null)
const overwrite = ref(false)
const generateResult = ref<GenerateResponse | null>(null)

const loading = reactive({ init: false, preview: false, generate: false, save: false, reload: false })
const formData = reactive<Record<string, any>>({})
const uploadFiles = reactive<Record<string, UploadFile[]>>({})

const currentProject = computed(() => projects.value.find((item) => item.code === selectedProjectCode.value) || null)
const projectDescriptionItems = computed(() => {
  if (!currentProject.value) {
    return []
  }

  return [
    { label: '页面文件输出目录', content: currentProject.value.outputRoot },
    { label: 'Nginx配置输出目录', content: currentProject.value.nginxIncludeDir },
    { label: 'Nginx启动文件路径', content: currentProject.value.nginxBinPath || '-' },
    { label: 'Nginx Location 前缀', content: currentProject.value.locationPrefix },
    { label: '主域名', content: currentProject.value.domain || '-' }
  ]
})

/**
 * 统一弹出消息提示，减少页面中的重复调用。
 */
function showMessage(text: string, type: 'success' | 'error' | 'info' = 'info') {
  MessagePlugin[type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'](text)
}

/**
 * 将接口返回的图片地址整理为浏览器可直接访问的完整地址。
 */
function normalizeImageUrl(url?: string) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${BASE_URL}${url}`
}

/**
 * 根据当前表单值恢复数组图片上传列表，保证回显稳定。
 */
function getArrImgFiles(fieldKey: string, index: number, itemKey: string): UploadFile[] {
  const url = normalizeImageUrl(formData[fieldKey]?.[index]?.[itemKey])
  if (!url) return []
  return [{
    name: url.split('/').pop() || 'image',
    url,
    status: 'success',
    percent: 100
  }]
}

/**
 * 读取单图字段当前的预览地址。
 */
function getSingleImageUrl(fieldKey: string) {
  return normalizeImageUrl(formData[fieldKey])
}

/**
 * 读取数组图片字段当前的预览地址。
 */
function getArrayImageUrl(fieldKey: string, index: number, itemKey: string) {
  return normalizeImageUrl(formData[fieldKey]?.[index]?.[itemKey])
}

/**
 * 根据模板元数据重置表单和上传列表。
 */
function resetFormData(meta: TemplateMeta) {
  const nextData: Record<string, any> = {}
  const allFields = [...meta.fixedFields, ...meta.dynamicFields]

  allFields.forEach((field) => {
    if (field.type === 'array') {
      nextData[field.key] = []
    } else if (field.type === 'switch') {
      nextData[field.key] = Boolean(field.defaultValue ?? false)
    } else {
      nextData[field.key] = field.defaultValue ?? ''
    }

    if (field.type === 'image') {
      uploadFiles[field.key] = []
    }
  })

  Object.keys(formData).forEach((key) => delete formData[key])
  Object.assign(formData, nextData)
}

/**
 * 判断数组字段是否属于简单值数组。
 */
function isSimpleArrayField(field: TemplateField) {
  return (field.itemFields || []).length === 1 && field.itemFields?.[0]?.key === 'value' && field.itemFields?.[0]?.type !== 'image'
}

/**
 * 为数组字段新增一行默认值。
 */
function addArrayItem(field: TemplateField) {
  if (!Array.isArray(formData[field.key])) {
    formData[field.key] = []
  }

  if (isSimpleArrayField(field)) {
    formData[field.key].push('')
    return
  }

  const row: Record<string, any> = {}
  ;(field.itemFields || []).forEach((itemField) => {
    row[itemField.key] = itemField.type === 'image' ? '' : ''
  })
  formData[field.key].push(row)
}

/**
 * 删除数组中的某一项。
 */
function removeArrayItem(fieldKey: string, index: number) {
  if (!Array.isArray(formData[fieldKey])) return
  formData[fieldKey].splice(index, 1)
}

/**
 * 清理单图字段的表单值和上传回显。
 */
function clearImageField(fieldKey: string) {
  formData[fieldKey] = ''
  uploadFiles[fieldKey] = []
}

/**
 * 清理数组项中的图片值。
 */
function clearArrayImageField(fieldKey: string, index: number, itemKey: string) {
  if (!Array.isArray(formData[fieldKey])) return
  if (!formData[fieldKey][index]) return
  formData[fieldKey][index][itemKey] = ''
}

/**
 * 上传单图并同步更新表单与上传组件回显。
 */
async function handleImageUploadProxy(file: UploadFile, fieldKey: string) {
  try {
    const result = await uploadImage(file.raw as File)
    const publicUrl = normalizeImageUrl(result.url)
    formData[fieldKey] = publicUrl
    uploadFiles[fieldKey] = [{
      name: publicUrl.split('/').pop() || 'image',
      url: publicUrl,
      status: 'success',
      percent: 100
    }]
    return { status: 'success', response: { url: publicUrl } }
  } catch (error: any) {
    showMessage(error.message || '上传失败', 'error')
    return { status: 'fail', error: error.message }
  }
}

/**
 * 上传数组中的图片字段。
 */
async function handleArrayImageUploadProxy(file: UploadFile, fieldKey: string, index: number, itemKey: string) {
  try {
    const result = await uploadImage(file.raw as File)
    formData[fieldKey][index][itemKey] = normalizeImageUrl(result.url)
    return { status: 'success', response: { url: formData[fieldKey][index][itemKey] } }
  } catch (error: any) {
    showMessage(error.message || '上传失败', 'error')
    return { status: 'fail', error: error.message }
  }
}

/**
 * 加载模板和项目的初始化数据。
 */
async function loadInitialData() {
  loading.init = true
  try {
    const [tpls, prjs] = await Promise.all([getTemplates(), getProjects()])
    templates.value = tpls
    projects.value = prjs
    if (tpls.length > 0) await handleSelectTemplate(tpls[0].code)
    if (prjs.length > 0) selectedProjectCode.value = prjs[0].code
  } catch (error: any) {
    showMessage(error.message || '初始化失败', 'error')
  } finally {
    loading.init = false
  }
}

/**
 * 切换模板时刷新元数据、表单值和预览区。
 */
async function handleSelectTemplate(code: string) {
  try {
    selectedTemplateCode.value = code
    const detail = await getTemplateDetail(code)
    templateMeta.value = detail.meta
    templateContent.value = detail.content
    resetFormData(detail.meta)
    generateResult.value = null
    await nextTick()
    clearPreview()
  } catch (error: any) {
    showMessage(error.message || '加载模板失败', 'error')
  }
}

/**
 * 在没有预览结果时写入默认提示页。
 */
function clearPreview() {
  if (!previewFrameRef.value) return
  const doc = previewFrameRef.value.contentWindow?.document
  if (!doc) return
  doc.open()
  doc.write('<html><body style="font-family: sans-serif; padding: 24px; color: #4b5563;">请点击上方“预览页面”查看渲染结果</body></html>')
  doc.close()
}

/**
 * 将 HTML 写入 iframe 中展示实时预览。
 */
function writePreview(html: string) {
  if (!previewFrameRef.value) return
  const doc = previewFrameRef.value.contentWindow?.document
  if (!doc) return
  doc.open()
  doc.write(html)
  doc.close()
}

/**
 * 深拷贝当前表单数据，避免后续接口处理时污染页面状态。
 */
function buildPayloadData() {
  return JSON.parse(JSON.stringify(formData))
}

/**
 * 调用后端实时渲染模板并展示预览结果。
 */
async function handlePreview() {
  if (!selectedTemplateCode.value) {
    showMessage('请先选择模板', 'error')
    return
  }

  loading.preview = true
  try {
    const resp = await previewTemplate({
      templateCode: selectedTemplateCode.value,
      data: buildPayloadData(),
      templateContent: templateContent.value
    })
    activeTab.value = 'preview'
    await nextTick()
    writePreview(resp.html)
    showMessage('预览成功', 'success')
  } catch (error: any) {
    showMessage(error.message || '预览失败', 'error')
  } finally {
    loading.preview = false
  }
}

/**
 * 调用后端执行 nginx reload，方便顶部一键生效。
 */
async function handleReloadNginx() {
  if (!selectedProjectCode.value) {
    showMessage('请先选择项目配置', 'error')
    return
  }

  loading.reload = true
  try {
    const result = await reloadNginx(selectedProjectCode.value)
    const detail = result.stderr || result.stdout
    showMessage(detail ? `Nginx 重载成功：${detail}` : 'Nginx 重载成功', 'success')
  } catch (error: any) {
    showMessage(error.message || 'Nginx 重载失败', 'error')
  } finally {
    loading.reload = false
  }
}

/**
 * 保存当前模板编辑内容。
 */
async function handleSaveTemplate() {
  if (!selectedTemplateCode.value) {
    showMessage('请先选择模板', 'error')
    return
  }

  loading.save = true
  try {
    await saveTemplate(selectedTemplateCode.value, templateContent.value)
    showMessage('模板保存成功', 'success')
  } catch (error: any) {
    showMessage(error.message || '保存模板失败', 'error')
  } finally {
    loading.save = false
  }
}

/**
 * 生成最终落盘页面和 nginx 配置。
 */
async function handleGenerate() {
  if (!selectedTemplateCode.value) {
    showMessage('请先选择模板', 'error')
    return
  }
  if (!selectedProjectCode.value) {
    showMessage('请选择项目配置', 'error')
    return
  }

  loading.generate = true
  try {
    const resp = await generatePage({
      templateCode: selectedTemplateCode.value,
      projectCode: selectedProjectCode.value,
      data: buildPayloadData(),
      templateContent: templateContent.value,
      overwrite: overwrite.value
    })
    generateResult.value = resp
    showMessage('页面生成成功', 'success')
  } catch (error: any) {
    showMessage(error.message || '生成失败', 'error')
  } finally {
    loading.generate = false
  }
}

onMounted(async () => {
  await loadInitialData()
  await nextTick()
  clearPreview()
})
</script>

<style scoped>
.page-shell {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(0, 82, 204, 0.16), transparent 28%),
    linear-gradient(180deg, #f3f7ff 0%, #eef3f8 100%);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 82, 204, 0.08);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(18px);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: linear-gradient(135deg, #0052d9 0%, #3b7bff 100%);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  box-shadow: 0 12px 24px rgba(0, 82, 217, 0.25);
}

.brand-title {
  font-size: 24px;
  font-weight: 700;
  color: #12223a;
}

.brand-subtitle {
  margin-top: 4px;
  color: #5f6b7a;
  font-size: 13px;
}

.page-content {
  display: grid;
  grid-template-columns: 30% 30% minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  height: calc(100vh - 89px);
  min-height: 0;
  overflow: hidden;
}

.sidebar-column,
.form-column,
.preview-column {
  min-height: 0;
}

.panel-card {
  height: 100%;
  min-height: 0;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.06);
}

.panel-card--full {
  display: flex;
  flex-direction: column;
}

.section-title {
  margin: 20px 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: #12223a;
}

.section-title:first-child {
  margin-top: 0;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.template-item {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #dbe6f3;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.template-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(59, 123, 255, 0.12);
}

.template-item.active {
  border-color: #0052d9;
  background: linear-gradient(180deg, #edf4ff 0%, #ffffff 100%);
  box-shadow: 0 12px 28px rgba(0, 82, 217, 0.12);
}

.template-item__name {
  font-size: 15px;
  font-weight: 700;
  color: #12223a;
}

.template-item__code,
.template-item__desc {
  margin-top: 6px;
  font-size: 12px;
  color: #5f6b7a;
  word-break: break-all;
}

.project-descriptions,
.result-alert,
.template-alert {
  margin-top: 14px;
}

.form-section + .form-section {
  margin-top: 20px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.form-scroll-area {
  height: 90%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 6px;
}

.field-block {
  min-width: 0;
}

.field-block--full {
  grid-column: 1 / -1;
}

.field-label {
  margin-bottom: 8px;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.field-control {
  width: 100%;
}

.field-control--inline {
  padding-top: 4px;
}

.array-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.array-item {
  padding: 14px;
  border: 1px solid #dbe6f3;
  border-radius: 16px;
  background: #f8fbff;
}

.nested-form-item + .nested-form-item {
  margin-top: 10px;
}

.mini-label {
  margin-bottom: 6px;
  color: #526171;
  font-size: 12px;
  font-weight: 600;
}

.array-del-btn {
  margin-top: 12px;
}

.array-add-btn {
  align-self: flex-start;
}

.compact-upload {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.upload-preview-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 10px;
  border: 1px solid #dbe6f3;
  border-radius: 12px;
  background: #f8fbff;
}

.upload-preview-card--nested {
  margin-top: 8px;
}

.upload-preview-image {
  display: block;
  width: 120px;
  max-width: 100%;
  border-radius: 10px;
  border: 1px solid #dbe6f3;
  object-fit: cover;
}

.upload-preview-image--nested {
  width: 100px;
}

.preview-wrap,
.editor-wrap {
  height: 100%;
  min-height: 0;
}

.preview-wrap {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid #dbe6f3;
  background:
    radial-gradient(circle at top, rgba(59, 123, 255, 0.16), transparent 22%),
    linear-gradient(180deg, #f7faff 0%, #edf3fb 100%);
  padding: 24px;
  gap: 14px;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.phone-preview-stage {
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-note {
  flex-shrink: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  color: #526171;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
  border: 1px dashed rgba(0, 82, 217, 0.18);
}

.phone-preview {
  width: min(100%, 280px);
  padding: 14px 14px 18px;
  border-radius: 36px;
  background: linear-gradient(180deg, #1f2937 0%, #0f172a 100%);
  box-shadow:
    0 24px 50px rgba(15, 23, 42, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.phone-preview__speaker {
  width: 96px;
  height: 8px;
  margin: 0 auto 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
}

.phone-preview__screen {
  width: 100%;
  aspect-ratio: 390 / 844;
  max-height: min(58vh, 560px);
  overflow: hidden;
  border-radius: 28px;
  background: #fff;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.phone-preview__home {
  width: 88px;
  height: 6px;
  margin: 14px auto 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
}

.editor-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #526171;
  font-size: 12px;
}

.editor-tip {
  white-space: nowrap;
}

.code-editor {
  flex: 1;
  min-height: 520px;
}

:deep(.t-card__body) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

:deep(.form-column .t-card) {
  height: 100%;
}

:deep(.t-textarea__inner) {
  min-height: 520px;
  height: 100%;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  line-height: 1.6;
}

:deep(.preview-tabs) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

:deep(.preview-tabs .t-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

:deep(.preview-tabs .t-tab-panel) {
  height: 100%;
  min-height: 0;
}

@media (max-width: 1400px) {
  .page-content {
    grid-template-columns: 280px minmax(360px, 460px) minmax(0, 1fr);
  }
}

@media (max-width: 1080px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .page-content {
    grid-template-columns: 1fr;
    height: calc(100vh - 128px);
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .editor-tip {
    white-space: normal;
  }

  .phone-preview {
    width: min(100%, 260px);
  }
}
</style>
