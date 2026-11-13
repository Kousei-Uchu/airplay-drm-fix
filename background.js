
chrome.runtime.onInstalled.addListener(() => {
    // Disable the action by default
    chrome.action.disable();

    // Enable the action only on specific domains
    const domains = [
        'netflix.com',
        'disneyplus.com',
        'dssott.com',
        'disney-plus.net',
        'dssedge.com',
        'search-api-disney.bamgrid.com'
    ];

    const rules = domains.map(domain => ({
        conditions: [
            new chrome.declarativeContent.PageStateMatcher({
                pageUrl: { hostSuffix: domain }
            })
        ],
        actions: [
            new chrome.declarativeContent.ShowAction()
        ]
    }));

    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
        chrome.declarativeContent.onPageChanged.addRules(rules);
    });
});
