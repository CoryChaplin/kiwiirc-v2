/**
 * Babel plugin making the named exports of 'kiwi public' modules replaceable by plugins.
 *
 * ES module namespaces are read-only, but a module may reassign its own exported bindings, and
 * every importer sees the new value since imports are live bindings. So for each module with the
 * 'kiwi public' directive, this appends:
 *
 *     export function __kiwiReplace(name, value) {
 *         switch (name) {
 *         case 'formatText': formatText = value; return true;
 *         ...
 *         }
 *         return false;
 *     }
 *
 * kiwi.replaceModule() calls it for each export a plugin replaces. Exported `const` declarations
 * become `let` so they can be reassigned. Default exports are not handled here: replaceModule()
 * updates a default exported object (a component) in place instead.
 */
module.exports = function kiwiReplaceableExports(api) {
    const { types: t, template } = api;

    function isKiwiPublic(program) {
        return program.directives.some((d) => d.value.value === 'kiwi public');
    }

    return {
        name: 'kiwi-replaceable-exports',
        visitor: {
            Program(path) {
                if (!isKiwiPublic(path.node)) {
                    return;
                }

                // exported name -> local binding name
                const replaceable = new Map();
                const makeLet = (declaration) => {
                    if (declaration && declaration.kind === 'const') {
                        declaration.kind = 'let';
                    }
                };

                path.get('body').forEach((statement) => {
                    if (!statement.isExportNamedDeclaration() || statement.node.source) {
                        // Only the module's own bindings: not export ... from '...'
                        return;
                    }

                    const { declaration, specifiers } = statement.node;
                    if (declaration) {
                        if (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) {
                            replaceable.set(declaration.id.name, declaration.id.name);
                        } else if (t.isVariableDeclaration(declaration)) {
                            makeLet(declaration);
                            Object.keys(t.getBindingIdentifiers(declaration)).forEach((name) => {
                                replaceable.set(name, name);
                            });
                        }
                        return;
                    }

                    specifiers.forEach((specifier) => {
                        if (!t.isExportSpecifier(specifier)) {
                            return;
                        }
                        const local = specifier.local.name;
                        const exported = t.isIdentifier(specifier.exported) ?
                            specifier.exported.name :
                            specifier.exported.value;
                        if (exported === 'default') {
                            return;
                        }

                        const binding = path.scope.getBinding(local);
                        if (!binding || binding.kind === 'module') {
                            // A re-exported import is not this module's binding to assign
                            return;
                        }
                        if (binding.kind === 'const') {
                            makeLet(binding.path.parent);
                        }
                        replaceable.set(exported, local);
                    });
                });

                if (!replaceable.size) {
                    return;
                }

                const cases = [...replaceable]
                    .map(([exported, local]) => `case ${JSON.stringify(exported)}: ${local} = value; return true;`)
                    .join('\n');
                const setter = template.statement.ast(
                    `export function __kiwiReplace(name, value) { switch (name) { ${cases} } return false; }`,
                    { sourceType: 'module' }
                );
                path.pushContainer('body', setter);
            },
        },
    };
};
