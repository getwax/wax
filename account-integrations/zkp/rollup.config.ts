import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { readFileSync } from "fs";
import typescript from "rollup-plugin-typescript2";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

export default {
    input: "src/index.ts",
    output: [
        {
            file: pkg.exports.require,
            format: "cjs",
            exports: "auto"
        },
        {
            file: pkg.exports.import,
            format: "es",
        }
    ],
    external: Object.keys(pkg.dependencies),
    plugins: [
        typescript({
            tsconfig: "./tsconfig.json",
        }),
        nodeResolve(),
        commonjs({
            esmExternals: true
        }),
        nodePolyfills(),
    ]
}
