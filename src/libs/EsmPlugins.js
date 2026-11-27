/** @module */

/**
 * Loading of ES module plugins.
 *
 * An ES module plugin is listed in the config like any other plugin, with `type: 'module'` or a
 * `.mjs` url, and default exports the same function kiwi.plugin() takes:
 *
 *     import { h, ref } from 'vue';
 *     export default function myPlugin(kiwi, log) { ... }
 *
 * Plugins are built separately from Kiwi, so `vue` must resolve to the copy bundled in Kiwi:
 * two Vue runtimes do not share reactivity or components. Before the first such plugin is
 * imported, an import map is added that points the bare specifiers below at small modules
 * re-exporting what Kiwi already has on window.kiwi:
 *
 *     vue      -> window.kiwi.Vue (all of its named exports, plus default)
 *     kiwiirc  -> window.kiwi (default export)
 *
 * Plugin builds therefore mark `vue` and `kiwiirc` as external.
 */

// Words that are not valid as `export const <name>`
const reservedWords = new Set([
    'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
    'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function',
    'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null',
    'package', 'private', 'protected', 'public', 'return', 'static', 'super', 'switch', 'this',
    'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);

let importMapInstalled = false;

export function isEsmPlugin(plugin) {
    return plugin.type === 'module' || /\.mjs([?#]|$)/.test(plugin.url || '');
}

/**
 * Import an ES module plugin and register its default export with kiwi.plugin()
 * @param {Object} api The GlobalApi instance (window.kiwi)
 * @param {Object} plugin The plugin entry from the config: { name, url, type }
 */
export async function loadEsmPlugin(api, plugin) {
    installImportMap(api);

    // A relative import() in a classic script resolves against the script's url
    // (static/js/...), not the page, so resolve it against the page first
    const url = new URL(plugin.url, document.baseURI).href;
    const mod = await import(/* webpackIgnore: true */ url);

    if (typeof mod.default !== 'function') {
        throw new Error(`ES module plugin '${plugin.name}' has no default exported function`);
    }

    api.plugin(plugin.name, mod.default);
}

function installImportMap(api) {
    if (importMapInstalled) {
        return;
    }
    importMapInstalled = true;

    const importMap = document.createElement('script');
    importMap.type = 'importmap';
    importMap.textContent = JSON.stringify({
        imports: {
            vue: moduleUrl('window.kiwi.Vue', Object.keys(api.Vue)),
            kiwiirc: moduleUrl('window.kiwi', []),
        },
    });
    document.head.appendChild(importMap);
}

// A blob: module that re-exports a global object, and the given properties as named exports
function moduleUrl(globalExpression, names) {
    const named = names.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name) && !reservedWords.has(name));
    const source = [
        `const mod = ${globalExpression};`,
        'export default mod;',
        ...named.map((name) => `export const ${name} = mod[${JSON.stringify(name)}];`),
    ].join('\n');

    return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}
