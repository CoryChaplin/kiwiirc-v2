import {
    aggregateTraffic,
    isAggregableTraffic,
    summarizeTrafficGroup,
    CHURN_TYPES,
} from '@/libs/MessageAggregation';

// Minimal message factory — only the fields the aggregation reads.
let seq = 0;
const msg = (over) => ({ instance_num: ++seq, time: seq * 1000, ...over });
const join = (nick, over) => msg({ type: 'traffic', type_extra: 'join', nick, ...over });
const part = (nick, over) => msg({ type: 'traffic', type_extra: 'part', nick, ...over });
const quit = (nick, over) => msg({ type: 'traffic', type_extra: 'quit', nick, ...over });
const nick = (over) => msg({ type: 'nick', type_extra: '', ...over });
const mode = (over) => msg({ type: 'mode', type_extra: '+o', ...over });
const text = (n) => msg({ type: 'privmsg', nick: n });
const topic = (over) => msg({ type: 'topic', type_extra: 'topic_change', ...over });

describe('isAggregableTraffic', () => {
    it('accepts churn types (traffic/nick/mode)', () => {
        expect(isAggregableTraffic(join('a'))).toBe(true);
        expect(isAggregableTraffic(nick())).toBe(true);
        expect(isAggregableTraffic(mode())).toBe(true);
    });

    it('rejects content/message types', () => {
        expect(isAggregableTraffic(text('a'))).toBe(false);
        expect(isAggregableTraffic(topic())).toBe(false);
    });

    it('rejects own (_self) actions so they render individually', () => {
        expect(isAggregableTraffic(join('me', { type_extra: 'join_self' }))).toBe(false);
        expect(isAggregableTraffic(msg({ type: 'mode', type_extra: 'mode_self' }))).toBe(false);
    });

    it('treats nick change for others (empty type_extra) as aggregable', () => {
        expect(isAggregableTraffic(nick({ type_extra: '' }))).toBe(true);
    });

    it('exposes the default churn set', () => {
        expect(CHURN_TYPES).toEqual(['traffic', 'nick', 'mode']);
    });
});

describe('aggregateTraffic', () => {
    it('collapses a consecutive run into one group', () => {
        const out = aggregateTraffic([join('a'), quit('b'), nick(), join('c')]);
        expect(out).toHaveLength(1);
        expect(out[0].is_traffic_group).toBe(true);
        expect(out[0].events).toHaveLength(4);
    });

    it('seals a run on a real message and opens a new group after it', () => {
        const out = aggregateTraffic([join('a'), join('b'), text('x'), quit('c')]);
        expect(out).toHaveLength(3); // group, message, group
        expect(out[0].is_traffic_group).toBe(true);
        expect(out[0].events).toHaveLength(2);
        expect(out[1].type).toBe('privmsg');
        expect(out[2].is_traffic_group).toBe(true);
        expect(out[2].events).toHaveLength(1);
    });

    it('seals a run on a topic change (content), which passes through untouched', () => {
        const t = topic();
        const out = aggregateTraffic([join('a'), t, join('b')]);
        expect(out).toHaveLength(3);
        expect(out[0].is_traffic_group).toBe(true);
        expect(out[1]).toBe(t);
        expect(out[2].is_traffic_group).toBe(true);
    });

    it('wraps a single isolated churn event in a group (length 1)', () => {
        const out = aggregateTraffic([text('x'), join('a'), text('y')]);
        expect(out[1].is_traffic_group).toBe(true);
        expect(out[1].events).toHaveLength(1);
    });

    it('passes own (_self) actions through individually, breaking the run', () => {
        const self = join('me', { type_extra: 'join_self' });
        const out = aggregateTraffic([join('a'), self, join('b')]);
        expect(out).toHaveLength(3);
        expect(out[0].is_traffic_group).toBe(true);
        expect(out[1]).toBe(self);
        expect(out[2].is_traffic_group).toBe(true);
    });

    it('breaks a run at a day boundary so a group never spans midnight', () => {
        const out = aggregateTraffic([
            join('a', { day_num: 1 }),
            quit('b', { day_num: 1 }),
            join('c', { day_num: 2 }),
            nick({ day_num: 2 }),
        ]);
        expect(out).toHaveLength(2);
        expect(out[0].events).toHaveLength(2);
        expect(out[0].events.every((e) => e.day_num === 1)).toBe(true);
        expect(out[1].events).toHaveLength(2);
        expect(out[1].events.every((e) => e.day_num === 2)).toBe(true);
    });

    it('keys a group on its first event only (stable as it grows)', () => {
        const first = join('a', { instance_num: 42 });
        const out = aggregateTraffic([first, join('b'), join('c')]);
        const idSmall = out[0].id;
        const out2 = aggregateTraffic([first, join('b'), join('c'), join('d')]);
        expect(out2[0].id).toBe(idSmall); // grew by one, key unchanged
    });

    it('returns an empty list unchanged', () => {
        expect(aggregateTraffic([])).toEqual([]);
    });

    it('respects a restricted churn set (e.g. modes excluded)', () => {
        const out = aggregateTraffic([join('a'), mode(), join('b')], { churnTypes: ['traffic', 'nick'] });
        // mode is no longer churn → it seals, producing group/mode/group
        expect(out).toHaveLength(3);
        expect(out[0].is_traffic_group).toBe(true);
        expect(out[1].type).toBe('mode');
        expect(out[2].is_traffic_group).toBe(true);
    });
});

describe('summarizeTrafficGroup', () => {
    it('classifies joins, departures (part/quit/kick), nicks and modes', () => {
        const group = aggregateTraffic([
            join('a'), join('b'),
            part('c'), quit('d'), msg({ type: 'traffic', type_extra: 'kick', nick: 'e' }),
            nick(), mode(),
        ])[0];
        const s = summarizeTrafficGroup(group);
        expect(s.joins.map((e) => e.nick)).toEqual(['a', 'b']);
        expect(s.departures.map((e) => e.nick)).toEqual(['c', 'd', 'e']);
        expect(s.nicks).toHaveLength(1);
        expect(s.modes).toHaveLength(1);
        expect(s.total).toBe(7);
    });

    it('reports the time span of the group (first → last)', () => {
        const a = join('a', { time: 100 });
        const b = quit('b', { time: 500 });
        const s = summarizeTrafficGroup(aggregateTraffic([a, b])[0]);
        expect(s.startTime).toBe(100);
        expect(s.endTime).toBe(500);
    });
});
