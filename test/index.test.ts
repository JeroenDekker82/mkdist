import { resolve } from 'pathe'
import { readFile } from 'fs-extra'
import { mkdist } from '../src/make'
import { createLoader } from '../src/loader'
import { jsLoader, vueLoader } from '../src/loaders'

describe('mkdist', () => {
  it('mkdist', async () => {
    const rootDir = resolve(__dirname, 'fixture')
    const { writtenFiles } = await mkdist({ rootDir })
    expect(writtenFiles.sort()).toEqual([
      'dist/README.md',
      'dist/foo.mjs',
      'dist/foo.d.ts', // manual
      'dist/index.mjs',
      'dist/types.d.ts',
      'dist/components/blank.vue',
      'dist/components/js.vue',
      'dist/components/script-setup-ts.vue',
      'dist/components/ts.vue',
      'dist/bar/index.mjs',
      'dist/bar/esm.mjs'
    ].map(f => resolve(rootDir, f)).sort())
  })

  it('mkdist (custom glob pattern)', async () => {
    const rootDir = resolve(__dirname, 'fixture')
    const { writtenFiles } = await mkdist({ rootDir, pattern: 'components/**' })
    expect(writtenFiles.sort()).toEqual([
      'dist/components/blank.vue',
      'dist/components/js.vue',
      'dist/components/script-setup-ts.vue',
      'dist/components/ts.vue'
    ].map(f => resolve(rootDir, f)).sort())
  })

  it('mkdist (emit types)', async () => {
    const rootDir = resolve(__dirname, 'fixture')
    const { writtenFiles } = await mkdist({ rootDir, declaration: true })
    expect(writtenFiles.sort()).toEqual([
      'dist/README.md',
      'dist/foo.mjs',
      'dist/foo.d.ts',
      'dist/index.mjs',
      'dist/index.d.ts',
      'dist/types.d.ts',
      'dist/components/blank.vue',
      'dist/components/js.vue',
      'dist/components/js.vue.d.ts',
      'dist/components/script-setup-ts.vue',
      'dist/components/ts.vue',
      'dist/components/ts.vue.d.ts',
      'dist/bar/index.mjs',
      'dist/bar/index.d.ts',
      'dist/bar/esm.mjs',
      'dist/bar/esm.d.mts'
    ].map(f => resolve(rootDir, f)).sort())

    expect(await readFile(resolve(rootDir, 'dist/foo.d.ts'), 'utf8')).toMatch('manual declaration')
    expect(await readFile(resolve(rootDir, 'dist/bar/esm.d.mts'), 'utf8')).toMatch('declare')
  }, 50000)
})

describe('createLoader', () => {
  it('loadFile returns undefined for an unsupported file', async () => {
    const { loadFile } = createLoader()
    const results = await loadFile({
      extension: '.noth',
      getContents: () => new Error('this should not be called') as any,
      path: 'another.noth'
    })
    expect(results).toMatchObject([{ raw: true }])
  })

  it('vueLoader handles no transpilation of script tag', async () => {
    const { loadFile } = createLoader({
      loaders: [vueLoader]
    })
    const results = await loadFile({
      extension: '.vue',
      getContents: () => '<script>Test</script>',
      path: 'test.vue'
    })
    expect(results).toMatchObject([{ raw: true }])
  })

  it('vueLoader handles script tags with attributes', async () => {
    const { loadFile } = createLoader({
      loaders: [vueLoader, jsLoader]
    })
    const results = await loadFile({
      extension: '.vue',
      getContents: () => '<script foo lang="ts">Test</script>',
      path: 'test.vue'
    })
    expect(results).toMatchObject([{ contents: ['<script foo>', 'Test;', '</script>'].join('\n') }])
  })

  it('vueLoader bypass <script setup>', async () => {
    const { loadFile } = createLoader({
      loaders: [vueLoader, jsLoader]
    })
    const results = await loadFile({
      extension: '.vue',
      getContents: () => '<script lang="ts" setup>Test</script>',
      path: 'test.vue'
    })
    expect(results).toMatchObject([{ raw: true }])
  })

  it('vueLoader will generate dts file', async () => {
    const { loadFile } = createLoader({
      loaders: [vueLoader, jsLoader],
      declaration: true
    })
    const results = await loadFile({
      extension: '.vue',
      getContents: () => '<script lang="ts">export default bob = 42 as const</script>',
      path: 'test.vue'
    })
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ declaration: true })
    ]))
  })

  it('jsLoader will generate dts file (.js)', async () => {
    const { loadFile } = createLoader({
      loaders: [jsLoader],
      declaration: true
    })
    const results = await loadFile({
      extension: '.js',
      getContents: () => 'export default bob = 42',
      path: 'test.mjs'
    })
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ declaration: true })
    ]))
  })

  it('jsLoader will generate dts file (.ts)', async () => {
    const { loadFile } = createLoader({
      loaders: [jsLoader],
      declaration: true
    })
    const results = await loadFile({
      extension: '.ts',
      getContents: () => 'export default bob = 42 as const',
      path: 'test.ts'
    })
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ declaration: true })
    ]))
  })
})
