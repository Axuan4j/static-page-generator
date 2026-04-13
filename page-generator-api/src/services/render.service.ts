import ejs from 'ejs';

function normalizeArrayValue(value: any) {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (item && typeof item === 'object' && 'value' in item) {
      return item.value;
    }
    return item;
  });
}

export class RenderService {
  private normalizeData(data: Record<string, any>) {
    const result: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      result[key] = normalizeArrayValue(data[key]);
    }
    return result;
  }

  render(templateContent: string, data: Record<string, any>): string {
    const normalized = this.normalizeData(data);
    return ejs.render(templateContent, normalized, {
      rmWhitespace: false
    });
  }
}