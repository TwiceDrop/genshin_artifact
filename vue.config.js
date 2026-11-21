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


const now = new Date()
const year = now.getFullYear()
const month = now.getMonth()
const date = now.getDate()
const buildDate = `${year}/${month + 1}/${date}`




module.exports = {
    outputDir: 'dist',
    parallel: false,
    publicPath: process.env.PublicPath || '/',
    devServer: {
        setupMiddlewares(middlewares, devServer) {
            let localHandler
            // Serve desktop APIs at the page origin. Other API paths keep their configured proxies.
            const localPrefixes = ["/api/cloud/", "/api/mys/", "/api/update/", "/api/patch/"]
            middlewares.unshift({ name: "mona-local-api", middleware(req, res, next) {
                const pathname = req.url.split("?", 1)[0]
                if (pathname !== "/api/calculation/session" && pathname !== "/api/usage-stats"
                    && !localPrefixes.some(prefix => pathname.startsWith(prefix))) return next()
                if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) {
                    return res.status(403).json({ error: "仅允许本机访问" })
                }
                localHandler ||= import("./server/local.mjs").then(({ createLocalRequestHandler }) =>
                    createLocalRequestHandler(devServer.server))
                return localHandler.then(handle => handle(req, res)).catch(next)
            } })
            return middlewares
        },
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
            new webpack.NormalModuleReplacementPlugin(/^node:crypto$/, resource => { resource.request = path.resolve(__dirname, 'src/platform/crypto-browser.mjs') }),
            AutoImport({
                imports: ["vue"],
                resolvers: [
                    ElementPlusResolver(),
                    IconsResolver({
                        prefix: "Icon"
                    })
                ],
                dts: process.env.NODE_ENV === 'production' ? false : path.resolve(__dirname, "src", 'auto-imports.d.ts'),
            }),
            Components({
                resolvers: [
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
                VUE_APP_MONA_CLOUD_URL: JSON.stringify(process.env.VUE_APP_MONA_CLOUD_URL || require('./server/desktop-cloud-url.cjs')),
                MONA_VERSION: `"${version}"`,
                MONA_BUILD_DATE: `"${buildDate}"`,
                MONA_REVISION: `"${revision}"`
            })
            return definitions
        })

        config.plugin("monaco").use(new MonacoWebpackPlugin())
    },
    productionSourceMap: false,
}
