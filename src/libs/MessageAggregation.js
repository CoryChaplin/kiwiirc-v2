'kiwi public';

// Aggregates consecutive traffic events (joins/parts/quits/kicks, nick changes,
// mode changes) into a single collapsible group, IRCCloud-style. Pure module: no
// state, no Vue — so it is trivially unit-testable. Used by orderedMessages for the
// "grouped" traffic presentation.

// The "churn" family — high-volume, low individual value. Topic is content, never
// aggregated (it seals a run). privmsg/action/notice also seal a run.
export const CHURN_TYPES = ['traffic', 'nick', 'mode'];

// A run is broken by any non-churn message, and own actions (join_self, part_self,
// nick_self, mode_self…) are NOT aggregated: they are shown individually (own join
// renders as the .sep-join "you joined" separator, handled at render time).
export function isAggregableTraffic(message, churnTypes = CHURN_TYPES) {
    if (!message || !churnTypes.includes(message.type)) {
        return false;
    }
    if (message.type_extra && message.type_extra.endsWith('_self')) {
        return false;
    }
    return true;
}

// Replace consecutive runs of aggregable traffic with a single group object.
// Input: the already time-ordered, visibility-filtered list (from orderedMessages).
// Output: same list with runs collapsed to { is_traffic_group, events, id }.
// A group always wraps its run — even a single event — so that "grouped" presentation
// renders every traffic line in our voice (the component shows length-1 as a simple
// line without a [+] toggle).
export function aggregateTraffic(messages, opts = {}) {
    const churnTypes = opts.churnTypes || CHURN_TYPES;
    const result = [];
    let run = null;

    const flush = () => {
        if (run) {
            result.push(makeGroup(run));
            run = null;
        }
    };

    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (isAggregableTraffic(message, churnTypes)) {
            // Break the run at a day boundary so a group never spans midnight: the group's
            // day_num/date-marker is taken from its first event, so a straddling run would
            // hide the new-day separator for its later-day portion.
            if (run && message.day_num !== run[0].day_num) {
                flush();
            }
            if (!run) {
                run = [];
            }
            run.push(message);
        } else {
            flush();
            result.push(message);
        }
    }
    flush();

    return result;
}

function makeGroup(events) {
    return {
        is_traffic_group: true,
        events,
        // Stable key for the render loop: derived from the FIRST event only, so a group
        // that grows live keeps the same key (component updates in place, [+] state kept).
        id: 'tg-' + groupKey(events[0]),
    };
}

function groupKey(event) {
    // Traffic messages may lack a server msgid; fall back to instance_num then time.
    return event.id || event.instance_num || event.time;
}

// Split a group's events into the categories the renderer needs. Kept here (not in the
// component) so it is unit-tested. type_extra values come from IrcClient.js:
//   traffic → join | part | quit | kick (+ *_self, already excluded upstream)
//   nick    → '' for others, nick_self for self
//   mode    → varies, mode_self for self
export function summarizeTrafficGroup(group) {
    const joins = [];
    const departures = [];
    const nicks = [];
    const modes = [];

    group.events.forEach((event) => {
        if (event.type === 'nick') {
            nicks.push(event);
        } else if (event.type === 'mode') {
            modes.push(event);
        } else if (event.type === 'traffic') {
            const sub = event.type_extra || '';
            if (sub.startsWith('part') || sub.startsWith('quit') || sub.startsWith('kick')) {
                departures.push(event);
            } else {
                joins.push(event);
            }
        }
    });

    return {
        joins,
        departures,
        nicks,
        modes,
        total: group.events.length,
        startTime: group.events[0].time,
        endTime: group.events[group.events.length - 1].time,
    };
}
