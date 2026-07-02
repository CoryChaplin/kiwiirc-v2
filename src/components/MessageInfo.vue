<template>
    <div class="kiwi-messageinfo" @click.stop>
        <div class="kiwi-messageinfo-actions">
            <a
                v-if="message.nick && buffer.name !== message.nick && !isSelf()"
                class="u-link kiwi-messageinfo-button kiwi-messageinfo-reply"
                :title="$t('reply_in_private')"
                :aria-label="$t('reply_in_private')"
                @click="openQuery"
            >{{ $t('reply_in_private') }}</a>

            <component
                :is="plugin.component"
                v-for="plugin in pluginUiSections"
                :key="plugin.id"
                :plugin-props="{
                    buffer,
                    message,
                }"
                v-bind="plugin.props"
                :buffer="buffer"
                :message="message"
                class="u-link kiwi-messageinfo-button kiwi-messageinfo-plugin"
            />

            <!-- Op moderation (Kickban, with reason) is provided by the ASL plugin via
                 the message_info seam (anchored popover), replacing the native Ban+Kick. -->
        </div>
    </div>
</template>

<script>
'kiwi public';

import GlobalApi from '@/libs/GlobalApi';

export default {
    props: ['buffer', 'message'],
    data() {
        return {
            pluginUiSections: GlobalApi.singleton().messageInfoPlugins,
        };
    },
    methods: {
        isSelf() {
            let user = this.$state.getUser(this.buffer.getNetwork().id, this.message.nick);
            return user && this.buffer.getNetwork().ircClient.user.nick === user.nick;
        },
        openQuery() {
            let network = this.buffer.getNetwork();
            let buffer = this.$state.addBuffer(network.id, this.message.nick);
            this.$state.setActiveBuffer(network.id, buffer.name);
        },
    },
};
</script>

<style>
.kiwi-messageinfo {
    display: block;
    position: relative;
    padding: 0;
    margin-bottom: 10px;
}

.kiwi-messageinfo-actions {
    margin-top: 10px;
    overflow: hidden;
    width: 100%;
    text-align: center;
}

.kiwi-messageinfo-actions .u-link {
    display: inline-block;
    border-radius: 4px;
    margin: 0 4px 4px 0;
    padding: 5px 10px;
}
</style>
