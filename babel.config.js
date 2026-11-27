const presetEnv = (modules) => [
    '@babel/preset-env',
    {
        useBuiltIns: 'entry',
        // Keep ES modules for webpack. The plugin API no longer needs CommonJS `exports`
        // (see build/plugins/webpack/kiwi-exports.js)
        modules,
        corejs: { version: 3, proposals: true },
    },
];

module.exports = {
    presets: [presetEnv(false)],
    plugins: [
        [
            '@babel/plugin-transform-runtime',
            {
                corejs: 3,
                useESModules: true,
            },
        ],
    ],
    env: {
        // Jest runs tests as CommonJS
        test: {
            presets: [presetEnv('commonjs')],
        },
    },
};
