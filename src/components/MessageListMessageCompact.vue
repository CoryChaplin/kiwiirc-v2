<template functional>
    <div
        :class="[
            props.m().isRepeat()
                ? 'kiwi-messagelist-message--authorrepeat'
                : 'kiwi-messagelist-message--authorfirst',
            `kiwi-messagelist-message-${props.message.type}`,
            props.message.type_extra
                ? `kiwi-messagelist-message-${props.message.type}-${props.message.type_extra}`
                : '',
            props.ml.isMessageHighlight(props.message)
                ? 'kiwi-messagelist-message--highlight'
                : '',
            props.ml.isHoveringOverMessage(props.message)
                ? 'kiwi-messagelist-message--hover'
                : '',
            props.ml.buffer.last_read && props.message.time > props.ml.buffer.last_read
                ? 'kiwi-messagelist-message--unread'
                : '',
            props.message.nick.toLowerCase() === props.ml.ourNick.toLowerCase()
                ? 'kiwi-messagelist-message--own'
                : '',
            props.ml.message_info_open === props.message
                ? 'kiwi-messagelist-message--info-open'
                : '',
            props.ml.message_info_open && props.ml.message_info_open !== props.message
                ? 'kiwi-messagelist-message--blur'
                : '',
            props.message.pending ? 'kiwi-messagelist-message--pending' : '',
            props.message.send_failed ? 'kiwi-messagelist-message--send-failed' : '',
            (props.message.user && props.m().userMode(props.message.user))
                ? `kiwi-messagelist-message--user-mode-${props.m().userMode(props.message.user)}`
                : '',
            data.staticClass,
        ]"
        :data-message-id="props.message.id"
        :data-nick="(props.message.nick || '').toLowerCase()"
        class="kiwi-messagelist-message kiwi-messagelist-message--compact"
        @click="props.ml.onMessageClick($event, props.message, true)"
        @dblclick="props.ml.onMessageDblClick($event, props.message)"
    >
        <div
            v-if="props.ml.bufferSetting('show_timestamps')"
            :title="props.ml.formatTimeFull(props.message.time)"
            class="kiwi-messagelist-time"
        >
            {{ props.ml.formatTime(props.message.time) }}
        </div>
        <span
            v-if="props.message.show_pending && !props.message.send_failed"
            class="kiwi-messagelist-sendcheck kiwi-messagelist-sendcheck--pending"
            role="img"
            :aria-label="props.ml.$t('message_sending')"
            :title="props.ml.$t('message_sending')"
        ><i class="fa fa-clock-o" /></span>
        <span
            v-else-if="props.message.just_confirmed && !props.message.send_failed"
            class="kiwi-messagelist-sendcheck kiwi-messagelist-sendcheck--sent"
            role="img"
            :aria-label="props.ml.$t('message_delivered')"
            :title="props.ml.$t('message_delivered')"
        ><i class="fa fa-check" /></span>
        <a
            :style="{ color: props.ml.userColour(props.message.user) }"
            :class="[
                'kiwi-messagelist-nick',
                (props.message.user && props.m().userMode(props.message.user))
                    ? `kiwi-messagelist-nick--mode-${props.m().userMode(props.message.user)}`
                    : '',
            ]"
            :data-nick="(props.message.nick || '').toLowerCase()"
            @mouseover="props.ml.hover_nick = props.message.nick.toLowerCase();"
            @mouseout="props.ml.hover_nick = '';"
        >
            <component
                :is="injections.components.AwayStatusIndicator"
                v-if="props.message.user"
                :network="props.m().getNetwork()" :user="props.message.user"
                :toggle="false"
            />
            <span class="kiwi-messagelist-nick--prefix">
                {{ props.message.user ? props.m().userModePrefix(props.message.user) : '' }}
            </span>
            {{ props.message.nick }}
        </a>
        <div
            v-if="props.message.bodyTemplate
                && props.message.bodyTemplate.$el
                && props.ml.isTemplateVue(props.message.bodyTemplate)"
            v-rawElement="props.message.bodyTemplate.$el"
            class="kiwi-messagelist-body"
        />
        <component
            :is="props.message.bodyTemplate"
            v-else-if="props.message.bodyTemplate"
            v-bind="props.message.bodyTemplateProps"
            :buffer="props.ml.buffer"
            :message="props.message"
            :idx="props.idx"
            :ml="props.ml"
            class="kiwi-messagelist-body"
        />
        <div v-else class="kiwi-messagelist-body" v-html="props.ml.formatMessage(props.message)" />

        <div
            v-if="props.message.send_failed"
            class="kiwi-messagelist-sendstatus"
        >
            <i class="fa fa-exclamation-triangle" aria-hidden="true" />
            {{ props.ml.$t('message_not_sent') }}
            <a class="u-link" @click.stop="props.m().resendMessage(props.message)">
                {{ props.ml.$t('message_resend') }}
            </a>
        </div>

        <component
            :is="injections.components.MessageInfo"
            v-if="props.ml.message_info_open === props.message"
            :message="props.message"
            :buffer="props.ml.buffer"
            @close="props.ml.toggleMessageInfo()"
        />

        <div v-if="props.message.embed.payload && props.ml.shouldAutoEmbed">
            <component
                :is="injections.components.MediaViewer"
                :url="props.message.embed.payload"
                :show-pin="true"
                @close="props.message.embed.payload = ''"
                @pin="props.ml.openEmbedInPreview(props.message)"
            />
        </div>
    </div>
