import path from 'path';
import {randomUUID} from 'crypto';
import qiniu from 'qiniu';
import {getQiniuConfig, QiniuConfig} from '../config/qiniu';
import {sanitizeFolderName} from '../utils/validate';

export interface QiniuUploadInput {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
    folderName: string;
}

interface QiniuErrorDetails {
    statusCode?: number;
    requestId?: string;
    reason: string;
}

export class QiniuUploadError extends Error {
    constructor(
        public readonly details: QiniuErrorDetails
    ) {
        super(`七牛云上传失败：${details.reason}`);
        this.name = 'QiniuUploadError';
    }
}

/**
 * 负责生成上传凭证、上传内存文件并返回可直接写入模板的公开地址。
 */
export class QiniuService {
    async upload(input: QiniuUploadInput): Promise<string> {
        let config: QiniuConfig | undefined;

        try {
            config = getQiniuConfig();
            const folderName = sanitizeFolderName(input.folderName);
            const key = this.buildObjectKey(folderName, input.originalFilename);
            const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
            const uploadToken = new qiniu.rs.PutPolicy({
                scope: `${config.bucket}:${key}`,
                insertOnly: 1
            }).uploadToken(mac);

            // 不指定区域时由官方 SDK 根据 AK 与 Bucket 自动查询，避免部署环境绑定固定机房。
            const uploader = new qiniu.form_up.FormUploader(new qiniu.conf.Config());
            const putExtra = new qiniu.form_up.PutExtra();
            putExtra.mimeType = input.mimeType || 'application/octet-stream';

            const {data, resp} = await uploader.put(uploadToken, key, input.buffer, putExtra);
            const statusCode = resp.statusCode;
            const responseKey = typeof data?.key === 'string' ? data.key : '';

            // SDK 在部分异常场景不会直接 reject，因此必须同时检查 HTTP 状态和返回的对象 Key。
            if (statusCode !== 200 || responseKey !== key) {
                throw new QiniuUploadError({
                    statusCode,
                    requestId: this.extractRequestId(resp),
                    reason: this.redactSensitiveText(
                        this.extractResponseReason(data, statusCode),
                        config
                    ).slice(0, 300)
                });
            }

            return `${config.domain}/${this.encodeObjectKey(responseKey)}`;
        } catch (error) {
            if (error instanceof QiniuUploadError) {
                throw error;
            }

            throw new QiniuUploadError(this.toSafeErrorDetails(error, config));
        }
    }

    /**
     * UUID 避免同名覆盖；仅保留安全的短扩展名，folderName 则作为七牛对象的父路径。
     */
    private buildObjectKey(folderName: string, originalFilename: string): string {
        const rawExtension = path.extname(originalFilename).toLowerCase();
        const extension = /^\.[a-z0-9]{1,10}$/.test(rawExtension) ? rawExtension : '';
        return `${folderName}/${randomUUID()}${extension}`;
    }

    private encodeObjectKey(key: string): string {
        return key.split('/').map((part) => encodeURIComponent(part)).join('/');
    }

    private extractResponseReason(data: unknown, statusCode?: number): string {
        if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
            return data.error;
        }
        return statusCode ? `七牛服务返回状态码 ${statusCode}` : '七牛服务返回了无效响应';
    }

    private extractRequestId(resp: unknown): string | undefined {
        const headers = (resp as { headers?: Record<string, string | string[] | undefined> })?.headers;
        const requestId = headers?.['x-reqid'] || headers?.['x-req-id'];
        return Array.isArray(requestId) ? requestId[0] : requestId;
    }

    /**
     * 仅提取适合返回页面和日志定位的信息，并过滤凭证、Authorization 与上传 token。
     */
    private toSafeErrorDetails(error: unknown, config?: QiniuConfig): QiniuErrorDetails {
        const candidate = error as {
            message?: unknown;
            statusCode?: unknown;
            code?: unknown;
            requestId?: unknown;
            reqId?: unknown;
            data?: { error?: unknown };
            response?: { statusCode?: unknown; data?: { error?: unknown } };
        };
        const rawReason = candidate?.data?.error
            || candidate?.response?.data?.error
            || candidate?.message
            || '无法连接七牛云存储服务';
        const rawStatusCode = candidate?.statusCode || candidate?.response?.statusCode || candidate?.code;
        const statusCode = typeof rawStatusCode === 'number' ? rawStatusCode : undefined;
        const requestId = typeof candidate?.requestId === 'string'
            ? candidate.requestId
            : typeof candidate?.reqId === 'string' ? candidate.reqId : undefined;

        return {
            statusCode,
            requestId,
            reason: this.redactSensitiveText(String(rawReason), config).slice(0, 300)
        };
    }

    private redactSensitiveText(value: string, config?: QiniuConfig): string {
        let result = value
            .replace(/(authorization\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
            .replace(/([?&](?:token|uptoken)=)[^&\s]+/gi, '$1[REDACTED]');

        for (const secret of [config?.accessKey, config?.secretKey]) {
            if (secret) {
                result = result.split(secret).join('[REDACTED]');
            }
        }
        return result;
    }
}
