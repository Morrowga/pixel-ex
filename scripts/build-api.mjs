import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

/**
 * Bundles the API into ONE file (api/_app.js). Vercel compiles TypeScript file by file and cannot resolve
 * imports written without extensions, so we bundle ourselves. The three small files below are the routes.
 */
await build({
  entryPoints: ['server/vercel.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'api/_app.js',
  // some bundled packages still use require(); give the ESM bundle one
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  legalComments: 'none',
  logLevel: 'warning',
})
for (const route of ['lesson', 'check', 'health']) writeFileSync(`api/${route}.js`, "export { default } from './_app.js'\n")
console.log('api/_app.js + routes written')
