import { transformSync } from '@babel/core';
import * as EmojiProvider from '@/libs/EmojiProvider';
import parseMessage from '@/libs/MessageParser';

const pluginPath = require.resolve('../../build/plugins/babel/kiwi-replaceable-exports.js');

function transform(code) {
    return transformSync(code, {
        filename: 'fixture.js',
        configFile: false,
        babelrc: false,
        plugins: [pluginPath],
    }).code;
}

describe('kiwi-replaceable-exports babel plugin', () => {
    const publicModule = [
        "'kiwi public';",
        "import { imported } from './elsewhere';",
        'export const A = 1;',
        'export function f() {}',
        'export class C {}',
        'const B = 2;',
        'export { B, B as Bee, imported };',
        'export default {};',
    ].join('\n');

    it('adds a setter for each of the module\'s own named exports', () => {
        const out = transform(publicModule);
        expect(out).toContain('export function __kiwiReplace(name, value)');
        ['A', 'f', 'C', 'B', 'Bee'].forEach((name) => {
            expect(out).toContain(`case "${name}":`);
        });
    });

    it('turns exported const declarations into let so they can be reassigned', () => {
        const out = transform(publicModule);
        expect(out).toContain('export let A = 1;');
        expect(out).toContain('let B = 2;');
    });

    it('skips re-exported imports and the default export', () => {
        const out = transform(publicModule);
        expect(out).not.toContain('case "imported":');
        expect(out).not.toContain('case "default":');
    });

    it('leaves modules without the directive alone', () => {
        expect(transform('export function g() {}')).not.toContain('__kiwiReplace');
    });
});

describe('replacing a named export of a kiwi public module', () => {
    const original = EmojiProvider.getEmojis;
    const fakeEmoji = { ascii: ':zz:', code: 'zz', url: 'zz.png', ircValue: ':zz:' };

    beforeEach(() => {
        // eslint-disable-next-line no-underscore-dangle
        EmojiProvider.__kiwiReplace('getEmojis', (word) => (word === ':zz:' ? [fakeEmoji] : []));
    });

    afterEach(() => {
        // eslint-disable-next-line no-underscore-dangle
        EmojiProvider.__kiwiReplace('getEmojis', original);
    });

    it('is seen through the module namespace', () => {
        expect(EmojiProvider.getEmojis(':zz:')).toEqual([fakeEmoji]);
    });

    it('is used by the module\'s own functions', () => {
        // matchEmoji() calls getEmojis() internally
        expect(EmojiProvider.matchEmoji(':zz:')[0].meta.emoji).toBe(fakeEmoji);
    });

    it('is used by other modules importing it', () => {
        // MessageParser calls EmojiProvider.matchEmoji(), which calls the replaced getEmojis()
        const blocks = parseMessage('hello :zz:');
        const emojiBlock = blocks.find((block) => block.type === 'emoji');
        expect(emojiBlock && emojiBlock.meta.emoji).toBe(fakeEmoji);
    });

    it('reports unknown export names', () => {
        // eslint-disable-next-line no-underscore-dangle
        expect(EmojiProvider.__kiwiReplace('doesNotExist', () => {})).toBe(false);
    });
});
