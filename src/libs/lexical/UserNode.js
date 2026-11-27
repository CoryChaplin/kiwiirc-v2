import { TextNode } from 'lexical';
import getState from '@/libs/state';
import UserState from '@/libs/state/UserState';

/**
 * Away status to show next to a nick in the input, mirroring AwayStatusIndicator
 *
 * @returns {string} 'online', 'away', 'offline', or '' when no status should be shown
 */
export function getAwayStatus(network, user) {
    const state = getState();
    if (!state.setting('input.showAwayStatus') || !state.setting('showAwayStatusIndicators')) {
        return '';
    }
    if (!network || network.state !== 'connected') {
        return '';
    }
    const awayNotify = network.ircClient.network.cap.isEnabled('away-notify');
    if (!awayNotify && !state.setting('buffers.who_loop')) {
        return '';
    }
    if (user.isOffline()) {
        return 'offline';
    }
    return user.isAway() ? 'away' : 'online';
}

export class UserNode extends TextNode {
    static getType() {
        return 'user';
    }

    static clone(node) {
        return new UserNode(node.network, node.user, node.getKey());
    }

    constructor(network, user, key) {
        super(user.nick, key);
        this.network = network;
        this.user = user;
    }

    getNetwork() {
        return this.network;
    }

    getUser() {
        return this.user;
    }

    createDOM(config) {
        const element = super.createDOM(config);
        element.className = 'user-node';
        element.spellcheck = false;
        this.applyUserStyle(element);
        return element;
    }

    updateDOM(prevNode, dom, config) {
        const needsRecreate = super.updateDOM(prevNode, dom, config);
        if (needsRecreate) {
            return true;
        }
        this.applyUserStyle(dom);
        return false;
    }

    // Lexical expects the text to be the only child of a TextNode's DOM, so the away status
    // is a data attribute drawn by CSS (::before) rather than an extra element
    applyUserStyle(dom) {
        const { user } = this;
        if (!(user instanceof UserState)) {
            return;
        }
        dom.style.color = user.getColour();

        const status = getAwayStatus(this.network, user);
        if (status) {
            dom.dataset.awayStatus = status;
        } else {
            delete dom.dataset.awayStatus;
        }
    }

    static importJSON(serialisedNode) {
        const state = getState();
        const network = state.getNetwork(serialisedNode.network?.id);
        const nick = serialisedNode.user?.nick;
        const user = (network && nick)
            ? (network.userByName(nick) ?? { nick })
            : { nick: nick ?? '' };
        return $createUserNode(network, user);
    }

    exportJSON() {
        return {
            ...super.exportJSON(),
            type: 'user',
            network: { id: this.network?.id },
            user: { nick: this.user?.nick },
        };
    }
}

export function $createUserNode(network, user) {
    return new UserNode(network, user);
}
