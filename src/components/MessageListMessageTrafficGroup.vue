<template>
    <div
        class="kiwi-messagelist-traffic-group"
        :class="`kiwi-messagelist-traffic-group--${ml.listType}`"
    >
        <!-- isolated single event: rendered exactly like a normal traffic message -->
        <component
            :is="messageComponent"
            v-if="summary.total === 1"
            :message="group.events[0]"
            :idx="-1"
            :ml="ml"
        />

        <!-- collapsed: one condensed line — arrivals named, the rest counted.
             Tags below are deliberately jammed with no whitespace between them: the segments
             render inline, so any newline/indent between elements would surface as a stray
             rendered space. Intended spacing is explicit — the ", " nick separator, and CSS
             margins on -sym/-verb/-time. Keep adjacent tags touching when editing. -->
        <div v-else-if="!expanded" class="kiwi-messagelist-traffic-group-summary">
            <button
                class="kiwi-messagelist-traffic-group-toggle"
                type="button"
                :aria-expanded="false"
                :aria-label="$t('traffic_expand')"
                @click="expanded = true"
            ><i class="fa fa-plus" aria-hidden="true" /></button>
            <span v-if="summary.joins.length" class="kiwi-messagelist-traffic-group-seg">
                <span class="kiwi-messagelist-traffic-group-sym">→</span><template
                    v-for="(nk, i) in joinsNicks"
                ><span
                    :key="i"
                    class="kiwi-nick"
                    :style="nickStyles[nk]"
                >{{ nk }}</span><span
                    v-if="i < joinsNicks.length - 1"
                    :key="`jc${i}`"
                >, </span></template><span
                    class="kiwi-messagelist-traffic-group-verb"
                >{{ joinsText }}</span>
            </span>
            <span v-if="summary.departures.length" class="kiwi-messagelist-traffic-group-seg">
                <span class="kiwi-messagelist-traffic-group-sym">←</span><template
                    v-for="(nk, i) in departureNicks"
                ><span
                    :key="i"
                    class="kiwi-nick"
                    :style="nickStyles[nk]"
                >{{ nk }}</span><span
                    v-if="i < departureNicks.length - 1"
                    :key="`dc${i}`"
                >, </span></template><span
                    class="kiwi-messagelist-traffic-group-verb"
                >{{ departuresText }}</span>
            </span>
            <span v-if="summary.nicks.length" class="kiwi-messagelist-traffic-group-seg">
                <span class="kiwi-messagelist-traffic-group-sym">↔</span><template
                    v-if="nickPairs.length"
                ><template
                    v-for="(pr, i) in nickPairs"
                ><span
                    :key="`nf${i}`"
                    class="kiwi-nick"
                    :style="nickStyles[pr.from]"
                >{{ pr.from }}</span><span
                    :key="`na${i}`"
                    class="kiwi-messagelist-traffic-group-nickarrow"
                > → </span><span
                    :key="`nt${i}`"
                    class="kiwi-nick"
                    :style="nickStyles[pr.to]"
                >{{ pr.to }}</span><span
                    v-if="i < nickPairs.length - 1"
                    :key="`nc${i}`"
                >, </span></template></template><span
                    v-else
                    class="kiwi-messagelist-traffic-group-verb"
                >{{ nicksText }}</span>
            </span>
            <span v-if="summary.modes.length" class="kiwi-messagelist-traffic-group-seg">
                <span class="kiwi-messagelist-traffic-group-sym">±</span><span
                    class="kiwi-messagelist-traffic-group-verb"
                >{{ modesText }}</span>
            </span>
            <span
                v-if="ml.bufferSetting('show_timestamps')"
                class="kiwi-messagelist-time"
                :title="ml.formatTimeFull(firstTime)"
            >{{ ml.formatTime(firstTime) }}</span>
        </div>

        <!-- expanded: each event rendered exactly like a normal traffic message -->
        <div v-else class="kiwi-messagelist-traffic-group-detail">
            <button
                class="kiwi-messagelist-traffic-group-toggle"
                type="button"
                :aria-expanded="true"
                :aria-label="$t('traffic_collapse')"
                @click="expanded = false"
            ><i class="fa fa-minus" aria-hidden="true" /></button>
            <component
                :is="messageComponent"
                v-for="(ev, i) in group.events"
                :key="i"
                :message="ev"
                :idx="-1"
                :ml="ml"
            />
        </div>
    </div>
</template>

<script>
'kiwi public';

import MessageListMessageModern from './MessageListMessageModern';
import MessageListMessageCompact from './MessageListMessageCompact';
import MessageListMessageInline from './MessageListMessageInline';
import { summarizeTrafficGroup } from '@/libs/MessageAggregation';

