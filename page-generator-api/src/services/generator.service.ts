import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
import { GenerateRequest, GenerateResult } from '../types';
import { TemplateService } from './template.service';
import { ProjectService } from './project.service';
import { RenderService } from './render.service';
import { NginxService } from './nginx.service';
import { sanitizeFolderName } from '../utils/validate';
import { UPLOAD_DIR } from '../utils/path';

const PREVIEW_ASSET_BASE_URL = 'http://127.0.0.1:3000';

/**
 * 负责模板预览、图片落盘和最终页面生成。
 */
export class GeneratorService {
    constructor(
        private readonly templateService = new TemplateService(),
        private readonly projectService = new ProjectService(),
        private readonly renderService = new RenderService(),
        private readonly nginxService = new NginxService()
    ) {
    }

    /**
     * 在预览阶段将上传图片地址原样注入模板，保证 iframe 能直接加载。
     */
    async preview(req: { templateCode: string; data: Record<string, any>; templateContent?: string }) {
        const templateContent =
            req.templateContent || (await this.templateService.getTemplateContent(req.templateCode));

        const html = this.renderService.render(templateContent, req.data);
        return { html: this.injectPreviewBaseTag(html, req.templateCode) };
    }

    /**
     * 给预览 HTML 注入 base 地址，让模板内相对静态资源在 iframe 中也能正常加载。
     */
    private injectPreviewBaseTag(html: string, templateCode: string): string {
        const baseHref = `${PREVIEW_ASSET_BASE_URL}/template-assets/${templateCode}/`;
        const baseTag = `<base href="${baseHref}">`;
        if (html.includes('<head>')) {
            return html.replace('<head>', `<head>${baseTag}`);
        }
        return `${baseTag}${html}`;
    }

    /**
     * 将浏览器可访问的上传地址映射为本地临时文件路径，兼容旧的绝对路径数据。
     */
    private resolveUploadPath(value: string): string | null {
        if (value.startsWith(UPLOAD_DIR)) {
            return value;
        }

        const uploadMarker = '/uploads/';
        const markerIndex = value.indexOf(uploadMarker);
        if (markerIndex === -1) {
            return null;
        }

        const filename = value.slice(markerIndex + uploadMarker.length);
        if (!filename) {
            return null;
        }

        return path.join(UPLOAD_DIR, filename);
    }

    /**
     * 从表单数据中递归提取所有上传图片的临时文件路径。
     */
    private extractUploadedImages(data: Record<string, any>, uploadedFiles: string[] = []): string[] {
        for (const value of Object.values(data)) {
            if (typeof value === 'string') {
                const resolvedPath = this.resolveUploadPath(value);
                if (resolvedPath && !uploadedFiles.includes(resolvedPath)) {
                    uploadedFiles.push(resolvedPath);
                }
            } else if (Array.isArray(value)) {
                for (const item of value) {
                    if (typeof item === 'object' && item !== null) {
                        this.extractUploadedImages(item, uploadedFiles);
                    } else if (typeof item === 'string') {
                        const resolvedPath = this.resolveUploadPath(item);
                        if (resolvedPath && !uploadedFiles.includes(resolvedPath)) {
                            uploadedFiles.push(resolvedPath);
                        }
                    }
                }
            } else if (typeof value === 'object' && value !== null) {
                this.extractUploadedImages(value, uploadedFiles);
            }
        }

        return uploadedFiles;
    }

    /**
     * 将表单中的临时图片复制到最终 static 目录，并回写为页面内可用的相对路径。
     */
    private async processUploadedImages(data: Record<string, any>, staticDir: string): Promise<void> {
        await fs.ensureDir(staticDir);

        const replacePath = (value: string): string => {
            const uploadPath = this.resolveUploadPath(value);
            if (!uploadPath) {
                return value;
            }

            const ext = path.extname(uploadPath);
            const newFilename = `${randomUUID()}${ext}`;
            const newPath = path.join(staticDir, newFilename);
            fs.copyFileSync(uploadPath, newPath);
            return `./static/${newFilename}`;
        };

        const processObj = (obj: Record<string, any>): void => {
            for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'string') {
                    obj[key] = replacePath(obj[key]);
                } else if (Array.isArray(obj[key])) {
                    for (let i = 0; i < obj[key].length; i++) {
                        const item = obj[key][i];
                        if (typeof item === 'string') {
                            obj[key][i] = replacePath(item);
                        } else if (typeof item === 'object' && item !== null) {
                            processObj(item);
                        }
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    processObj(obj[key]);
                }
            }
        };

        processObj(data);
    }

    /**
     * 生成完成后清理上传目录中的临时文件，避免积累无用资源。
     */
    private async cleanupUploadedImages(data: Record<string, any>): Promise<void> {
        const uploadedFiles = this.extractUploadedImages(data);
        for (const file of uploadedFiles) {
            try {
                if (await fs.pathExists(file)) {
                    await fs.remove(file);
                }
            } catch (error) {
                console.error(`Failed to delete uploaded file: ${file}`, error);
            }
        }
    }

    /**
     * 生成最终静态页面、资源目录和 nginx include 配置。
     */
    async generate(req: GenerateRequest): Promise<GenerateResult> {
        const project = await this.projectService.getProject(req.projectCode);
        const meta = await this.templateService.getTemplateMeta(req.templateCode);
        const templateContent =
            req.templateContent || (await this.templateService.getTemplateContent(req.templateCode));

        const data = JSON.parse(JSON.stringify(req.data));
        const cleanupSourceData = JSON.parse(JSON.stringify(req.data));
        const folderName = sanitizeFolderName(data.folderName);
        const outputDir = path.join(project.outputRoot, folderName);
        const htmlFile = path.join(outputDir, meta.output.htmlFile);
        const staticDir = path.join(outputDir, meta.output.staticDir);
        const nginxConfFile = path.join(project.nginxIncludeDir, `${folderName}.conf`);

        if (!req.overwrite && (await fs.pathExists(outputDir))) {
            throw new Error(`输出目录已存在: ${outputDir}`);
        }

        await fs.ensureDir(outputDir);
        await fs.ensureDir(project.nginxIncludeDir);

        await this.processUploadedImages(data, staticDir);

        const html = this.renderService.render(templateContent, data);
        await fs.writeFile(htmlFile, html, 'utf-8');

        const templateStaticDir = this.templateService.getTemplateStaticDir(req.templateCode);
        if (await fs.pathExists(templateStaticDir)) {
            await fs.copy(templateStaticDir, staticDir, { overwrite: true });
        }

        const locationPrefix = project.locationPrefix.endsWith('/')
            ? project.locationPrefix
            : `${project.locationPrefix}/`;

        const locationPath = `${locationPrefix}${folderName}/`;

        const nginxConf = this.nginxService.buildIncludeConf({
            locationPath,
            distPath: outputDir,
            indexFile: meta.output.htmlFile
        });

        await fs.writeFile(nginxConfFile, nginxConf, 'utf-8');
        await this.cleanupUploadedImages(cleanupSourceData);

        return {
            success: true,
            outputDir,
            htmlFile,
            nginxConfFile
        };
    }
}
