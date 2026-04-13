import { FastifyInstance } from 'fastify';
import { GeneratorService } from '../services/generator.service';
import { PreviewRequest } from '../types';

export async function previewRoutes(app: FastifyInstance) {
    const generatorService = new GeneratorService();

    app.post('/api/preview', async (request) => {
        const body = request.body as PreviewRequest;
        return generatorService.preview(body);
    });
}