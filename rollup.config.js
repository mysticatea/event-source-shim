import babel from "rollup-plugin-babel"
import minify from "rollup-plugin-babel-minify"
import resolve from "rollup-plugin-node-resolve"
import typescript from "rollup-plugin-typescript"

const banner = `/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */`
const umdOutro = `if (typeof module === "undefined" && typeof define === "undefined") {
    const global = Function("return this")()
    if (typeof global.EventSource === "undefined") {
        global.EventSource = EventSource
    }
}
`

export default [
    {
        external: ["event-target-shim"],
        input: "src/event-source.ts",
        output: {
            banner,
            file: "dist/event-source.mjs",
            format: "es",
            sourcemap: true,
        },
        plugins: [typescript({ module: "es2015" })],
    },
    {
        external: ["event-target-shim"],
        input: "src/event-source.ts",
        output: {
            banner,
            file: "dist/event-source.js",
            format: "cjs",
            sourcemap: true,
        },
        plugins: [typescript({ module: "es2015" })],
    },
    {
        input: "src/event-source.ts",
        output: {
            file: "dist/event-source.umd.js",
            format: "umd",
            name: "EventSourceShim",
            outro: umdOutro,
            sourcemap: true,
        },
        plugins: [
            resolve(),
            typescript({
                module: "es2015",
                target: "es2018",
            }),
            babel({
                babelrc: false,
                extensions: [".mjs", ".ts"],
                include: ["**/*.mjs", "**/*.ts"],
                presets: [
                    [
                        "@babel/env",
                        {
                            debug: true,
                            modules: false,
                            targets: { ie: "11" },
                            useBuiltIns: "usage",
                        },
                    ],
                ],
                sourceMaps: true,
            }),
            minify({
                comments: false,
                banner,
                sourceMap: true,
            }),
        ],
    },
]
