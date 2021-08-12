import { nodeResolve } from '@rollup/plugin-node-resolve';
export default {
    input: 'src/main.js',
    output: {
        file: 'build/main.js',
    },
    plugins: [
        nodeResolve(),
    ],
}