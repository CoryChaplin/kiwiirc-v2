import { computed, isReactive } from 'vue';
import state from '@/libs/state';

// importState() runs on every page load with a saved state. The state object is not a Vue
// instance, so anything it replaces with the plain parsed JSON silently stops being reactive.
function importSample() {
    const s = state.create();
    s.importState(JSON.stringify({
        networks: [{
            id: 1,
            name: 'TestNetwork',
            connection: { nick: 'tester', server: 'irc.example.org', port: 6697, tls: true },
            settings: { show_raw_caps: true },
            buffers: [
                { name: '*', key: '', enabled: true, settings: {}, latest_messages: [] },
                { name: '#test', key: '', enabled: true, settings: { alert_on: 'message' }, latest_messages: [] },
            ],
        }],
        user_settings: { language: 'fr-fr' },
    }));
    const network = s.getNetwork(1);
    const buffer = network.buffers.find((b) => b.name === '#test');
    return { s, network, buffer };
}

describe('state.importState()', () => {
    it('restores the saved values', () => {
        const { s, network, buffer } = importSample();
        expect(network.connection.nick).toBe('tester');
        expect(network.connection.server).toBe('irc.example.org');
        expect(network.settings.show_raw_caps).toBe(true);
        expect(buffer.setting('alert_on')).toBe('message');
        expect(s.setting('language')).toBe('fr-fr');
    });

    it('keeps the restored objects reactive', () => {
        const { s, network, buffer } = importSample();
        expect(isReactive(s.user_settings)).toBe(true);
        expect(isReactive(network.connection)).toBe(true);
        expect(isReactive(network.settings)).toBe(true);
        expect(isReactive(buffer.settings)).toBe(true);
    });

    it('updates computed values after a restored setting changes', () => {
        const { s, network, buffer } = importSample();
        const nick = computed(() => network.connection.nick);
        const rawCaps = computed(() => network.settings.show_raw_caps);
        const alertOn = computed(() => buffer.setting('alert_on'));
        const language = computed(() => s.setting('language'));
        expect([nick.value, rawCaps.value, alertOn.value, language.value])
            .toEqual(['tester', true, 'message', 'fr-fr']);

        network.connection.nick = 'renamed';
        network.settings.show_raw_caps = false;
        buffer.setting('alert_on', 'never');
        s.setting('language', 'en-us');
        expect([nick.value, rawCaps.value, alertOn.value, language.value])
            .toEqual(['renamed', false, 'never', 'en-us']);
    });

    it('keeps default connection fields that are missing from the saved state', () => {
        const { network } = importSample();
        expect(network.connection.encoding).toBe('utf8');
    });
});
