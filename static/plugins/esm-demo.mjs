// Example ES module plugin, loaded with:
//     { "name": "esm-demo", "url": "static/plugins/esm-demo.mjs" }
//
// `vue` and `kiwiirc` are bare specifiers resolved by the import map Kiwi adds before loading
// ES module plugins (see src/libs/EsmPlugins.js), so this uses Kiwi's own Vue runtime. A plugin
// built with a bundler marks both as external.
import { h, ref } from 'vue';
import kiwiApi from 'kiwiirc';

export default function esmDemoPlugin(kiwi, log) {
    log('ESM demo plugin loaded. Same API object as window.kiwi:', kiwi === kiwiApi);

    kiwi.addUi('browser', {
        name: 'EsmDemoCounter',
        setup() {
            // With a second copy of Vue this ref would not be tracked by Kiwi's renderer and
            // the button text would never change
            const count = ref(0);
            return () => h('button', {
                class: 'u-button esm-demo-counter',
                type: 'button',
                onClick: () => {
                    count.value += 1;
                },
            }, `ESM plugin: ${count.value}`);
        },
    });
}
