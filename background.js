// background.js

const YOUTUBE_TAB_URLS = [
    "*://*.youtube.com/*",
    "*://music.youtube.com/*"
];

const YOUTUBE_VIDEO_URLS = [
    "*://*.youtube.com/watch*",
    "*://music.youtube.com/watch*",
    "*://music.youtube.com/playlist*",
    "*://*.youtube.com/shorts*",
    "*://*.youtube.com/v/*"
];

const LOCAL_BACKUP_ALARM = 'local-json-backup';
const LOCAL_BACKUP_INTERVAL_MINUTES = 360;
const LOCAL_BACKUP_MAX_SNAPSHOTS = 5;
const LOCAL_BACKUP_STORAGE_KEY = 'local_json_backups';

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
    const tabs = await chrome.tabs.query({ url: YOUTUBE_TAB_URLS });
    for (const tab of tabs) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }).catch(err => console.log('Script already injected or error:', err));
    }
};

function summarizeBackupData(data = {}) {
    const keys = Object.keys(data || {});
    const videoKeys = keys.filter(k => k.startsWith('v_'));
    const groups = Array.isArray(data.favorite_groups) ? data.favorite_groups.filter(Boolean) : [];
    let savedCount = 0;
    let markerCount = 0;

    videoKeys.forEach(key => {
        const video = data[key] || {};
        if (video.isSaved) savedCount++;
        if (video.tagGroups) {
            markerCount += Object.values(video.tagGroups).reduce((acc, group) => acc + (Array.isArray(group) ? group.length : 0), 0);
        } else if (Array.isArray(video.bookmarks)) {
            markerCount += video.bookmarks.length;
        }
    });

    return {
        videoCount: videoKeys.length,
        savedCount,
        groupCount: groups.length,
        markerCount,
        hasContent: videoKeys.length > 0 || groups.length > 0 || markerCount > 0
    };
}

async function getLocalBackupStatus() {
    const local = await chrome.storage.local.get(LOCAL_BACKUP_STORAGE_KEY);
    const backups = Array.isArray(local[LOCAL_BACKUP_STORAGE_KEY]) ? local[LOCAL_BACKUP_STORAGE_KEY] : [];
    const latest = backups[0] || null;
    return {
        count: backups.length,
        max: LOCAL_BACKUP_MAX_SNAPSHOTS,
        intervalMinutes: LOCAL_BACKUP_INTERVAL_MINUTES,
        latest: latest ? {
            id: latest.id,
            createdAt: latest.createdAt,
            reason: latest.reason,
            summary: latest.summary
        } : null
    };
}

async function createLocalJsonBackup(reason = 'scheduled') {
    const data = await chrome.storage.sync.get(null);
    const summary = summarizeBackupData(data);
    if (!summary.hasContent) {
        return { skipped: true, reason: 'empty-data', status: await getLocalBackupStatus() };
    }

    const local = await chrome.storage.local.get(LOCAL_BACKUP_STORAGE_KEY);
    const backups = Array.isArray(local[LOCAL_BACKUP_STORAGE_KEY]) ? local[LOCAL_BACKUP_STORAGE_KEY] : [];
    const createdAt = new Date().toISOString();
    const snapshot = {
        id: `local-${Date.now()}`,
        createdAt,
        reason,
        summary,
        data
    };

    backups.unshift(snapshot);
    await chrome.storage.local.set({
        [LOCAL_BACKUP_STORAGE_KEY]: backups.slice(0, LOCAL_BACKUP_MAX_SNAPSHOTS)
    });

    return { skipped: false, backup: snapshot, status: await getLocalBackupStatus() };
}

async function getLatestLocalJsonBackup() {
    const local = await chrome.storage.local.get(LOCAL_BACKUP_STORAGE_KEY);
    const backups = Array.isArray(local[LOCAL_BACKUP_STORAGE_KEY]) ? local[LOCAL_BACKUP_STORAGE_KEY] : [];
    return backups[0] || null;
}

function scheduleLocalJsonBackup() {
    chrome.alarms.create(LOCAL_BACKUP_ALARM, {
        periodInMinutes: LOCAL_BACKUP_INTERVAL_MINUTES
    });
}

chrome.runtime.onInstalled.addListener(() => {
    injectToExistingTabs();
    scheduleLocalJsonBackup();
    createLocalJsonBackup('installed').catch(err => console.warn('[Local Backup] Initial backup failed:', err));
});

chrome.runtime.onStartup.addListener(() => {
    injectToExistingTabs();
    scheduleLocalJsonBackup();
    createLocalJsonBackup('startup').catch(err => console.warn('[Local Backup] Startup backup failed:', err));
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === LOCAL_BACKUP_ALARM) {
        createLocalJsonBackup('scheduled').catch(err => console.warn('[Local Backup] Scheduled backup failed:', err));
    }
});

// Hotkey Relay
chrome.commands.onCommand.addListener(async (command) => {
    // Inclusive matching for all video formats
    const queryOptions = { url: YOUTUBE_VIDEO_URLS };
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

    if (msg.action === 'GET_LOCAL_BACKUP_STATUS') {
        getLocalBackupStatus().then(sendResponse).catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (msg.action === 'CREATE_LOCAL_BACKUP') {
        createLocalJsonBackup('manual').then(sendResponse).catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (msg.action === 'GET_LATEST_LOCAL_BACKUP') {
        getLatestLocalJsonBackup().then(sendResponse).catch(err => sendResponse({ error: err.message }));
        return true;
    }
});
