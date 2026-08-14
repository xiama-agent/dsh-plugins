// Strict Host TYPERT manifest for dsh-filecard. Consumed automatically by
// dsh-typert-loader: registers the strict invocation so the Typert Gateway
// dispatches /api/cardStore/storeFile to the `storeFile` method on the
// registered "cardStore" Service. Strict mode needs no @Remote marker.
//
// The two parameters (name, dataBase64) use wire names matching the storeFile
// source signature; the gateway asserts the client's args object has EXACTLY
// these fields (no extra wrapper).
import { z } from 'zod'

const nameSchema = z.string().optional()
const dataBase64Schema = z.string()

const storeFileResultSchema = z.object({
  path: z.string(),
  size: z.number(),
})

export const TYPERT = {
  package: 'dsh-filecard',
  face: 'host',
  schemas: [],
  invocations: [
    {
      id: 'dsh-filecard#cardStore/storeFile',
      service: 'cardStore',
      namespace: 'cardStore',
      method: 'storeFile',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'name',
          wire: 'name',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-filecard#StoreFileName',
            schema: nameSchema,
          },
        },
        {
          name: 'dataBase64',
          wire: 'dataBase64',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-filecard#StoreFileDataBase64',
            schema: dataBase64Schema,
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-filecard#StoreFileResult', schema: storeFileResultSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
  ],
  model: {
    services: [
      {
        description: 'Stores files dropped on the browser file card as real workspace paths under the configured uploads directory (DSH_UPLOAD_DIR, default ~/uploads).',
        summary: 'File card storage service.',
        tags: [],
        jsDoc: 'Writes base64 TEXT via fs, decodes with shell base64 -d, returns the absolute path.',
        key: 'cardStore',
        exportName: 'FileCardService',
        members: [
          {
            kind: 'method',
            name: 'storeFile',
            signature: 'storeFile(name: string | undefined, dataBase64: string): Promise<StoreFileResult>',
            summary: 'Store one dropped file and return its absolute path.',
            jsDoc: 'Returns { path, size } or throws on invalid payload / decode failure.',
          },
        ],
        types: [
          { name: 'StoreFileName', declaration: 'export type StoreFileName = string | undefined' },
          { name: 'StoreFileDataBase64', declaration: 'export type StoreFileDataBase64 = string' },
          { name: 'StoreFileResult', declaration: 'export type StoreFileResult = { path: string; size: number }' },
        ],
      },
    ],
    events: [],
    objects: [],
  },
}

export default TYPERT