</template>

<script>
'kiwi public';

// eslint-plugin-vue's max-len rule reads the entire file, including the CSS. so we can't use this
// here as some of the rules cannot be broken up any smaller
/* eslint-disable max-len */

import MediaViewer from './MediaViewer';
import AwayStatusIndicator from './AwayStatusIndicator';
import MessageInfo from './MessageInfo';

const methods = {
    props: {},
    getNetwork() {
        let props = this.props;
        return props.ml.buffer.getNetwork();
    },
    isRepeat() {
        let props = this.props;
        let ml = props.ml;
        let idx = props.idx;
        let message = props.message;
        let prevMessage = ml.filteredMessages[idx - 1];

        return !!prevMessage &&
            prevMessage.nick === message.nick &&
            message.time - prevMessage.time < 60000 &&
            prevMessage.type !== 'traffic' &&
            message.type !== 'traffic' &&
            message.type === prevMessage.type;
    },
    isHoveringOverMessage(message) {
        let props = this.props;
        return message.nick && message.nick.toLowerCase() === props.hover_nick.toLowerCase();
    },
    userMode(user) {
        let props = this.props;
        return props.ml.buffer.userMode(user);
    },
    userModePrefix(user) {
        let props = this.props;
        return props.ml.buffer.userModePrefix(user);
    },
    resendMessage(message) {
        let props = this.props;
        props.ml.buffer.getNetwork().pendingMessages.resend(message);
    },
};

export default {
    inject: {
        components: {
            default: {
                AwayStatusIndicator,
                MessageInfo,
                MediaViewer,
            },
        },
    },
    props: {
        ml: Object,
        message: Object,
        idx: Number,
        m: {
            default: function m() {
                // vue uses this function to generate the prop. `this`==null Return our own function
                return function n() {
                    // Give our methods some props context before its function is called.
                    // This is only safe because the function on the methods object is called on
                    // the same js tick
                    methods.props = this;
                    return methods;
                };
            },
        },
    },
};
</script>

<style lang="less" scoped>

