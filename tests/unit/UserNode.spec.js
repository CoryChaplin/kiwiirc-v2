import { createEditor } from 'lexical';
import { UserNode, $createUserNode, getAwayStatus } from '@/libs/lexical/UserNode';
import UserState from '@/libs/state/UserState';

const mockUser = { nick: 'Alice', getColour: () => '#ff4444' };
const mockNetwork = {
    id: 'net1',
    state: 'connected',
    ircClient: { network: { cap: { isEnabled: (cap) => cap === 'away-notify' } } },
    userByName: (nick) => (nick.toLowerCase() === 'alice' ? mockUser : undefined),
};

const mockSettings = {
    'input.showAwayStatus': true,
    'showAwayStatusIndicators': true,
    'buffers.who_loop': false,
};

jest.mock('@/libs/state', () => () => ({
    getNetwork: (id) => (id === 'net1' ? mockNetwork : undefined),
    setting: (name) => mockSettings[name],
}));

// A real UserState instance without going through the state store
function makeUserState(nick, away = '') {
    return Object.assign(Object.create(UserState.prototype), { nick, away, getColour: () => '#ff4444' });
}

const domConfig = { namespace: 'test', theme: {} };

// Lexical node methods only work inside an editor update, so run each test body in one
function inEditor(fn) {
    const editor = createEditor({ nodes: [UserNode], onError: (err) => { throw err; } });
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

describe('UserNode', () => {
    describe('getUser() / getNetwork()', () => {
        it('returns the stored user and network objects', () => {
            const [user, network] = inEditor(() => {
                const node = $createUserNode(mockNetwork, mockUser);
                return [node.getUser(), node.getNetwork()];
            });
            expect(user).toBe(mockUser);
            expect(network).toBe(mockNetwork);
        });

        it('uses the nick as its text', () => {
            expect(inEditor(() => $createUserNode(mockNetwork, mockUser).getTextContent())).toBe('Alice');
        });
    });

    describe('exportJSON()', () => {
        it('includes type, network.id and user.nick', () => {
            const json = inEditor(() => $createUserNode(mockNetwork, mockUser).exportJSON());
            expect(json.type).toBe('user');
            expect(json.network).toEqual({ id: 'net1' });
            expect(json.user).toEqual({ nick: 'Alice' });
        });

        it('does NOT include colour in exported JSON', () => {
            const json = JSON.stringify(inEditor(() => $createUserNode(mockNetwork, mockUser).exportJSON()));
            expect(json).not.toContain('#ff4444');
            expect(json).not.toContain('color');
        });
    });

    describe('static clone()', () => {
        it('preserves network, user and key', () => {
            const [original, cloned] = inEditor(() => {
                const node = $createUserNode(mockNetwork, mockUser);
                return [node, UserNode.clone(node)];
            });
            expect(cloned.getNetwork()).toBe(mockNetwork);
            expect(cloned.getUser()).toBe(mockUser);
            expect(cloned.getKey()).toBe(original.getKey());
        });
    });

    describe('node mode', () => {
        it('is not in token mode', () => {
            // $createUserNode must NOT call setMode('token')
            expect(inEditor(() => $createUserNode(mockNetwork, mockUser).getMode())).toBe('normal');
        });
    });

    describe('static importJSON()', () => {
        // Drafts and input history are restored from JSON, so this must not throw
        it('resolves the user through the network', () => {
            const user = inEditor(() => {
                const json = $createUserNode(mockNetwork, mockUser).exportJSON();
                return UserNode.importJSON(json).getUser();
            });
            expect(user).toBe(mockUser);
        });

        it('falls back to a plain nick when the user is not known', () => {
            const user = inEditor(() => UserNode.importJSON({
                ...$createUserNode(mockNetwork, mockUser).exportJSON(),
                user: { nick: 'Bob' },
            }).getUser());
            expect(user).toEqual({ nick: 'Bob' });
        });

        it('falls back to a plain nick when the network is gone', () => {
            const user = inEditor(() => UserNode.importJSON({
                ...$createUserNode(mockNetwork, mockUser).exportJSON(),
                network: { id: 'gone' },
            }).getUser());
            expect(user).toEqual({ nick: 'Alice' });
        });
    });

    describe('DOM', () => {
        // Lexical's TextNode.updateDOM() writes the text into dom.firstChild, so nothing may be
        // inserted before it (this used to crash in Firefox when the away indicator was prepended)
        it('keeps the text node as the only child and updates it', () => {
            const dom = inEditor(() => {
                const node = $createUserNode(mockNetwork, makeUserState('Alice'));
                const element = node.createDOM(domConfig);
                node.setTextContent('Alicia');
                node.updateDOM(node, element, domConfig);
                return element;
            });
            expect(dom.childNodes).toHaveLength(1);
            expect(dom.firstChild.nodeType).toBe(3);
            expect(dom.textContent).toBe('Alicia');
        });

        it('exposes the away status as a data attribute', () => {
            const status = (away) => inEditor(
                () => $createUserNode(mockNetwork, makeUserState('Alice', away)).createDOM(domConfig).dataset.awayStatus
            );
            expect(status('')).toBe('online');
            expect(status('Gone fishing')).toBe('away');
            expect(status('offline')).toBe('offline');
        });

        it('shows no status when the setting is off or the network is disconnected', () => {
            const user = makeUserState('Alice');
            mockSettings['input.showAwayStatus'] = false;
            expect(getAwayStatus(mockNetwork, user)).toBe('');
            mockSettings['input.showAwayStatus'] = true;
            expect(getAwayStatus({ ...mockNetwork, state: 'disconnected' }, user)).toBe('');
            expect(getAwayStatus(mockNetwork, user)).toBe('online');
        });
    });
});
