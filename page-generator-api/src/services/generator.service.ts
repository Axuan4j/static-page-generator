import fs from 'fs-extra';
import path from 'path';
import { GenerateRequest, GenerateResult } from '../types';
import { TemplateService } from './template.service';
import { ProjectService } from './project.service';
import { RenderService } from './render.service';
import { NginxService } from './nginx.service';
import { sanitizeFolderName } from '../utils/validate';

const PREVIEW_ASSET_BASE_URL = '';

/**
 * 负责模板预览和最终页面生成。
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
     * 生成最终静态页面、资源目录和 nginx include 配置。
     */
    async generate(req: GenerateRequest): Promise<GenerateResult> {
        const project = await this.projectService.getProject(req.projectCode);
        const meta = await this.templateService.getTemplateMeta(req.templateCode);
        const templateContent =
            req.templateContent || (await this.templateService.getTemplateContent(req.templateCode));

        const data = JSON.parse(JSON.stringify(req.data));
        const folderName = sanitizeFolderName(data.folderName);
        const outputDir = path.join(project.outputRoot, folderName);
        const htmlFile = path.join(outputDir, meta.output.htmlFile);
        const staticDir = path.join(outputDir, meta.output.staticDir);
        const nginxConfFile = path.join(project.nginxIncludeDir, `${folderName}.conf`);

        if (!req.overwrite && (await fs.pathExists(outputDir))) {
            throw new Error(`输出目录已存在: ${outputDir}`);
        }

        await fs.ensureDir(outputDir);
        await fs.ensureDir(staticDir);
        await fs.ensureDir(project.nginxIncludeDir);

        // 上传资源已经是七牛完整地址，直接渲染，避免再次转换为本地 static 路径。
        const html = this.renderService.render(templateContent, data);
        await fs.writeFile(htmlFile, html, 'utf-8');

        const templateStaticDir = this.templateService.getTemplateStaticDir(req.templateCode);
        if (await fs.pathExists(templateStaticDir)) {
            await fs.copy(templateStaticDir, staticDir, { overwrite: true });
        }

        const locationPrefix = project.locationPrefix.endsWith('/')
            ? project.locationPrefix
            : `${project.locationPrefix}/`;

        const locationPath = `${locationPrefix}${folderName}`;

        const nginxConf = this.nginxService.buildIncludeConf({
            locationPath,
            distPath: outputDir,
            indexFile: meta.output.htmlFile
        });

        await fs.writeFile(nginxConfFile, nginxConf, 'utf-8');

        return {
            success: true,
            outputDir,
            htmlFile,
            nginxConfFile
        };
    }
}
