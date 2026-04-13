import { FastifyInstance } from 'fastify';
import fs from 'fs-extra';
import path from 'path';
import { UPLOAD_DIR } from '../utils/path';
import { randomUUID } from 'crypto';

/**
 * 注册图片上传接口，并返回浏览器可直接访问的静态地址。
 */
export async function uploadRoutes(app: FastifyInstance) {
    await fs.ensureDir(UPLOAD_DIR);

    app.post('/api/upload', async (request) => {
        const data = await request.file();
        if (!data) {
            throw new Error('没有上传文件');
        }

        const ext = path.extname(data.filename);
        const filename = `${randomUUID()}${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        await fs.writeFile(filepath, await data.toBuffer());

        return {
            success: true,
            url: `/uploads/${filename}`
        };
    });
}
