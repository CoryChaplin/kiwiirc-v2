import { createEditor } from 'lexical';
import { BufferNode, $createBufferNode } from '@/libs/lexical/BufferNode';

// Lexical node methods only work inside an editor update, so run each test body in one
function inEditor(fn) {
    const editor = createEditor({ nodes: [BufferNode], onError: (err) => { throw err; } });
    let result;
    let error;
    editor.update(() => {
        try {
            result = fn();
        } catch (err) {
            error = err;
        }
    }, { discrete: true });
    if (error) {
        throw error;
    }
    return result;
}

describe('BufferNode', () => {
    describe('getChannel()', () => {
        it('returns the stored channel name', () => {
            expect(inEditor(() => $createBufferNode('#kiwiirc').getChannel())).toBe('#kiwiirc');
        });

        it('uses the channel name as its text', () => {
            expect(inEditor(() => $createBufferNode('#kiwiirc').getTextContent())).toBe('#kiwiirc');
        });
    });

    describe('exportJSON()', () => {
        it('includes type "buffer" and the channel name', () => {
            const json = inEditor(() => $createBufferNode('#kiwiirc').exportJSON());
            expect(json.type).toBe('buffer');
            expect(json.channel).toBe('#kiwiirc');
        });
    });

    describe('static clone()', () => {
        it('preserves the channel and the key', () => {
            const [original, cloned] = inEditor(() => {
                const node = $createBufferNode('#kiwiirc');
                return [node, BufferNode.clone(node)];
            });
            expect(cloned.getChannel()).toBe('#kiwiirc');
            expect(cloned.getKey()).toBe(original.getKey());
        });
    });

    describe('static importJSON()', () => {
        it('round-trips through exportJSON()', () => {
            const channel = inEditor(() => {
                const json = $createBufferNode('#kiwiirc').exportJSON();
                return BufferNode.importJSON(json).getChannel();
            });
            expect(channel).toBe('#kiwiirc');
        });
    });
});
