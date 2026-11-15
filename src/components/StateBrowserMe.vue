<template>
    <div class="kiwi-statebrowser-me">
        <div
            v-if="menuOpen"
            ref="menu"
            class="kiwi-statebrowser-me-menu"
            role="menu"
            :aria-label="$t('statebrowser_me')"
            @keydown="onMenuKeydown"
        >
            <div class="kiwi-statebrowser-me-menu-title">{{ $t('statebrowser_me_presence') }}</div>
            <button
                type="button"
                class="kiwi-statebrowser-me-item"
                role="menuitemradio"
                :aria-checked="isAway ? 'false' : 'true'"
                @click="setAway(false)"
            >
                <span class="kiwi-statebrowser-me-dot kiwi-statebrowser-me-dot--online" />
                {{ $t('status_online') }}
                <i class="fa fa-check kiwi-statebrowser-me-check" aria-hidden="true" />
            </button>
            <button
                type="button"
                class="kiwi-statebrowser-me-item"
                role="menuitemradio"
                :aria-checked="isAway ? 'true' : 'false'"
                @click="setAway(true)"
            >
                <span class="kiwi-statebrowser-me-dot kiwi-statebrowser-me-dot--away" />
                {{ $t('away') }}
                <i class="fa fa-check kiwi-statebrowser-me-check" aria-hidden="true" />
            </button>

            <template v-if="pluginUiElements.length">
                <div class="kiwi-statebrowser-me-sep" role="separator" />
                <component
                    :is="plugin.component"
                    v-for="plugin in pluginUiElements"
                    :key="plugin.id"
                    :plugin-props="{
                        network,
                        user,
                        closeMenu,
                    }"
                    v-bind="plugin.props"
                    :network="network"
                    :user="user"
                    class="kiwi-statebrowser-me-plugin"
                />
            </template>

            <template v-if="isPersistingState">
                <div class="kiwi-statebrowser-me-sep" role="separator" />
                <button
                    type="button"
                    class="kiwi-statebrowser-me-item"
                    role="menuitem"
                    @click="clickForget"
                >
                    <i class="fa fa-eraser kiwi-statebrowser-me-icon" aria-hidden="true" />
                    {{ $t('state_forget') }}
                </button>
            </template>
        </div>

        <button
            ref="identity"
            type="button"
            class="kiwi-statebrowser-me-id"
            aria-haspopup="menu"
            :aria-expanded="menuOpen ? 'true' : 'false'"
            :aria-disabled="isConnected ? null : 'true'"
            :aria-label="`${nick}, ${statusLabel}`"
            :title="$t('statebrowser_me_presence')"
            @click.stop="toggleMenu"
        >
            <user-avatar
                v-if="user"
                :user="user"
                :network="network"
                :allow-toggle="false"
                size="small"
                class="kiwi-statebrowser-me-avatar"
            />
            <span class="kiwi-statebrowser-me-info">
                <span class="kiwi-statebrowser-me-nick">{{ nick }}</span>
                <span class="kiwi-statebrowser-me-status">
                    <span class="kiwi-statebrowser-me-dot" :class="dotClass" />
                    {{ statusLabel }}
                    <i class="fa fa-caret-up kiwi-statebrowser-me-caret" aria-hidden="true" />
                </span>
            </span>
        </button>

        <button
            v-if="!$state.setting('hideSettings')"
            type="button"
            class="kiwi-statebrowser-me-settings"
            :title="$t('kiwi_settings')"
            :aria-label="$t('kiwi_settings')"
            @click="clickAppSettings"
        >
            <i class="fa fa-cog" aria-hidden="true" />
        </button>
    </div>
</template>

<script>
'kiwi public';

import GlobalApi from '@/libs/GlobalApi';
import UserAvatar from './UserAvatar';
import AppSettings from './AppSettings';

