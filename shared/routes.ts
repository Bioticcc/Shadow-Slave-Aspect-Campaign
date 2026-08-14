import { z } from 'zod';
import { insertCharacterSchema, characters } from './schema';

export { WS_EVENTS, type WsMessage } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  characters: {
    list: {
      method: 'GET' as const,
      path: '/api/characters' as const,
      responses: {
        200: z.array(z.custom<typeof characters.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/characters/:id' as const,
      responses: {
        200: z.custom<typeof characters.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/characters' as const,
      input: insertCharacterSchema,
      responses: {
        201: z.custom<typeof characters.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/characters/:id' as const,
      input: insertCharacterSchema.partial(),
      responses: {
        200: z.custom<typeof characters.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/characters/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  campaign: {
    state: {
      method: "GET" as const,
      path: "/api/campaign/state" as const,
      responses: {
        200: z.object({
          dayCount: z.number().int().min(1),
        }),
      },
    },
    updateDay: {
      method: "POST" as const,
      path: "/api/campaign/day" as const,
      input: z.object({
        delta: z.union([z.literal(-1), z.literal(1)]),
      }),
      responses: {
        200: z.object({
          dayCount: z.number().int().min(1),
        }),
        403: errorSchemas.notFound,
      },
    },
    setDay: {
      method: "POST" as const,
      path: "/api/campaign/day-set" as const,
      input: z.object({
        dayCount: z.coerce.number().int().min(1),
      }),
      responses: {
        200: z.object({
          dayCount: z.number().int().min(1),
        }),
        403: errorSchemas.notFound,
      },
    },
    passHour: {
      method: "POST" as const,
      path: "/api/campaign/hour-pass" as const,
      responses: {
        200: z.object({
          updatedCharacterIds: z.array(z.number().int()),
          message: z.string(),
        }),
        403: errorSchemas.notFound,
      },
    },
    undo: {
      method: "POST" as const,
      path: "/api/campaign/undo" as const,
      responses: {
        200: z.object({
          actionType: z.string(),
          dayCount: z.number().int().min(1),
          updatedCharacterIds: z.array(z.number().int()),
          message: z.string(),
        }),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type CharacterInput = z.infer<typeof api.characters.create.input>;
export type CharacterUpdateInput = z.infer<typeof api.characters.update.input>;
export type CharacterResponse = z.infer<typeof api.characters.create.responses[201]>;
export type CharacterListResponse = z.infer<typeof api.characters.list.responses[200]>;
export type CampaignStateResponse = z.infer<typeof api.campaign.state.responses[200]>;
