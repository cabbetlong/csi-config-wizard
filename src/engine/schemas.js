// 配置数据 JSON Schema（配置自校验，Q12 第 0 级 + 维护保障）。
// 页面加载时逐文件校验，配置错误立即报出，避免"加配置改出 bug"。

import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const conditionSchema = {
  oneOf: [
    { type: 'string' },
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        field: { type: 'string' },
        state: { type: 'string' },
        op: { enum: ['eq', 'neq', 'in', 'not-in', 'exists', 'empty'] },
        value: {},
        eq: {}, neq: {}, in: { type: 'array' }, 'not-in': { type: 'array' },
        exists: {}, empty: {},
        all: { type: 'array', items: { $ref: '#/$defs/condition' } },
        any: { type: 'array', items: { $ref: '#/$defs/condition' } },
        not: { $ref: '#/$defs/condition' },
      },
      additionalProperties: false,
    },
  ],
}

const fieldSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'label_zh', 'label_en', 'type'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9]+\\.[a-zA-Z0-9._-]+$' },
    label_zh: { type: 'string' },
    label_en: { type: 'string' },
    type: {
      enum: [
        'text', 'textarea', 'number', 'select', 'bool', 'list', 'key-value-list',
        'json-text', 'select-family', 'select-service', 'select-protocol', 'select-platform',
      ],
    },
    required: { type: 'boolean' },
    default: {},
    level: { enum: ['basic', 'advanced'] },
    options: { type: 'array', items: { type: 'string' } },
    options_from: { enum: ['family.protocols', 'state.backends'] },
    item: { type: 'object', properties: { type: { type: 'string' }, validate: { type: 'object' } }, additionalProperties: true },
    validate: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pattern: { type: 'string' },
        min: { type: 'number' },
        max: { type: 'number' },
        enum: { type: 'array', items: {} },
      },
    },
    visible_when: { $ref: '#/$defs/condition' },
    required_when: { $ref: '#/$defs/condition' },
    placeholder_zh: { type: 'string' },
    placeholder_en: { type: 'string' },
    help_zh: { type: 'string' },
    help_en: { type: 'string' },
    hook: { type: 'string' },
  },
}

export function buildSchemas() {
  const ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv)

  const schemas = {
    'index.yaml': {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'schemaVersion', 'flow'],
      properties: {
        version: { type: 'string' },
        schemaVersion: { type: 'number' },
        title_zh: { type: 'string' },
        title_en: { type: 'string' },
        flow: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'artifact', 'label_zh', 'label_en', 'file', 'template'],
            properties: {
              id: { type: 'string' },
              artifact: { type: 'string' },
              label_zh: { type: 'string' },
              label_en: { type: 'string' },
              file: { type: 'string' },
              template: { type: 'string' },
              commands: { type: 'string' },
              multi: { type: 'boolean' },
            },
          },
        },
      },
    },
    'fields.yaml': {
      type: 'object',
      additionalProperties: false,
      required: ['fields'],
      properties: {
        fields: { type: 'array', items: fieldSchema },
      },
      $defs: { condition: conditionSchema },
    },
    'families.yaml': {
      type: 'object',
      additionalProperties: false,
      required: ['families'],
      properties: {
        families: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'label_zh', 'label_en', 'serviceTypes'],
            properties: {
              id: { type: 'string' },
              label_zh: { type: 'string' },
              label_en: { type: 'string' },
              serviceTypes: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['label_zh', 'label_en', 'storage', 'volumeType', 'protocols', 'defaultProtocol'],
                  properties: {
                    label_zh: { type: 'string' },
                    label_en: { type: 'string' },
                    storage: { type: 'string' },
                    volumeType: { enum: ['lun', 'fs', 'dtree'] },
                    protocols: { type: 'array', items: { type: 'string' } },
                    defaultProtocol: { type: 'string' },
                    features: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    'helm.yaml': {
      type: 'object',
      additionalProperties: false,
      required: ['defaultPlatform', 'platforms'],
      properties: {
        defaultPlatform: { type: 'string' },
        platforms: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'label_zh', 'label_en'],
            properties: {
              id: { type: 'string' },
              label_zh: { type: 'string' },
              label_en: { type: 'string' },
              presets: { type: 'object' },
              installMode: { type: 'string' },
            },
          },
        },
      },
    },
    'pitfalls.yaml': {
      type: 'object',
      additionalProperties: false,
      required: ['pitfalls'],
      properties: {
        pitfalls: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'artifact', 'text_zh', 'text_en'],
            properties: {
              id: { type: 'string' },
              artifact: { type: 'string' },
              when: { $ref: '#/$defs/condition' },
              text_zh: { type: 'string' },
              text_en: { type: 'string' },
            },
          },
        },
      },
      $defs: { condition: conditionSchema },
    },
    'i18n/zh.yaml': { type: 'object', additionalProperties: { type: 'string' } },
    'i18n/en.yaml': { type: 'object', additionalProperties: { type: 'string' } },
  }

  const compiled = {}
  for (const [name, schema] of Object.entries(schemas)) {
    const validate = ajv.compile(schema)
    compiled[name] = (data) => {
      if (!validate(data)) {
        const first = validate.errors?.[0]
        const where = first ? `${first.instancePath || '/'} ${first.message}` : '未知错误'
        throw new Error(`配置 ${name} 校验失败：${where}`)
      }
    }
  }
  return { validators: compiled }
}

export class ConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConfigError'
  }
}