.kiwi-messagelist-message--compact {
    position: relative;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-message-privmsg:hover,
.kiwi-messagelist-message--compact .kiwi-messagelist-message-action:hover,
.kiwi-messagelist-message--compact .kiwi-messagelist-message-notice:hover {
    cursor: pointer;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-message--blur {
    opacity: 0.5;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-nick {
    width: 110px;
    min-width: 110px;
    display: inline-block;
    left: 8px;
    top: -1px;
    position: absolute;
    white-space: nowrap;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-nick:hover {
    width: auto;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-time {
    display: inline-block;
    float: right;
    font-size: 12px;
    opacity: 0.8;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-body {
    display: block;
    white-space: pre-wrap;
    word-wrap: break-word;
    margin-left: 120px;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-body a {
    word-break: break-all;
}

.kiwi-messagelist-message--compact .kiwi-messageinfo {
    padding-left: 130px;
}

/* The timestamp floats top-right; the marker floats right beside it (it sits just after the
   timestamp in the DOM, so it lands to its left) and self-sizes to the real clock width -
   no fixed number, robust to font/format/zoom. Out of the text flow: only the first line
   reflows by the glyph width when it appears on a slow send, never between clock and check. */
.kiwi-messagelist-sendcheck {
    float: right;
    margin: 0 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* one text line tall, so the glyph centres on the line instead of hugging its top */
    min-height: 1.6em;
    line-height: 1;
    color: var(--color-text-muted, #606b79); /* fallback when theme token absent */
}

.kiwi-messagelist-sendcheck .fa {
    font-size: 0.82em;
}

/* Fugace confirmation: one-shot fade over the confirm window, then unmounted.
   Animation not transition: functional templates can't toggle opacity across frames. */
.kiwi-messagelist-sendcheck--sent {
    animation: kiwi-sendcheck-ack 3s ease;
}

@keyframes kiwi-sendcheck-ack {
    0% { opacity: 0; }
    5% { opacity: 1; }
    92% { opacity: 1; }
    100% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
    .kiwi-messagelist-sendcheck--sent {
        display: none;
    }
}

.kiwi-messagelist-message--compact .kiwi-messagelist-sendstatus {
    display: flex;
    align-items: center;
    gap: 0.4em;
    margin-left: 120px;
    font-size: 0.85em;
    color: var(--color-danger, #cf3d3d); /* fallback when theme token absent */
}

.kiwi-messagelist-message--compact .kiwi-messagelist-sendstatus .u-link {
    cursor: pointer;
    font-weight: 600;
    color: var(--color-danger, #cf3d3d);
    text-decoration: underline;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-sendstatus .u-link:hover {
    text-decoration: none;
}

//Channel traffic messages
.kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic {
    margin: 0;
    padding: 1px 0;
}

.kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic .kiwi-messagelist-body {
    margin-left: 131px;
}

//Channel topic
.kiwi-messagelist-message--compact.kiwi-messagelist-message-topic {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    margin: 1em 0;
}

.kiwi-messagelist-message--compact.kiwi-messagelist-message-topic .kiwi-messagelist-body {
    padding-right: 0;
    max-width: 95%;
    margin-left: 20px;
}

//Repeat messages, remove the time and author name
.kiwi-messagelist-message--compact.kiwi-messagelist-message--authorrepeat {
    .kiwi-messagelist-time,
    .kiwi-messagelist-nick {
        display: none;
    }
}

// Traffic messages have an opacity lower than 1, so we do a blanket statment to make sure all
// messages are opacity: 1, rather than just specifying one.
.kiwi-messagelist-message--compact.kiwi-messagelist-message--unread {
    opacity: 1;
}

// Mobile layout (matches this.$state.ui.is_narrow)
@media screen and (max-width: 769px) {
    .kiwi-messagelist-message--compact {
        padding: 5px;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-nick {
        display: inline;
        width: auto;
        min-width: auto;
        float: left;
        position: static;
        padding-left: 0;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-time {
        text-align: right;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-body {
        float: left;
        width: 100%;
        margin-left: 0;
        box-sizing: border-box;
    }

    /* Nick and time take their own line here and the body drops below, so the marker belongs
       on the message line, not up with the clock. Park it bottom-right of the row - nothing
       else sits there - and reserve room so a full last line never runs under it. */
    .kiwi-messagelist-message--compact .kiwi-messagelist-sendcheck {
        float: none;
        position: absolute;
        right: 5px;
        bottom: 5px;
        min-height: 0;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message--own .kiwi-messagelist-body {
        padding-right: 1.4em;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message--unread .kiwi-messagelist-body {
        padding-left: 10px;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-message--authorrepeat .kiwi-messagelist-nick {
        display: none;
    }

    .kiwi-messagelist-message--compact .kiwi-messageinfo {
        padding-left: 2px;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic .kiwi-messagelist-body {
        margin-left: 0;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic {
        margin-left: 10px;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic.kiwi-messagelist-message--unread {
        margin-left: 0;
        padding-left: 10px;
    }
}

.kiwi-messagelist-message--compact .kiwi-messagelist-message-traffic .kiwi-messagelist-nick {
    display: none;
}

.kiwi-messagelist-item:last-of-type {
    margin-bottom: 5px;
}

// Moderate screen size
// Give more space to the nickname column on larger screens
@media screen and (min-width: 1000px) {
    // Nicknames
    .kiwi-messagelist-message--compact .kiwi-messagelist-nick {
        width: 160px;
        min-width: 160px;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-nick:hover {
        width: auto;
    }

    // Messages
    .kiwi-messagelist-message--compact .kiwi-messagelist-body {
        margin-left: 170px;
    }

    .kiwi-messagelist-message--compact .kiwi-messageinfo {
        padding-left: 180px;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic .kiwi-messagelist-body {
        margin-left: 181px;
    }
}

</style>
