import { execFile } from 'child_process';
import { promisify } from 'util';
import type { FastifyInstance } from 'fastify';
import { ProjectService } from '../services/project.service';

const execFileAsync = promisify(execFile);

/**
 * 注册系统级操作接口，例如重新加载 Nginx 配置。
 */
export async function systemRoutes(app: FastifyInstance) {
    const projectService = new ProjectService();

    app.post('/api/system/nginx/reload', async (request) => {
        const body = (request.body || {}) as { projectCode?: string };
        if (!body.projectCode) {
            throw new Error('缺少项目编码，无法确定 Nginx 路径');
        }

        const project = await projectService.getProject(body.projectCode);
        if (!project.nginxBinPath) {
            throw new Error(`项目 ${project.code} 未配置 nginxBinPath`);
        }

        const result = await execFileAsync(project.nginxBinPath, ['-s', 'reload']);

        return {
            success: true,
            stdout: result.stdout?.trim() || '',
            stderr: result.stderr?.trim() || ''
        };
    });
}
