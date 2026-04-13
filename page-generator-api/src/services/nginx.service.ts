export class NginxService {
  buildIncludeConf(params: {
    locationPath: string;
    distPath: string;
    indexFile?: string;
  }): string {
    const { locationPath, distPath, indexFile = 'index.html' } = params;

    return `
location ${locationPath} {
    alias ${distPath}/;
    index ${indexFile};
    try_files $uri $uri/ ${locationPath}${indexFile};
}
    `.trim();
  }
}