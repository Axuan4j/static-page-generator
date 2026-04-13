import fs from 'fs-extra';
import path from 'path';
import { TemplateMeta } from '../types';
import { TEMPLATES_DIR } from '../utils/path';

export class TemplateService {
    async listTemplates(): Promise<TemplateMeta[]> {
        const dirs = await fs.readdir(TEMPLATES_DIR);
        const results: TemplateMeta[] = [];

        for (const dir of dirs) {
            const metaPath = path.join(TEMPLATES_DIR, dir, 'meta.json');
            if (await fs.pathExists(metaPath)) {
                const meta = await fs.readJson(metaPath);
                results.push(meta);
            }
        }

        return results;
    }

    async getTemplateMeta(templateCode: string): Promise<TemplateMeta> {
        const metaPath = path.join(TEMPLATES_DIR, templateCode, 'meta.json');
        if (!(await fs.pathExists(metaPath))) {
            throw new Error(`模板不存在: ${templateCode}`);
        }
        return fs.readJson(metaPath);
    }

    async getTemplateContent(templateCode: string): Promise<string> {
        const templatePath = path.join(TEMPLATES_DIR, templateCode, 'page.ejs');
        if (!(await fs.pathExists(templatePath))) {
            throw new Error(`模板文件不存在: ${templateCode}`);
        }
        return fs.readFile(templatePath, 'utf-8');
    }

    async saveTemplateContent(templateCode: string, content: string): Promise<void> {
        const templatePath = path.join(TEMPLATES_DIR, templateCode, 'page.ejs');
        await fs.writeFile(templatePath, content, 'utf-8');
    }

    getTemplateStaticDir(templateCode: string): string {
        return path.join(TEMPLATES_DIR, templateCode, 'static');
    }
}