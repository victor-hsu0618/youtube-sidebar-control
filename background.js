// background.js

// Allow the side panel to open when the user clicks the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Optional: specific setup for youtube tabs
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (!tab.url) return;
    const url = new URL(tab.url);
    // Enables the side panel on google.com
    if (url.origin.includes('youtube.com')) {
        chrome.sidePanel.setOptions({
            tabId,
            path: 'sidebar.html',
            enabled: true
        });
    } else {
        // Disables the side panel on other sites
        chrome.sidePanel.setOptions({
            tabId,
            enabled: false
        });
    }
});
