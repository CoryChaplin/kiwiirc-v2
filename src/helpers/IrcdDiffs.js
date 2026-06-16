'kiwi public';

export function extbanAccount(network) {
    // Eg. InspIRCd-2.0
    // Eg. UnrealIRCd-4.0.17
    // Eg. ircd-seven-1.1.7
    // Eg. u2.10.12.10+snircd(1.3.4a)
    let ircdType = network.ircd.toLowerCase();

    // Eg. ~,qjncrRa
    // Eg. ,qjncrRa
    let extban = network.ircClient.network.supports('EXTBAN') || '';
    if (!extban) {
        return '';
    }

    let prefix = extban.split(',')[0];
    let type = 'a';

    // https://docs.inspircd.org/3/modules/services_account/#extended-bans
    if (ircdType.indexOf('inspircd') > -1) {
        type = 'R';
    }

    return prefix + type;
}

export function timedBanSupported(network) {
    // Some servers advertise TBAN in ISUPPORT
    if (network.ircClient.network.supports('TBAN')) {
        return true;
    }

    // Otherwise, fall back to IRCd type heuristic from RPL_YOURHOST, like extbanAccount
    // Eg. UnrealIRCd-4.0.17 / InspIRCd-2.0
    let ircdType = network.ircd.toLowerCase();
    return ircdType.indexOf('unrealircd') > -1 || ircdType.indexOf('inspircd') > -1;
}