// Renders an aggregated traffic group. Collapsed, it is a concise summary built from the
// data the events carry (arrival nicks + per-type counts) plus a single timestamp (the
// group's first event). An isolated single event, or the expanded view, delegates to the
// normal per-message component so each line is formatted exactly like an ungrouped one.
export default {
    components: {
        MessageListMessageModern,
        MessageListMessageCompact,
        MessageListMessageInline,
    },
    props: ['group', 'buffer', 'ml'],
    data() {
        return {
            expanded: false,
        };
    },
    computed: {
        summary() {
            return summarizeTrafficGroup(this.group);
        },
        firstTime() {
            return this.group.events[0].time;
        },
        messageComponent() {
            switch (this.ml.listType) {
            case 'compact':
                return 'MessageListMessageCompact';
            case 'inline':
                return 'MessageListMessageInline';
            default:
                return 'MessageListMessageModern';
            }
        },
        // "compact" presentation lists every nick inline (IRCCloud-style), including each rename
        // as "old → new"; "résumé" (the default) names the first arrival and counts the rest.
        // mode changes stay counted in both (native messages carry no structured mode target).
        isCompact() {
            return this.buffer.setting('traffic_presentation') === 'compact';
        },
        joinsNicks() {
            if (this.isCompact) {
                return this.summary.joins.map((e) => e.nick);
            }
            return this.summary.joins.length ? [this.summary.joins[0].nick] : [];
        },
        departureNicks() {
            // For a kick the departing user is `kicked`; `nick` is the kicker (see IrcClient).
            // part/quit carry the departing user in `nick`, so fall back to it.
            return this.isCompact
                ? this.summary.departures.map((e) => e.kicked || e.nick)
                : [];
        },
        joinsText() {
            let n = this.summary.joins.length;
            // compact lists every nick (verb agrees with the count); résumé names the
            // first arrival then counts the rest ("…and N others joined").
            if (this.isCompact || n <= 1) {
                return this.plural('traffic_joined', this.isCompact ? n : 1);
            }
            return this.plural('traffic_joined_others', n - 1);
        },
        departuresText() {
            let n = this.summary.departures.length;
            // compact lists the nicks then the bare verb; résumé prefixes the count.
            return this.isCompact
                ? this.plural('traffic_left', n)
                : this.plural('traffic_left_count', n);
        },
        nicksText() {
            return this.plural('traffic_nick_changed', this.summary.nicks.length);
        },
        // compact lists each rename inline ("old → new"); résumé keeps the count. Empty unless we
        // have structured old + new for every event (non-compact, or older messages from before
        // IrcClient stored them) → the template then falls back to nicksText.
        nickPairs() {
            if (!this.isCompact) {
                return [];
            }
            let evs = this.summary.nicks;
            if (!evs.length || evs.some((e) => !e.nick || !e.new_nick)) {
                return [];
            }
            return evs.map((e) => ({ from: e.nick, to: e.new_nick }));
        },
        modesText() {
            return this.plural('traffic_mode_changed', this.summary.modes.length);
        },
        // Maps each listed nick to its inline style, built once per render. Résumé keeps nicks
        // plain (they inherit the muted line colour → empty map); Compact colours each for
        // recognition. Resolving the map here, rather than per-nick in the template, avoids a
        // $state.getUser lookup on every render for every nick when a high-churn group lists
        // many inline. To colour nicks in every mode again, drop the isCompact guard (reversible).
        nickStyles() {
            if (!this.isCompact) {
                return {};
            }
            let styles = {};
            [...this.joinsNicks, ...this.departureNicks].forEach((nick) => {
                let user = this.$state.getUser(this.buffer.networkid, nick);
                styles[nick] = { color: user ? this.ml.userColour(user) : '' };
            });
            // a rename is one identity: colour both old and new names with the renamed-to user's
            // colour (the old nick no longer resolves to a user after changeUserNick)
            this.nickPairs.forEach((pr) => {
                let user = this.$state.getUser(this.buffer.networkid, pr.to);
                let colour = user ? this.ml.userColour(user) : '';
                styles[pr.from] = { color: colour };
                styles[pr.to] = { color: colour };
            });
            return styles;
        },
    },
    methods: {
        // i18next v25 resolves fr/en plurals via the _other suffix, but our keys follow the app's
        // _plural convention; pick the form here (n > 1 = plural for fr/en, the only locales) so it
        // works regardless of i18next's plural rules. count is passed through for interpolation.
        plural(base, count, opts) {
            return this.$t(count > 1 ? `${base}_plural` : base, { count, ...opts });
        },
    },
};
</script>

<style lang="less">
/* The aggregated traffic group lines up on KiwiIRC's message text column, so the summary and
   the expanded rows sit under the conversation's nicks and bodies. Detail / isolated rows are
   native message components (KiwiIRC's own rendering); the summary and meta header are our own
   markup, padded to the same column. Global (not scoped) so themes can shift the column the way
   they already shift message layout — no theme refactor needed; KiwiIRC's rules stay untouched. */

/* Positioning context for the absolute +/− toggle (modern puts it in the avatar gutter; compact
   in the nick column, left of the body gutter). The summary's own box starts at the gutter, so
   compact reaches the nick column with a negative left offset (see the theme). */
.kiwi-messagelist-traffic-group-summary,
.kiwi-messagelist-traffic-group-detail {
    position: relative;
}

