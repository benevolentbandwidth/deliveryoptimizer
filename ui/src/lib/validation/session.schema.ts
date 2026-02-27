import { z } from "zod"
import { optimizeRequestSchema } from "./optimize.schema"

export const sessionSaveSchema = z.object({
  version: z.literal(1),
  savedAt: z.string().datetime(),
  data: optimizeRequestSchema,
})

export type SessionSaveFile =
  z.infer<typeof sessionSaveSchema>

export function parseSessionSaveFile(input: unknown): SessionSaveFile {
  return sessionSaveSchema.parse(input)
}