import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import fs from 'fs-extra'
import { templateRoutes } from './routes/templates'
import { previewRoutes } from './routes/preview'
import { generateRoutes } from './routes/generate'
import { uploadRoutes } from './routes/upload'
import { systemRoutes } from './routes/system'
import { PUBLIC_DIR, TEMPLATES_DIR, UPLOAD_DIR } from './utils/path'

/**
 * 启动 Fastify 服务并注册页面生成相关接口。
 */
async function bootstrap() {
  const app = Fastify({
    logger: true
  })

  const hasPublicSite = await fs.pathExists(PUBLIC_DIR)

  await app.register(cors, {
    origin: true
  })

  await app.register(multipart)

  await app.register(fastifyStatic, {
    root: UPLOAD_DIR,
    prefix: '/uploads/',
    decorateReply: false
  })

  await app.register(fastifyStatic, {
    root: TEMPLATES_DIR,
    prefix: '/template-assets/',
    decorateReply: false
  })

  await app.register(templateRoutes)
  await app.register(previewRoutes)
  await app.register(generateRoutes)
  await app.register(uploadRoutes)
  await app.register(systemRoutes)

  if (hasPublicSite) {
    await app.register(fastifyStatic, {
      root: PUBLIC_DIR,
      prefix: '/'
    })

    app.setNotFoundHandler(async (request, reply) => {
      const url = request.url || '/'
      if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/template-assets/')) {
        return reply.status(404).send({
          success: false,
          message: `路由不存在: ${url}`
        })
      }
      return reply.sendFile('index.html')
    })
  }

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)
    reply.status(400).send({
      success: false,
      message: error.message
    })
  })

  await app.listen({
    port: 3000,
    host: '0.0.0.0'
  })

  console.log('server started at http://0.0.0.0:3000')
}

bootstrap().then(() => {
    console.log('Happy developing ✨')
})