/* Toggle (+/−) — a small bordered control. The structure lives here so every theme renders a sane
   toggle instead of a default browser button; colours come from DS tokens when a theme defines them,
   with neutral fallbacks (currentColor / inherit) otherwise. margin-right is the gap when it sits
   inline; z-index keeps it above the expanded rows (position:relative messages follow it in the DOM,
   so without it they paint over the absolutely-placed toggle and the cursor flickers). */
.kiwi-messagelist-traffic-group-toggle {
    display: inline-flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    width: 1.05rem;
    height: 1.05rem;
    margin-right: 0.35rem;
    padding: 0;
    border: 1px solid var(--color-border-strong, currentColor);
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-text-faint, inherit);
    font-size: 0.55rem;
    line-height: 1;
    vertical-align: 0.06rem;
    cursor: pointer;
    z-index: 1;
}
.kiwi-messagelist-traffic-group-toggle:hover {
    color: var(--color-accent, inherit);
    border-color: var(--color-accent-soft, currentColor);
}

/* ── Modern ── message text column = 13px message inset (3px border + 10px padding) + 50px avatar
   gutter + 5px modern-right margin = 68px; we sit on it so the summary lines up on the nicks. */
.kiwi-messagelist-traffic-group--modern .kiwi-messagelist-traffic-group-summary {
    padding-left: 68px;
}

@media screen and (min-width: 770px) {
    /* expanded detail rows get their avatar gutter back (see below), which leaves the body short
       of the nick column — nudge it onto the column. Scoped to the detail group: standalone
       traffic lines (detailed mode, isolated singles) are already anchored natively at 68px and
       must keep no margin. */
    .kiwi-messagelist-traffic-group-detail
        .kiwi-messagelist-message--modern.kiwi-messagelist-message-traffic .kiwi-messagelist-body,
    .kiwi-messagelist-traffic-group-detail
        .kiwi-messagelist-message--modern.kiwi-messagelist-message-nick .kiwi-messagelist-body,
    .kiwi-messagelist-traffic-group-detail
        .kiwi-messagelist-message--modern.kiwi-messagelist-message-mode .kiwi-messagelist-body {
        margin-left: 21px;
    }

    /* toggle in the avatar gutter, just left of the text column (collapsed + expanded same x) */
    .kiwi-messagelist-traffic-group--modern
        .kiwi-messagelist-traffic-group-summary > .kiwi-messagelist-traffic-group-toggle,
    .kiwi-messagelist-traffic-group--modern
        .kiwi-messagelist-traffic-group-detail > .kiwi-messagelist-traffic-group-toggle {
        position: absolute;
        left: 38px;
        margin: 0;
    }

    /* KiwiIRC indents traffic rows more than messages (it hides the avatar gutter and adds
       padding). Give traffic rows their avatar gutter back so they align with the conversation,
       exactly like the nick/mode rows already do — KiwiIRC's own layout, no per-pixel tweaks. */
    .kiwi-messagelist-traffic-group-detail
        .kiwi-messagelist-message-traffic .kiwi-messagelist-modern-left {
        display: flex !important;
    }
    .kiwi-messagelist-traffic-group-detail
        .kiwi-messagelist-message--modern.kiwi-messagelist-message-traffic {
        padding-left: 0 !important;
    }
}

@media screen and (max-width: 769px) {
    /* narrow modern hides avatars → the column collapses to the left edge */
    .kiwi-messagelist-traffic-group--modern .kiwi-messagelist-traffic-group-summary {
        padding-left: 10px;
    }
}

/* ── Compact ── KiwiIRC's compact layout keeps a ~131px nick gutter from 770px up, but collapses
   it on mobile (nick/body float to the left edge). So the summary/toggle sit on that column down to
   770px, then drop to the left below it. Themes that re-gutter compact (or restyle the toggle) can
   override either side; the px here are KiwiIRC's own compact column, not theme-specific. */
@media screen and (min-width: 770px) {
    .kiwi-messagelist-traffic-group--compact .kiwi-messagelist-traffic-group-summary {
        padding-left: 131px;
    }
    .kiwi-messagelist-traffic-group--compact
        .kiwi-messagelist-traffic-group-detail .kiwi-messagelist-traffic-group-toggle {
        margin-left: 131px;
    }
}

@media screen and (max-width: 769px) {
    .kiwi-messagelist-traffic-group--compact .kiwi-messagelist-traffic-group-summary {
        padding-left: 0;
    }
    .kiwi-messagelist-traffic-group--compact
        .kiwi-messagelist-traffic-group-detail .kiwi-messagelist-traffic-group-toggle {
        margin-left: 0;
    }

    /* expanded: indent the rows so they don't drop to the far-left edge when the group opens —
       they read as indented under the toggle, roughly on the collapsed summary's text column. The
       body is border-box on mobile, so padding doesn't overflow; themes restyling the toggle can
       refine the exact value. */
    .kiwi-messagelist-traffic-group--compact .kiwi-messagelist-traffic-group-detail
        .kiwi-messagelist-message-traffic .kiwi-messagelist-body {
        padding-left: 22px;
    }
}
</style>
