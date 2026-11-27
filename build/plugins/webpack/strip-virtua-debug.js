// Removes a debug console.log left in VList's render function by the virtua build Kiwi uses
// (ItsOnlyBinary/virtua#vue3-kiwiirc, commit bcde1218). It logs every rendered item on every
// list update: ~25 lines per incoming message, and each one captures a stack trace while the
// browser devtools are open (about 10% of the main thread's busy time in a Chrome profile).
//
// Remove this loader once the virtua fork drops the log: it warns when the log is no longer found.
const debugLog = /console\.log\("renderItem",\s*"index:",\s*[\w$]+,\s*"key:",\s*[\w$]+\),\s*/g;

module.exports = function stripVirtuaDebug(source) {
    const stripped = source.replace(debugLog, '');
    if (stripped === source) {
        this.emitWarning(new Error(
            'strip-virtua-debug: the renderItem console.log was not found in virtua, ' +
            'this loader can probably be removed (build/plugins/webpack/strip-virtua-debug.js)'
        ));
    }
    return stripped;
};
