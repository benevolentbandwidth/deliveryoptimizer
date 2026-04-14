import { z } from "zod"
import { optimizeRequestSchema } from "./optimize.schema"

export const sessionSaveV1Schema = z.object({
  version: z.literal(1),
  savedAt: z.string().datetime(),
  data: optimizeRequestSchema,
})

export type SessionSaveV1 = z.infer<typeof sessionSaveV1Schema>


// for future - When introducing a new save file version - 
// 1. add a new schema
// 2. extend the discriminatedUnion
// 3. add migration logic in migrateSessionSaveFile()

// Union of supported versions
export const sessionSaveSchema = z.discriminatedUnion("version", [
  sessionSaveV1Schema,
])

export type SessionSaveFile = z.infer<typeof sessionSaveSchema>

export function migrateSessionSaveFile(input: unknown): SessionSaveFile {
  const parsed = sessionSaveSchema.parse(input)

  switch (parsed.version) {
    case 1:
      return parsed
  }
}
