import fs from 'fs-extra';
import path from 'path';
import {ROOT_DIR} from '../utils/path';

export interface QiniuConfig {
    accessKey: string;
    secretKey: string;
    bucket: string;
    domain: string;
}

interface QiniuConfigFile {
    ak?: unknown;
    sk?: unknown;
    bucket?: unknown;
    domain?: unknown;
}

const CONFIG_FILE = path.join(ROOT_DIR, 'config', 'qiniu.json');
const CONFIG_KEYS = {
    accessKey: 'ak',
    secretKey: 'sk',
    bucket: 'bucket',
    domain: 'domain'
} as const;

/**
 * 按需读取本地 JSON，使配置异常能够通过上传接口返回给页面，而不是阻止服务启动。
 */
export function getQiniuConfig(): QiniuConfig {
    const rawConfig = readConfigFile();
    const values = {
        accessKey: String(rawConfig.ak ?? '').trim(),
        secretKey: String(rawConfig.sk ?? '').trim(),
        bucket: String(rawConfig.bucket ?? '').trim(),
        domain: String(rawConfig.domain ?? '').trim()
    };

    const missingKeys = Object.entries(CONFIG_KEYS)
        .filter(([key]) => !values[key as keyof typeof values])
        .map(([, configKey]) => configKey);

    if (missingKeys.length > 0) {
        throw new Error(`七牛云配置缺失: ${missingKeys.join(', ')}`);
    }

    const domain = normalizeDomain(values.domain);
    return {...values, domain};
}

/**
 * 单独处理文件不存在和 JSON 语法错误，方便页面直接提示正确的修复方式。
 */
function readConfigFile(): QiniuConfigFile {
    if (!fs.pathExistsSync(CONFIG_FILE)) {
        throw new Error(`七牛云配置文件不存在: ${CONFIG_FILE}`);
    }

    try {
        const config = fs.readJsonSync(CONFIG_FILE) as unknown;
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            throw new Error('配置内容必须是 JSON 对象');
        }
        return config as QiniuConfigFile;
    } catch (error) {
        const reason = error instanceof Error ? error.message : '未知 JSON 解析错误';
        throw new Error(`七牛云配置文件格式错误: ${reason}`);
    }
}

/**
 * HTML 中需要写入可直接访问的完整地址，因此统一补全协议并拒绝非法域名。
 */
function normalizeDomain(value: string): string {
    const domain = (/^https?:\/\//i.test(value) ? value : `https://${value}`).replace(/\/+$/, '');

    try {
        const parsed = new URL(domain);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('protocol');
        }
    } catch {
        throw new Error('七牛云配置 domain 不是有效的 HTTP(S) 域名');
    }

    return domain;
}
