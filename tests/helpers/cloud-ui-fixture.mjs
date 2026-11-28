import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'

const require = createRequire(import.meta.url)

export function loadCloudUi(filename, apiMocks) {
    const modules = new Map()
    function evaluate(source) {
        const { outputText } = ts.transpileModule(source, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
        })
        const exports = {}
        new Function('exports', 'require', outputText)(exports, dependency => {
            if (Object.hasOwn(apiMocks, dependency)) return apiMocks[dependency]
            if (dependency === '@/i18n/i18n') return { useI18n: () => ({ locale: require('vue').ref('zh-cn') }) }
            if (dependency === '@/composables/overlay-z-index') return load('composables/overlay-z-index.ts')
            if (dependency.startsWith('@/components/ui/')) return load(dependency.slice(2))
            if (dependency.startsWith('./') && dependency.endsWith('.vue')) return load('components/ui/' + dependency.slice(2))
            return require(dependency)
        })
        return exports
    }
    function load(path) {
        if (modules.has(path)) return modules.get(path)
        const filename = new URL('../../src/' + path, import.meta.url)
        const source = readFileSync(filename, 'utf8')
        let code = source
        if (path.endsWith('.vue')) {
            const { descriptor, errors } = parse(source, { filename: filename.pathname })
            assert.deepEqual(errors, [], path)
            const id = path.replace(/[^\w-]/g, '-')
            code = compileScript(descriptor, {
                id,
                inlineTemplate: true,
                templateOptions: { compilerOptions: { isCustomElement: name => name.startsWith('i-ep-') } },
            }).content
        }
        const compiled = evaluate(code)
        modules.set(path, compiled)
        return compiled
    }
    return load(filename).default
}
