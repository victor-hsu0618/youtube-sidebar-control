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
