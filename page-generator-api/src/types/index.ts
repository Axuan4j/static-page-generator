export interface FieldOption {
  label: string;
  value: string | number | boolean;
}

export interface ArrayItemField {
  key: string;
  label: string;
  type: 'input' | 'textarea' | 'number' | 'select' | 'image';
  required?: boolean;
  options?: FieldOption[];
}

export interface TemplateField {
  key: string;
  label: string;
  type: 'input' | 'textarea' | 'number' | 'select' | 'switch' | 'array' | 'image';
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: FieldOption[];
  itemFields?: ArrayItemField[];
}

export interface TemplateMeta {
  code: string;
  name: string;
  description?: string;
  engine: 'ejs';
  output: {
    htmlFile: string;
    staticDir: string;
  };
  fixedFields: TemplateField[];
  dynamicFields: TemplateField[];
}

export interface ProjectConfig {
  code: string;
  name: string;
  outputRoot: string;
  nginxIncludeDir: string;
  nginxBinPath?: string;
  locationPrefix: string;
  domain?: string;
}

export interface PreviewRequest {
  templateCode: string;
  data: Record<string, any>;
  templateContent?: string;
}

export interface GenerateRequest {
  templateCode: string;
  projectCode: string;
  data: Record<string, any>;
  templateContent?: string;
  overwrite?: boolean;
}

export interface GenerateResult {
  success: boolean;
  outputDir: string;
  htmlFile: string;
  nginxConfFile: string;
}
