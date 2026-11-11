/* eslint-disable */

const path = require("path")
const { readFileSync, existsSync } = require("fs")
// const webpack = require("webpack")
const { execSync } = require("child_process")
const yaml = require("js-yaml")
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin")
const AutoImport = require("unplugin-auto-import/webpack")
const Components = require("unplugin-vue-components/webpack")
const { ElementPlusResolver } = require("unplugin-vue-components/resolvers")
const IconsResolver = require("unplugin-icons/resolver")
const Icons = require("unplugin-icons/webpack")
const webpack = require('webpack')

const revision = JSON.parse(readFileSync("./package.json").toString()).displayVersion
console.log("revision: ", revision)

const version = JSON.parse(readFileSync("./package.json").toString()).displayVersion || "no version"

function getEnv() {
    const filename = process.env.ENV_FILE

    let result = {}
    if (existsSync(filename)) {
        const content = readFileSync(filename).toString()
        const parsed = yaml.load(content)
        // console.log(parsed)
        result = parsed
    }

    return result
}

function convertKVToDefinePlugin(obj) {
    let result = {}
    for (const key in obj) {
        const value = obj[key]
        const valueType = typeof value

        if (valueType === "string") {
            result[key] = "\"" + value + "\""
        } else if (valueType === "number") {
            result[key] = value
        } else if (valueType === "boolean") {
            result[key] = value.toString()
        } else {
            throw new Error("wrong type")
        }
    }

    return result
}

const customEnv = getEnv()

const mobileUI = !!customEnv.MONA_MOBILE
const mobileComponentNames = new Set(require('./script/mobile-components.cjs'))
const mobileResolver = name => mobileUI && mobileComponentNames.has(name) ? { name, from: '@/mobile/index.js' } : undefined

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth()
const date = now.getDate()
const buildDate = `${year}/${month + 1}/${date}`




module.exports = {
    outputDir: customEnv.MONA_MOBILE ? 'dist-mobile' : 'dist',
    parallel: false,
    publicPath: process.env.PublicPath || '/',
    devServer: {
        proxy: {
            "^/api/compute_result/analysis": {
                // target: "http://localhost:8000"
                target: "https://www.mona-uranai.com/"
            },
            "^/api": {
                target: "http://localhost:8000/",
                changeOrigin: true
            }
        }
    },
    configureWebpack: {
        plugins: [
            ...(mobileUI ? [
                new webpack.NormalModuleReplacementPlugin(/^element-plus$/, resource => { resource.request = path.resolve(__dirname, 'src/mobile/index.js') }),
                new webpack.NormalModuleReplacementPlugin(/^element-plus\/es\/components\/.+\/style\/css$/, resource => { resource.request = path.resolve(__dirname, 'src/mobile/empty.js') }),
            ] : []),
            new webpack.NormalModuleReplacementPlugin(/^node:crypto$/, resource => { resource.request = path.resolve(__dirname, 'src/platform/crypto-browser.mjs') }),
            AutoImport({
                imports: ["vue"],
                resolvers: [
                    mobileResolver,
                    ElementPlusResolver(),
                    IconsResolver({
                        prefix: "Icon"
                    })
                ],
                dts: process.env.NODE_ENV === 'production' ? false : path.resolve(__dirname, "src", 'auto-imports.d.ts'),
            }),
            Components({
                resolvers: [
                    mobileResolver,
                    ElementPlusResolver(),
                    IconsResolver({
                        enabledCollections: ["ep", "fa6-brands", "fa6-solid"]
                    })
                ],

                dts: process.env.NODE_ENV === 'production' ? false : path.resolve(__dirname, "src", 'components.d.ts'),
            }),
            Icons({
                autoInstall: true
            }),
        ],
        resolve: {
            extensions: [".vue", ".png", ".jpg", ".webp"],
            alias: {
                ...(mobileUI ? {
                    '@page/MainPage$': path.resolve(__dirname,'src/mobile/MobileMainPage.vue'),
                    'radix-vue$': path.resolve(__dirname,'mobile/node_modules/radix-vue/dist/index.js'),
                    'class-variance-authority$': path.resolve(__dirname,'mobile/node_modules/class-variance-authority/dist/index.mjs'),
                    'clsx$': path.resolve(__dirname,'mobile/node_modules/clsx/dist/clsx.mjs'),
                    'tailwind-merge$': path.resolve(__dirname,'mobile/node_modules/tailwind-merge/dist/bundle-mjs.mjs'),
                    'vue$': path.resolve(__dirname,'node_modules/vue/dist/vue.runtime.esm-bundler.js'),
                } : {}),
                "@c": path.resolve(__dirname, "src/components"),
                "@asset": path.resolve(__dirname, "src/assets"),
                "@util": path.resolve(__dirname, "src/utils"),
                "@alg": path.resolve(__dirname, "src/algorithms"),
                "@page": path.resolve(__dirname, "src/pages"),
                "@worker": path.resolve(__dirname, "src/workers"),
                "@const": path.resolve(__dirname, "src/constants"),
                "@enemy": path.resolve(__dirname, "src/enemies"),
                "mona": path.resolve(__dirname, "mona_wasm/pkg"),
                // "monaBg": path.resolve(__dirname, "sub/mona_wasm/pkg")

                "@wasm": path.resolve(__dirname, "src/wasm"),
                "@character": path.resolve(__dirname, "src/assets/character"),
                "@weapon": path.resolve(__dirname, "src/assets/weapon"),
                "@targetFunction": path.resolve(__dirname, "src/assets/target_function"),
                "@potentialFunction": path.resolve(__dirname, "src/assets/potential_function"),
                "@buff": path.resolve(__dirname, "src/assets/buff"),
                "@image": path.resolve(__dirname, "src/images"),
                "@artifact": path.resolve(__dirname, "src/assets/artifacts"),
                // "genshin_panel": path.resolve(__dirname, "../../ts/genshin/dist"),
            }
        },
        experiments: {
            topLevelAwait: true,
            asyncWebAssembly: true
        },
    },
    chainWebpack: config => {
        // Let the browser parse the newer release WASM (the old webpack parser
        // cannot read its data-count section). Keep ordinary Rust builds intact.
        config.module.rule('release-wasm-asset').resourceQuery(/raw-wasm/).type('asset/resource')
        // use custom i18n loader
        config.module.rule("i18n-js")
            .test(/\.i18n$/)
            .use("i18n-loader")
                .loader("./loaders/i18n_loader.js")

        // merge custom env
        config.plugin("define").tap(definitions => {
            const definePluginConverted = convertKVToDefinePlugin(customEnv)
            definitions[0]["process.env"] = Object.assign(definitions[0]["process.env"], definePluginConverted, {
                MONA_MOBILE: mobileUI ? "true" : "false",
                MONA_VERSION: `"${version}"`,
                MONA_BUILD_DATE: `"${buildDate}"`,
                MONA_REVISION: `"${revision}"`
            })
            console.log(definitions)
            return definitions
        })

        config.plugin("monaco").use(new MonacoWebpackPlugin())
    },
    productionSourceMap: false,
}
