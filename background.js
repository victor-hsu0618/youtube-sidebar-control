// background.js

// Allow the side panel to open when the user clicks the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Optional: specific setup for youtube tabs
const checkAndSetSidebar = (tabId, urlStr) => {
    // Standby Mode: Always enable the panel so it stays open.
    // The internal JS in sidebar.html will handle the "Not Connected / Standby" UI.
    chrome.sidePanel.setOptions({
        tabId,
        path: 'sidebar.html',
        enabled: true
    });
};

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === 'complete' || info.url) {
        checkAndSetSidebar(tabId, tab.url);
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
    if (tab) checkAndSetSidebar(activeInfo.tabId, tab.url);
});

// Proactive Injection for Existing Tabs
const injectToExistingTabs = async () => {
    const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
    for (const tab of tabs) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }).catch(err => console.log('Script already injected or error:', err));
    }
};

chrome.runtime.onInstalled.addListener(() => {
    injectToExistingTabs();
});

chrome.runtime.onStartup.addListener(() => {
    injectToExistingTabs();
});

// Hotkey Relay
chrome.commands.onCommand.addListener(async (command) => {
    // Inclusive matching for all video formats
    const queryOptions = { url: ["*://*.youtube.com/watch*", "*://*.youtube.com/shorts*", "*://*.youtube.com/v/*"] };
    const tabs = await chrome.tabs.query({ ...queryOptions, active: true, currentWindow: true });
    const targetTab = tabs[0] || (await chrome.tabs.query(queryOptions))[0];

    if (targetTab) {
        let action = '';
        if (command === 'toggle-playback') action = 'TOGGLE_PLAYBACK';
        else if (command === 'restart-marker') action = 'RESTART_ACTIVE_MARKER';
        else if (command === 'add-marker') action = 'ADD_BOOKMARK_REQUEST';

        if (action) {
            chrome.tabs.sendMessage(targetTab.id, { action })
                .catch(err => console.log('Hotkey relay failed:', err));
        }
    }
});

// Listener for content script utilities
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'GET_TAB_ID') {
        sendResponse({ tabId: sender.tab ? sender.tab.id : null });
        return true;
    }
});
