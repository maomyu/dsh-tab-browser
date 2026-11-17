import { build } from 'esbuild'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outdir = resolve(root, 'dist')
await mkdir(outdir, { recursive: true })
await Promise.all([
  copyFile(resolve(root, 'node_modules/@novnc/novnc/LICENSE.txt'), resolve(outdir, 'LICENSE.noVNC')),
  copyFile(resolve(root, 'node_modules/ws/LICENSE'), resolve(outdir, 'LICENSE.ws')),
  build({
    absWorkingDir: root, entryPoints: ['src/host.js'], outdir, bundle: true,
    platform: 'node', format: 'esm', target: 'node22',
    external: ['bufferutil', 'utf-8-validate'],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  }),
  build({
    absWorkingDir: root, entryPoints: ['src/viewer.js', 'src/page-viewer.js'], outdir, bundle: true,
    platform: 'browser', format: 'esm', target: 'es2023', legalComments: 'linked',
  }),
  build({
    absWorkingDir: root, entryPoints: ['src/client.jsx'], outfile: `${outdir}/client.js`,
    bundle: true, write: false, platform: 'browser', format: 'cjs', target: 'es2023',
    external: ['react', 'react/jsx-runtime'], jsx: 'automatic',
  }).then(({ outputFiles }) => writeFile(`${outdir}/client.js`, `window.__ModuleLoader__.load({ id: 'dsh-tab-browser', factory(require) {\nconst module = { exports: {} };\n${outputFiles[0].text}\nreturn module.exports;\n} });\n`)),
])
