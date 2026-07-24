import type { FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

/** Required whenever routes declare Zod `schema` (including unit tests). */
export function applyZodCompilers(app: FastifyInstance): void {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
}
