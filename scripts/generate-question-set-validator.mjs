import { writeFile } from 'node:fs/promises';
import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone/index.js';
import schema from '../schemas/question-set-v1.json' with { type: 'json' };

const ajv = new Ajv({ allErrors: true, code: { source: true, esm: true } });
const validate = ajv.compile(schema);
const output = `${standaloneCode(ajv, validate)}\n`;

await writeFile(new URL('../lib/generated/question-set-v1-validator.js', import.meta.url), output, 'utf8');
