import { FastifyInstance } from 'fastify';
import { TemplateService } from '../services/template.service';
import { ProjectService } from '../services/project.service';

export async function templateRoutes(app: FastifyInstance) {
    const templateService = new TemplateService();
    const projectService = new ProjectService();

    app.get('/api/templates', async () => {
        return templateService.listTemplates();
    });

    app.get('/api/templates/:code', async (request) => {
        const {code} = request.params as { code: string };
        const meta = await templateService.getTemplateMeta(code);
        const content = await templateService.getTemplateContent(code);
        return {meta, content};
    });

    app.post('/api/templates/:code/save', async (request) => {
        const {code} = request.params as { code: string };
        const {content} = request.body as { content: string };
        await templateService.saveTemplateContent(code, content);
        return {success: true};
    });

    app.get('/api/projects', async () => {
        return projectService.listProjects();
    });
}