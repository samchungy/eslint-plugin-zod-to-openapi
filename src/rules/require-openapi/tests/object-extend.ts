import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const ZodObject = z
  .object({
    prop: z.string().openapi({ description: 'prop' }),
  })
  .openapi({ description: 'object description' });

export const extended = ZodObject.extend({
  prop2: z.string().openapi({ description: 'prop2' }),
});
