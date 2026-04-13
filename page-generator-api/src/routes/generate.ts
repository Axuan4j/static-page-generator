import { FastifyInstance } from 'fastify';
import { GeneratorService } from '../services/generator.service';
import { GenerateRequest } from '../types';

export async function generateRoutes(app: FastifyInstance) {
    const generatorService = new GeneratorService();

    app.post('/api/generate', async (request) => {
        const body = request.body as GenerateRequest;
        return generatorService.generate(body);
    });
}