import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(currentDir, '..')
const sourceDir = path.join(webRoot, 'dist')
const targetDir = path.resolve(webRoot, '../page-generator-api/public')

/**
 * 构建完成后将前端静态资源同步到 API 项目目录。
 */
async function copyToApiPublic() {
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true })
  console.log(`Copied web dist to ${targetDir}`)
}

copyToApiPublic().catch((error) => {
  console.error('Failed to copy web dist to API public directory', error)
  process.exit(1)
})