export default {
    components: {
        UserAvatar,
    },
    props: ['network'],
    data() {
        return {
            menuOpen: false,
            pluginUiElements: GlobalApi.singleton().stateBrowserMePlugins,
        };
    },
    computed: {
        user() {
            if (this.network && this.network.state && this.network.currentUser()) {
                return this.network.currentUser();
            }
            return null;
        },
        nick() {
            return this.network ? this.network.nick : '';
        },
        isConnected() {
            return !!this.network && this.network.state === 'connected';
        },
        isAway() {
            return !!this.user && this.user.isAway();
        },
        isPersistingState() {
            return !!this.$state.persistence;
        },
        statusLabel() {
            if (!this.isConnected) {
                return this.$t('status_reconnecting');
            }
            return this.isAway ? this.$t('away') : this.$t('status_online');
        },
        dotClass() {
            if (!this.isConnected) {
                return 'kiwi-statebrowser-me-dot--offline';
            }
            return this.isAway ? 'kiwi-statebrowser-me-dot--away' : 'kiwi-statebrowser-me-dot--online';
        },
    },
    watch: {
        isConnected(connected) {
            // AWAY can't be sent while disconnected: the menu closes instead of lying.
            if (!connected) {
                this.menuOpen = false;
            }
        },
    },
    created() {
        this.listen(this.$state, 'document.clicked', (e) => {
            if (this.menuOpen && !this.$el.contains(e.target)) {
                this.menuOpen = false;
            }
        });
    },
    methods: {
        toggleMenu() {
            if (!this.isConnected) {
                return;
            }
            this.menuOpen = !this.menuOpen;
            if (this.menuOpen) {
                this.$nextTick(() => {
                    let checked = this.$refs.menu.querySelector('[aria-checked="true"]');
                    if (checked) {
                        checked.focus();
                    }
                });
            }
        },
        closeMenu() {
            this.menuOpen = false;
            this.$nextTick(() => {
                if (this.$refs.identity) {
                    this.$refs.identity.focus();
                }
            });
        },
        menuItems() {
            return Array.from(this.$refs.menu.querySelectorAll('[role^="menuitem"]'));
        },
        onMenuKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeMenu();
                return;
            }
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
                return;
            }
            e.preventDefault();
            let items = this.menuItems();
            let idx = items.indexOf(document.activeElement);
            let step = e.key === 'ArrowDown' ? 1 : -1;
            let next = items[(idx + step + items.length) % items.length];
            if (next) {
                next.focus();
            }
        },
        setAway(away) {
            if (this.isConnected && this.isAway !== away) {
                this.network.ircClient.raw('AWAY', away ? 'Currently away' : '');
            }
            this.closeMenu();
        },
        clickAppSettings() {
            this.$state.$emit('active.component.toggle', AppSettings);
        },
        clickForget() {
            /* eslint-disable no-restricted-globals, no-alert */
            if (!confirm(this.$t('state_forget_confirm'))) {
                return;
            }
            this.$state.persistence.forgetState();
            window.location.reload();
        },
    },
};
</script>

<style lang="less">
/* Base layout only: usable under any theme. Themes paint it. */
.kiwi-statebrowser-me {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px 4px 4px;
    border-top: 1px solid rgba(128, 128, 128, 0.3);
    text-align: left;
}

.kiwi-statebrowser-me-id {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 6px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.kiwi-statebrowser-me-id[aria-disabled="true"] {
    cursor: default;
}

.kiwi-statebrowser-me-avatar {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
}

/* The status line already carries presence, with its label: one cue, not two. UserAvatar
   also notches the disc (an SVG mask) where its dot sits; CSS outranks the presentation
   attribute, so the notch goes with the dot. */
.kiwi-statebrowser-me-avatar .kiwi-avatar-status {
    display: none;
}

.kiwi-statebrowser-me-avatar > g {
    mask: none;
}

.kiwi-statebrowser-me-info {
    flex: 1;
    min-width: 0;
    line-height: 1.2;
}

.kiwi-statebrowser-me-nick {
    display: block;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.kiwi-statebrowser-me-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85em;
    opacity: 0.8;
}

.kiwi-statebrowser-me-id[aria-disabled="true"] .kiwi-statebrowser-me-caret {
    display: none;
}

.kiwi-statebrowser-me-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.kiwi-statebrowser-me-dot--online {
    background: #2dc35c;
}

.kiwi-statebrowser-me-dot--away {
    background: #f0a500;
}

.kiwi-statebrowser-me-dot--offline {
    box-shadow: inset 0 0 0 1.5px currentColor;
}

.kiwi-statebrowser-me-settings {
    position: relative;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    color: inherit;
    font-size: 1.1em;
    cursor: pointer;
}

/* 44px touch target, out of flow. */
.kiwi-statebrowser-me-settings::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
}

.kiwi-statebrowser-me-menu {
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: calc(100% + 6px);
    z-index: 20;
    padding: 6px;
    border: 1px solid rgba(128, 128, 128, 0.3);
    border-radius: 10px;
    background: var(--brand-default-bg, #fff);
    color: var(--brand-default-fg, #222);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.kiwi-statebrowser-me-menu-title {
    padding: 6px 10px 4px;
    font-size: 0.75em;
    font-weight: 800;
    text-transform: uppercase;
    opacity: 0.7;
}

.kiwi-statebrowser-me-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 6px 10px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
}

.kiwi-statebrowser-me-item .kiwi-statebrowser-me-dot {
    margin: 0 4px;
}

.kiwi-statebrowser-me-icon {
    width: 16px;
    text-align: center;
}

.kiwi-statebrowser-me-check {
    margin-left: auto;
    visibility: hidden;
}

.kiwi-statebrowser-me-item[aria-checked="true"] .kiwi-statebrowser-me-check {
    visibility: visible;
}

.kiwi-statebrowser-me-sep {
    height: 1px;
    margin: 4px;
    background: rgba(128, 128, 128, 0.3);
}
</style>
