declare type ValidationError = {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
};

declare const validate: ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
export default validate;
