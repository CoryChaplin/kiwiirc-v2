import { formatMessageForCopy, buildCopyText } from '@/libs/MessageCopyFormat';

// 1970-01-01T09:05:03Z, read back in the environments own timezone so the expected
// string is built the same way the formatter builds it
const AT = (new Date('1970-01-01T09:05:03Z')).getTime();
const stamp = (time) => (new Date(time)).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

const msg = (over) => ({ type: 'privmsg', nick: 'alice', message: 'hello', time: AT, ...over });

describe('formatMessageForCopy', () => {
    it('wraps the nick of a privmsg', () => {
        expect(formatMessageForCopy(msg())).toBe(`[${stamp(AT)}] <alice> hello`);
    });

    it('leaves other types as their own text', () => {
        let cases = ['action', 'traffic', 'nick', 'mode', 'topic'];
        cases.forEach((type) => {
            let m = msg({ type, message: '* alice waves' });
            expect(formatMessageForCopy(m)).toBe(`[${stamp(AT)}] * alice waves`);
        });
    });

    it('zero pads the hour rather than dropping the time options', () => {
        // toLocaleTimeString takes locales first, options second. Passing the options as the
        // first argument silently drops them, which left the hour unpadded
        expect(formatMessageForCopy(msg())).toMatch(/^\[\d{2}:\d{2}:\d{2}/);
    });

    it('returns null for messages carrying no text', () => {
        expect(formatMessageForCopy(msg({ message: '' }))).toBeNull();
        expect(formatMessageForCopy(msg({ message: '   ' }))).toBeNull();
        expect(formatMessageForCopy(msg({ message: undefined }))).toBeNull();
    });
});

describe('buildCopyText', () => {
    it('orders messages by time and joins them with CRLF', () => {
        let out = buildCopyText([
            msg({ message: 'second', time: AT + 2000 }),
            msg({ message: 'first', time: AT }),
        ]);
        expect(out).toBe(
            `[${stamp(AT)}] <alice> first\r\n[${stamp(AT + 2000)}] <alice> second`
        );
    });

    it('keeps the given order for messages sharing a timestamp', () => {
        let out = buildCopyText([
            msg({ message: 'one' }),
            msg({ message: 'two' }),
            msg({ message: 'three' }),
        ]);
        expect(out.split('\r\n').map((l) => l.split('> ')[1])).toEqual(['one', 'two', 'three']);
    });

    it('does not reorder the array it was given', () => {
        let messages = [
            msg({ message: 'second', time: AT + 2000 }),
            msg({ message: 'first', time: AT }),
        ];
        buildCopyText(messages);
        expect(messages.map((m) => m.message)).toEqual(['second', 'first']);
    });

    it('drops empty messages instead of leaving blank lines', () => {
        let out = buildCopyText([
            msg({ message: 'kept' }),
            msg({ type: 'traffic', message: '', time: AT + 1000 }),
        ]);
        expect(out).toBe(`[${stamp(AT)}] <alice> kept`);
    });

    it('returns an empty string for no messages', () => {
        expect(buildCopyText([])).toBe('');
    });
});
