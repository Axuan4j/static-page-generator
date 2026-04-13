import fs from 'fs-extra';
import path from 'path';
import { ProjectConfig } from '../types';
import { PROJECTS_DIR } from '../utils/path';

export class ProjectService {
    async listProjects(): Promise<ProjectConfig[]> {
        const files = await fs.readdir(PROJECTS_DIR);
        const results: ProjectConfig[] = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const config = await fs.readJson(path.join(PROJECTS_DIR, file));
                results.push(config);
            }
        }

        return results;
    }

    async getProject(projectCode: string): Promise<ProjectConfig> {
        const filePath = path.join(PROJECTS_DIR, `${projectCode}.json`);
        if (!(await fs.pathExists(filePath))) {
            throw new Error(`项目配置不存在: ${projectCode}`);
        }
        return fs.readJson(filePath);
    }
}