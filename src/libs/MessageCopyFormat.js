'kiwi public';

/**
 * Render a message as a single plain text log line for the clipboard.
 * Returns null for messages that carry no text of their own.
 */
export function formatMessageForCopy(msg) {
    if (!(msg.message || '').trim().length) {
        return null;
    }

    let text = '';
    switch (msg.type) {
    case 'privmsg':
        text = `<${msg.nick}> ${msg.message}`;
        break;
    default:
        text = msg.message;
    }

    // toLocaleTimeString takes the locales as its first argument, the options as its second.
    // Passing the options first silently drops them
    let time = (new Date(msg.time)).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    return `[${time}] ${text}`;
}

/**
 * Turn a set of messages into the plain text log put on the clipboard.
 * The given array is left untouched.
 */
export function buildCopyText(messages) {
    return messages
        .slice()
        .sort((a, b) => a.time - b.time)
        .map(formatMessageForCopy)
        .filter((line) => !!line)
        .join('\r\n');
}
