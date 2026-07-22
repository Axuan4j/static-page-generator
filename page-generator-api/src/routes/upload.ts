import { FastifyInstance } from 'fastify';
import {QiniuService, QiniuUploadError} from '../services/qiniu.service';
import {sanitizeFolderName} from '../utils/validate';

/**
 * 注册七牛云上传接口，并将成功地址或可读的异常原因返回页面。
 */
export async function uploadRoutes(app: FastifyInstance) {
    const qiniuService = new QiniuService();

    app.post('/api/upload', async (request, reply) => {
        let folderName = '';
        let uploadedFile: { buffer: Buffer; filename: string; mimetype: string } | undefined;
        let hasMultipleFiles = false;

        try {
            // 遍历全部 multipart 字段，保证 folderName 位于文件前后都能被正确读取。
            for await (const part of request.parts()) {
                if (part.type === 'file') {
                    if (uploadedFile) {
                        hasMultipleFiles = true;
                        part.file.resume();
                        continue;
                    }
                    uploadedFile = {
                        buffer: await part.toBuffer(),
                        filename: part.filename,
                        mimetype: part.mimetype
                    };
                } else if (part.fieldname === 'folderName') {
                    folderName = String(part.value ?? '');
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : '无法解析上传文件';
            return reply.status(400).send({
                success: false,
                code: 'INVALID_UPLOAD_REQUEST',
                message
            });
        }

        if (!uploadedFile || hasMultipleFiles) {
            return reply.status(400).send({
                success: false,
                code: 'INVALID_UPLOAD_REQUEST',
                message: hasMultipleFiles ? '每次只能上传一个文件' : '没有上传文件'
            });
        }

        try {
            folderName = sanitizeFolderName(folderName);
        } catch (error) {
            return reply.status(400).send({
                success: false,
                code: 'INVALID_UPLOAD_REQUEST',
                message: error instanceof Error ? error.message : 'folderName 非法'
            });
        }

        try {
            const url = await qiniuService.upload({
                buffer: uploadedFile.buffer,
                originalFilename: uploadedFile.filename,
                mimeType: uploadedFile.mimetype,
                folderName
            });

            return reply.send({success: true, url});
        } catch (error) {
            const uploadError = error instanceof QiniuUploadError
                ? error
                : new QiniuUploadError({reason: '未知上传异常'});

            // 日志只记录服务端已清理的诊断字段，避免 AK、SK 或上传凭证泄露。
            request.log.error({
                errorName: uploadError.name,
                message: uploadError.message,
                statusCode: uploadError.details.statusCode,
                requestId: uploadError.details.requestId
            }, '七牛云上传失败');

            return reply.status(502).send({
                success: false,
                code: 'QINIU_UPLOAD_FAILED',
                message: uploadError.message
            });
        }
    });
}
