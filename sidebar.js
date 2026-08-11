// sidebar.js

const debugConsole = document.getElementById('debug-console');
const debugLogs = document.getElementById('debug-logs');

const YOUTUBE_VIDEO_QUERY_URLS = [
    "*://*.youtube.com/watch*",
    "*://music.youtube.com/watch*",
    "*://music.youtube.com/playlist*",
    "*://*.youtube.com/playlist*",
    "*://*.youtube.com/shorts*",
    "*://*.youtube.com/v/*"
];

function isYouTubeMusicUrl(url) {
    try {
        return new URL(url).hostname === 'music.youtube.com';
    } catch (e) {
        return Boolean(url && url.includes('music.youtube.com'));
    }
}

function isYouTubeUrl(url) {
    return Boolean(url && (url.includes('youtube.com') || url.includes('music.youtube.com')));
}

function isYouTubeVideoUrl(url) {
    return Boolean(url && (
        url.includes('youtube.com/watch') ||
        url.includes('music.youtube.com/watch') ||
        url.includes('youtube.com/playlist') ||
        url.includes('/shorts/') ||
        url.includes('/v/') ||
        url.includes('/embed/')
    ));
}

function log(msg, type = 'info') {
    // if (debugConsole) debugConsole.style.display = 'block'; // Hidden for release
    if (!debugLogs) return;
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    if (type === 'error') line.style.color = '#ff4e45';
    else if (type === 'success') line.style.color = '#4cc713';
    else line.style.color = '#aaa';
    debugLogs.appendChild(line);
    console.log(msg);
}

// Log Extension ID for cross-device verification
console.log("[YT Study] Extension ID:", chrome.runtime.id);
log(`Instance ID: ${chrome.runtime.id.substring(0, 8)}...`, 'info');

let isCloneEnabled = false; // Global state
let currentBuildLabel = 'STORE';
const ALL_VIDEOS_GROUP = '__all_videos__';
const ALL_VIDEOS_LABEL = 'All Videos';
const FREE_LIBRARY_LIMIT = 20;
const FREE_MARKER_GROUP_LIMIT = 20;

// Set app version and build channel from manifest.
try {
    const manifest = chrome.runtime.getManifest();
    const versionBadge = document.getElementById('app-version-badge');
    if (manifest) {
        const vName = manifest.version_name || manifest.version;
        const isLocalBuild = /\bLOCAL\b/i.test(manifest.name || '');
        const buildLabel = isLocalBuild ? ' LOCAL' : '';
        currentBuildLabel = isLocalBuild ? 'LOCAL' : 'STORE';
        document.title = `YT Study Companion${buildLabel}`;

        if (versionBadge) {
            versionBadge.textContent = `v${vName}${buildLabel}`;
            versionBadge.title = isLocalBuild ? 'Local unpacked/test build' : 'Store build';
            versionBadge.classList.toggle('local-build', isLocalBuild);
        }
    }
} catch (e) {
    console.error("[YT Study] Failed to read version from manifest:", e);
}

const extensionIdValue = document.getElementById('extension-id-value');
const extensionBuildLabel = document.getElementById('extension-build-label');
const copyExtensionIdBtn = document.getElementById('btn-copy-extension-id');
if (extensionIdValue) extensionIdValue.textContent = chrome.runtime.id;
if (extensionBuildLabel) extensionBuildLabel.textContent = currentBuildLabel;
copyExtensionIdBtn?.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(chrome.runtime.id);
        const originalText = copyExtensionIdBtn.textContent;
        copyExtensionIdBtn.textContent = 'Copied';
        setTimeout(() => {
            copyExtensionIdBtn.textContent = originalText;
        }, 1200);
    } catch (e) {
        prompt('Copy Extension ID:', chrome.runtime.id);
    }
});

// Initialize Monetization
if (typeof initMonetization === 'function') {
    initMonetization();
}

/**
 * Update UI based on subscription status
 */
function updateSubscriptionUI() {
    console.log('[YT Study] updateSubscriptionUI triggered');
    const proBadge = document.getElementById('pro-badge');
    const upgradeBtn = document.getElementById('btn-upgrade');
    const deactivateBtn = document.getElementById('btn-deactivate-pro');
    const upgradeDot = document.getElementById('nav-upgrade-dot');
    const upgradeInfoBox = document.getElementById('upgrade-info-box');

    if (!proBadge || !upgradeBtn) {
        console.warn('[YT Study] Monetization UI elements not found in DOM yet.');
        return;
    }

    const paid = isPro();
    console.log('[YT Study] Current Subscription Level:', paid ? 'PRO' : 'FREE');

    if (paid) {
        proBadge.style.display = 'inline-block';
        upgradeBtn.style.display = 'none';
        if (deactivateBtn) deactivateBtn.style.display = 'inline-block';
        if (upgradeDot) upgradeDot.style.display = 'none';
        if (upgradeInfoBox) upgradeInfoBox.style.display = 'none';
    } else {
        proBadge.style.display = 'none';
        upgradeBtn.style.display = 'block';
        if (deactivateBtn) deactivateBtn.style.display = 'none';
        if (upgradeDot) upgradeDot.style.display = 'inline';
        if (upgradeInfoBox) upgradeInfoBox.style.display = 'block';
    }
}
window.updateSubscriptionUI = updateSubscriptionUI;

// Initial UI Sweep
setTimeout(updateSubscriptionUI, 500);

// Attach Upgrade Button Listener
document.getElementById('btn-upgrade')?.addEventListener('click', () => {
    if (typeof upgradeToPro === 'function') {
        upgradeToPro();
    }
});

// Attach Deactivate Button Listener
document.getElementById('btn-deactivate-pro')?.addEventListener('click', () => {
    if (typeof deactivatePro === 'function') {
        deactivatePro();
    }
});

/**
 * Audit-friendly storage removal
 */
async function secureRemove(key) {
    if (!key) return;
    log(`ATTEMPT DELETE: ${key}`, 'error');
    try {
        await chrome.storage.sync.remove(key);
        log(`SUCCESS DELETE: ${key}`, 'success');
        if (chrome.runtime.lastError) {
            log(`DELETE ERROR: ${chrome.runtime.lastError.message}`, 'error');
        }
    } catch (err) {
        log(`DELETE FATAL: ${err.message}`, 'error');
    }
}

function isSyncQuotaError(err) {
    const message = String(err?.message || err || '').toLowerCase();
    return message.includes('quota') || message.includes('max_write') || message.includes('storage');
}

function chromeSyncSet(items) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(items, () => {
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message));
            else resolve();
        });
    });
}

function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message));
            else if (response?.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
}

async function safeSyncSet(items, context = 'Save data') {
    try {
        await chromeSyncSet(items);
        return true;
    } catch (err) {
        const message = err?.message || String(err);
        log(`${context} failed: ${message}`, 'error');

        if (isSyncQuotaError(err)) {
            alert('Cloud Space is full, so this change was not saved. Please delete older videos/groups or export a backup before trying again.');
        } else {
            alert(`${context} failed: ${message}`);
        }

        throw err;
    }
}

/*
// Global Click Debugger: Logs EVERY click to verify browser event firing
document.addEventListener('mousedown', (e) => {
    const target = e.target.closest('button, input, select, .bookmark-item');
    if (target) {
        let label = target.id || target.className || target.tagName;
        if (target.classList.contains('bookmark-item')) label = `Marker:${target.dataset.time}`;
        console.log(`[Click Debug] Mousedown on:`, label);
        // Only log to UI if it's a known interactive element or if we suspect it's being "swallowed"
    } else {
        console.log(`[Click Debug] Mousedown on BACKGROUND:`, e.target.tagName);
    }
}, true); // Use capture phase to catch even if stopped
*/

try {
    // --- State ---
    let currentVideoId = null;
    let currentStorageKey = null; // null = Temporary Session (Unsaved)
    let currentVideoData = createEmptyData();
    let isDraggingProgress = false;
    let connectedTabId = null; // Track connected tab for Popout
    let pendingHighlightTime = null; // Persistent highlight state
    let isSyncing = false; // Prevent concurrent profile loads
    let lastKnownCurrentTime = 0; // Cache for active marker tracking
    let lastKnownDuration = 0; // Global duration sync for hotkeys
    let lastActiveLiTime = -1; // Track which marker is currently active to avoid redundant scroll/updates
    let lastCommandSentTime = 0; // Guard for speculative UI updates
    let favoriteGroupsList = ["Default"];
    let currentFavGroup = ALL_VIDEOS_GROUP;
    let isLibraryEditMode = false;
    let favoriteGroupOrders = {}; // Cache for custom orders
    let isPlaylistMode = false;
    let currentPlaylistItems = [];
    let browsedGroupItems = []; // For Favorites view browsing
    let detectedPlaylist = null;
    let lastActiveTabId = null; // Track current global active tab for detach detection


    function createEmptyData(id = null, title = "Unknown") {
        return {
            id: id,
            title: title,
            thumbnail: "",
            source: "youtube",
            isSaved: false,
            isDefault: false,
            createdAt: 0,
            updatedAt: 0,
            profileName: "New Session",
            activeGroup: "Default",
            tagGroups: { "Default": [], "Study": [], "Cust. A": [], "Cust. B": [] },
            favoriteGroups: [], // Video can belong to multiple favorite groups
            duration: 0
        };
    }

// --- Supabase Cloud Sync (s4.0.0) ---
const SUPABASE_LAST_SNAPSHOT_KEY = 'supabase_last_snapshot_updated_at';
let cloudSyncDebounceTimer = null;
let isApplyingCloudSnapshot = false;
let hasCheckedCloudSnapshot = false;

function summarizeSyncData(data = {}) {
    const keys = Object.keys(data || {});
    const videoKeys = keys.filter(k => k.startsWith('v_'));
    const groups = Array.isArray(data.favorite_groups) ? data.favorite_groups.filter(Boolean) : [];
    let markerCount = 0;
    let savedCount = 0;

    videoKeys.forEach(k => {
        const video = data[k] || {};
        if (video.isSaved) savedCount++;
        if (video.tagGroups) {
            markerCount += Object.values(video.tagGroups).reduce((acc, group) => acc + (Array.isArray(group) ? group.length : 0), 0);
        } else if (Array.isArray(video.bookmarks)) {
            markerCount += video.bookmarks.length;
        }
    });

    return {
        keyCount: keys.length,
        videoCount: videoKeys.length,
        savedCount,
        groupCount: groups.length,
        markerCount,
        hasContent: videoKeys.length > 0 || markerCount > 0 || savedCount > 0
    };
}

function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function getSyncDataSignature(data = {}) {
    return stableStringify(data || {});
}

function formatSyncSummary(summary) {
    return `${summary.videoCount} profiles, ${summary.savedCount} saved, ${summary.groupCount} groups, ${summary.markerCount} markers`;
}

function formatBytes(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getLatestLocalDataTimestamp(data = {}) {
    return Object.keys(data || {}).reduce((latest, key) => {
        if (!key.startsWith('v_')) return latest;
        const video = data[key] || {};
        const updatedAt = Number(video.updatedAt || video.createdAt || 0);
        return Number.isFinite(updatedAt) && updatedAt > latest ? updatedAt : latest;
    }, 0);
}

function formatSyncDate(value) {
    if (!value) return 'Unknown';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function buildSyncFreshnessMessage(localData = {}, cloudUpdatedAt = null) {
    const localMs = getLatestLocalDataTimestamp(localData);
    const cloudMs = cloudUpdatedAt ? new Date(cloudUpdatedAt).getTime() : 0;
    const localLabel = localMs ? formatSyncDate(localMs) : 'Unknown';
    const cloudLabel = cloudMs ? formatSyncDate(cloudMs) : 'Unknown';

    let recommendation = 'Unable to determine which side is newer. Compare the summaries below before choosing.';
    if (localMs && cloudMs) {
        if (cloudMs > localMs + 1000) {
            recommendation = 'Cloud looks newer than this device. Download is recommended if you want the latest cloud changes here.';
        } else if (localMs > cloudMs + 1000) {
            recommendation = 'This device looks newer than cloud. Keep local data is recommended; it can upload on the next sync.';
        } else {
            recommendation = 'Local and cloud appear to be from the same time. Download is usually unnecessary.';
        }
    } else if (cloudMs && !localMs) {
        recommendation = 'Cloud has a snapshot, but this device has no clear local update time. Download is recommended only if this is a fresh or empty device.';
    } else if (localMs && !cloudMs) {
        recommendation = 'This device has local update history, but cloud has no timestamp. Keep local data unless you know cloud has the data you need.';
    }

    return {
        localMs,
        cloudMs,
        localLabel,
        cloudLabel,
        recommendation
    };
}

async function rememberCloudSnapshotTimestamp(updatedAt) {
    if (!updatedAt) return;
    await chrome.storage.local.set({ [SUPABASE_LAST_SNAPSHOT_KEY]: updatedAt });
}

async function isCloudSnapshotNewer(updatedAt) {
    if (!updatedAt) return true;
    const local = await chrome.storage.local.get(SUPABASE_LAST_SNAPSHOT_KEY);
    const lastSeen = local[SUPABASE_LAST_SNAPSHOT_KEY];
    if (!lastSeen) return true;

    return new Date(updatedAt).getTime() > new Date(lastSeen).getTime();
}

function confirmCloudAction(title, message, confirmText = 'Download') {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        if (!modal || typeof showConfirmModal !== 'function') {
            resolve(confirm(message));
            return;
        }

        showConfirmModal(title, message, () => resolve(true), () => resolve(false), confirmText);
    });
}

async function refreshAfterCloudRestore(restoredData = {}) {
    if (currentVideoId) updateDataCache(restoredData, currentVideoId);

    if (currentStorageKey && restoredData[currentStorageKey]) {
        currentVideoData = restoredData[currentStorageKey];
        updateHeader();
        renderBookmarks();
    }

    await loadLibrary();
    updateStorageUsage();

    if (currentVideoData && (currentVideoData.title === "Connecting..." || currentVideoId === null)) {
        establishConnection(true);
    }
}

async function applyCloudSnapshot(snapshot, source = 'manual', cloudUpdatedAt = null) {
    if (!snapshot || typeof snapshot !== 'object') {
        alert("No cloud data found for this account.");
        return false;
    }

    isApplyingCloudSnapshot = true;
    clearTimeout(cloudSyncDebounceTimer);

    try {
        await safeSyncSet(snapshot, 'Restore cloud snapshot');
        await rememberCloudSnapshotTimestamp(cloudUpdatedAt);
        await refreshAfterCloudRestore(snapshot);
        const summary = summarizeSyncData(snapshot);
        log(`Cloud data restored (${formatSyncSummary(summary)}).`, "success");
        if (source === 'manual') {
            alert(`Cloud data downloaded.\n\n${formatSyncSummary(summary)}`);
        }
        return true;
    } catch (err) {
        log("Cloud restore failed: " + err.message, "error");
        alert("Cloud restore failed: " + err.message);
        return false;
    } finally {
        setTimeout(() => {
            isApplyingCloudSnapshot = false;
        }, 1000);
    }
}

async function downloadCloudSnapshot({ prompt = true, source = 'manual' } = {}) {
    if (!window.supabaseManager) return false;

    const dot = document.getElementById('cloud-sync-status-dot');
    if (dot) dot.style.background = 'var(--accent-color)';

    try {
        const fetchRecord = typeof window.supabaseManager.fetchLatestSnapshotRecord === 'function'
            ? window.supabaseManager.fetchLatestSnapshotRecord.bind(window.supabaseManager)
            : async () => {
                const data_json = await window.supabaseManager.fetchLatestSnapshot();
                return data_json ? { data_json, updated_at: null } : null;
            };
        const record = await fetchRecord();
        const cloudData = record?.data_json;
        if (!cloudData) {
            if (source === 'manual') alert("No cloud data found for this account.");
            if (dot) dot.style.background = '#333';
            return false;
        }

        const cloudSummary = summarizeSyncData(cloudData);
        if (!cloudSummary.hasContent) {
            if (source === 'manual') alert("Cloud snapshot is empty.");
            if (dot) dot.style.background = '#333';
            return false;
        }

        if (prompt) {
            const localData = await chrome.storage.sync.get(null);
            const localSummary = summarizeSyncData(localData);
            const freshness = buildSyncFreshnessMessage(localData, record.updated_at);
            const shouldRestore = await confirmCloudAction(
                "Download Cloud Data",
                `${freshness.recommendation}\n\nLocal: ${formatSyncSummary(localSummary)}\nLocal latest update: ${freshness.localLabel}\n\nCloud: ${formatSyncSummary(cloudSummary)}\nCloud last sync: ${freshness.cloudLabel}\n\nReplace matching local records with the Supabase snapshot?`,
                "Download"
            );
            if (!shouldRestore) {
                if (dot) dot.style.background = '#333';
                return false;
            }
        }

        const restored = await applyCloudSnapshot(cloudData, source, record.updated_at);
        if (dot) dot.style.background = restored ? '#4cc713' : 'var(--danger-color)';
        return restored;
    } catch (err) {
        log("Cloud download failed: " + err.message, "error");
        if (dot) dot.style.background = 'var(--danger-color)';
        if (source === 'manual') alert("Cloud download failed: " + err.message);
        return false;
    }
}

async function checkCloudSnapshotAfterLogin({ onlyIfRemoteNewer = false, uploadOnCancel = true } = {}) {
    if (hasCheckedCloudSnapshot || !window.supabaseManager) return false;
    hasCheckedCloudSnapshot = true;

    try {
        const record = typeof window.supabaseManager.fetchLatestSnapshotRecord === 'function'
            ? await window.supabaseManager.fetchLatestSnapshotRecord()
            : null;
        const cloudData = record?.data_json;
        const cloudSummary = summarizeSyncData(cloudData);
        if (!cloudSummary.hasContent) return false;

        const localData = await chrome.storage.sync.get(null);
        const localSummary = summarizeSyncData(localData);

        if (getSyncDataSignature(localData) === getSyncDataSignature(cloudData)) {
            await rememberCloudSnapshotTimestamp(record.updated_at);
            return false;
        }

        if (!localSummary.hasContent) {
            return downloadCloudSnapshot({ prompt: false, source: 'login' });
        }

        const freshness = buildSyncFreshnessMessage(localData, record.updated_at);
        if (freshness.localMs && freshness.cloudMs && freshness.localMs > freshness.cloudMs + 1000) {
            console.log('[Cloud Sync] Local data is newer than cloud. Uploading local snapshot without prompting.');
            await rememberCloudSnapshotTimestamp(record.updated_at);
            triggerCloudSync();
            return false;
        }

        if (onlyIfRemoteNewer && !(await isCloudSnapshotNewer(record.updated_at))) {
            return false;
        }

        const cancelBehavior = uploadOnCancel
            ? 'Cancel keeps local data and uploads it to cloud.'
            : 'Cancel keeps local data on this device.';
        const shouldRestore = await confirmCloudAction(
            "Cloud Sync Check",
            `${freshness.recommendation}\n\nLocal: ${formatSyncSummary(localSummary)}\nLocal latest update: ${freshness.localLabel}\n\nCloud: ${formatSyncSummary(cloudSummary)}\nCloud last sync: ${freshness.cloudLabel}\n\nDownload cloud data to this device?\n${cancelBehavior}`,
            "Download"
        );

        if (shouldRestore) {
            return applyCloudSnapshot(cloudData, 'login', record.updated_at);
        }

        await rememberCloudSnapshotTimestamp(record.updated_at);
    } catch (err) {
        console.error('[Cloud Sync] Login restore check failed:', err);
    }

    return false;
}

async function handleSupabaseSignedIn() {
    initSupabaseAuth();
    const restored = await checkCloudSnapshotAfterLogin();
    if (!restored) triggerCloudSync();
    refreshCloudSyncStats();
}

async function hasCloudSyncAccess() {
    if (typeof isPro !== 'function') return true;
    if (isPro()) return true;

    try {
        const res = await chrome.storage.sync.get(['pro_activated']);
        if (res.pro_activated) {
            if (window.userStatus) window.userStatus.paid = true;
            if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
            return true;
        }
    } catch (e) {
        console.warn('[Cloud Sync] Pro status fallback check failed:', e);
    }

    return false;
}

async function refreshCloudSyncStats() {
    const statsEl = document.getElementById('cloud-sync-stats');
    if (!statsEl || !window.supabaseManager) return;

    statsEl.textContent = 'Cloud: Checking...';

    try {
        const record = typeof window.supabaseManager.fetchLatestSnapshotRecord === 'function'
            ? await window.supabaseManager.fetchLatestSnapshotRecord()
            : null;
        const cloudData = record?.data_json;

        if (!cloudData) {
            statsEl.textContent = 'Cloud: No snapshot yet';
            return;
        }

        const summary = summarizeSyncData(cloudData);
        const bytes = new Blob([JSON.stringify(cloudData)]).size;
        const updatedAt = record.updated_at ? new Date(record.updated_at) : null;
        const updatedLabel = updatedAt && !Number.isNaN(updatedAt.getTime())
            ? updatedAt.toLocaleString()
            : 'Unknown';

        statsEl.textContent = `Cloud: ${formatBytes(bytes)} | ${summary.savedCount} videos | ${summary.groupCount} groups | Last sync: ${updatedLabel}`;
    } catch (err) {
        statsEl.textContent = 'Cloud: Stats unavailable';
        console.warn('[Cloud Sync] Stats refresh failed:', err);
    }
}

/**
 * Trigger a background sync of all local data to Supabase
 */
async function triggerCloudSync() {
    if (isApplyingCloudSnapshot) {
        console.log('[Cloud Sync] Skip upload while applying cloud snapshot.');
        return;
    }

    // Check if Pro (Gated). Read storage as a fallback because sidebar startup
    // can reach cloud sync before monetization.js finishes hydrating userStatus.
    if (!(await hasCloudSyncAccess())) {
        console.log('[Cloud Sync] Skip: Non-pro user.');
        return;
    }

    if (!window.supabaseManager) return;

    clearTimeout(cloudSyncDebounceTimer);
    cloudSyncDebounceTimer = setTimeout(async () => {
        const dot = document.getElementById('cloud-sync-status-dot');
        if (dot) dot.style.background = 'var(--accent-color)'; // Pulsing or active

        try {
            console.log('[Cloud Sync] Starting snapshot sync...');
            const allData = await chrome.storage.sync.get(null);
            const localSummary = summarizeSyncData(allData);

            if (!localSummary.hasContent) {
                const cloudData = await window.supabaseManager.fetchLatestSnapshot();
                const cloudSummary = summarizeSyncData(cloudData);
                if (cloudSummary.hasContent) {
                    console.warn('[Cloud Sync] Local data is empty but cloud has data. Upload skipped.');
                    if (dot) dot.style.background = 'var(--warning-color)';
                    downloadCloudSnapshot({ prompt: true, source: 'empty-local-guard' });
                    return;
                }
            }

            const updatedAt = await window.supabaseManager.upsertSnapshot(allData);
            await rememberCloudSnapshotTimestamp(updatedAt);
            await refreshCloudSyncStats();
            
            if (dot) {
                dot.style.background = '#4cc713'; // Success Green
                setTimeout(() => { if (dot) dot.style.background = '#333'; }, 2000);
            }
        } catch (e) {
            console.error('[Cloud Sync] Error:', e);
            if (dot) dot.style.background = 'var(--danger-color)';
        }
    }, 3000); // 3 second debounce to avoid rate limits
}

/**
 * Initialize Supabase Auth UI state
 */
async function initSupabaseAuth() {
    if (!window.supabaseManager) return;
    
    const loginForm = document.getElementById('supabase-login-form');
    const userInfo = document.getElementById('supabase-user-info');
    const userEmail = document.getElementById('supabase-user-email');
    const syncHint = document.getElementById('cloud-sync-hint');

    try {
        if (!window.supabaseManager.client) {
            console.warn('[Supabase] Client not ready for auth check.');
            return;
        }
        const { data: { user } } = await window.supabaseManager.client.auth.getUser();
        if (user) {
            if (loginForm) loginForm.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            if (userEmail) userEmail.textContent = user.email;
            if (syncHint) syncHint.innerHTML = '<span style="color:#4cc713;">✓ Cloud Sync Active</span>';
            refreshCloudSyncStats();
            return user;
        } else {
            if (loginForm) loginForm.style.display = 'flex';
            if (userInfo) userInfo.style.display = 'none';
            if (syncHint) syncHint.textContent = 'Cross-device cloud sync for Pro users.';
            const statsEl = document.getElementById('cloud-sync-stats');
            if (statsEl) statsEl.textContent = 'Cloud: Sign in to view stats';
        };
    } catch (e) {
        console.error('[Supabase] Auth init error:', e);
    }

    return null;
}

document.getElementById('btn-supabase-send-otp')?.addEventListener('click', async () => {
    const email = document.getElementById('supabase-email')?.value;
    if (!email) {
        alert("Please enter your email");
        return;
    }
    try {
        console.log('[UI] Sending OTP to:', email);
        await window.supabaseManager.sendOtp(email);
        document.getElementById('otp-email-step').style.display = 'none';
        document.getElementById('otp-verify-step').style.display = 'flex';
        alert("A 6-digit code has been sent to your email!");
    } catch (e) {
        alert("Failed to send code: " + e.message);
    }
});

document.getElementById('btn-supabase-verify-otp')?.addEventListener('click', async () => {
    const email = document.getElementById('supabase-email')?.value;
    const token = document.getElementById('supabase-otp-code')?.value;
    if (!token) {
        alert("Please enter the 6-digit code");
        return;
    }
    try {
        console.log('[UI] Verifying OTP...');
        const user = await window.supabaseManager.verifyOtp(email, token);
        if (user) {
            handleSupabaseSignedIn();
        }
    } catch (e) {
        alert("Verification failed: " + e.message);
    }
});

document.getElementById('btn-supabase-otp-back')?.addEventListener('click', () => {
    document.getElementById('otp-email-step').style.display = 'flex';
    document.getElementById('otp-verify-step').style.display = 'none';
});

document.getElementById('btn-supabase-logout')?.addEventListener('click', async () => {
    if (!window.supabaseManager) return;
    await window.supabaseManager.client.auth.signOut();
    initSupabaseAuth();
});

document.getElementById('btn-supabase-sync-now')?.addEventListener('click', () => {
    triggerCloudSync();
});

document.getElementById('btn-supabase-download')?.addEventListener('click', async () => {
    await downloadCloudSnapshot({ prompt: true, source: 'manual' });
    refreshCloudSyncStats();
});

// Hybrid Auth Switching
document.getElementById('link-to-pwd-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('otp-flow').style.display = 'none';
    document.getElementById('password-flow').style.display = 'flex';
});

document.getElementById('link-to-otp-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('otp-flow').style.display = 'flex';
    document.getElementById('password-flow').style.display = 'none';
});

// Password Login Hook
document.getElementById('btn-supabase-login-pwd')?.addEventListener('click', async () => {
    const email = document.getElementById('supabase-email-pwd')?.value;
    const password = document.getElementById('supabase-password')?.value;
    if (!email || !password) {
        alert("Please enter email and password");
        return;
    }
    try {
        const user = await window.supabaseManager.loginWithEmail(email, password);
        if (user) {
            handleSupabaseSignedIn();
        }
    } catch (e) {
        alert("Login failed: " + e.message);
    }
});

// Run Initial Auth Check
setTimeout(async () => {
    const user = await initSupabaseAuth();
    if (!user) return;

    const localSummary = summarizeSyncData(await chrome.storage.sync.get(null));
    if (!localSummary.hasContent) {
        await checkCloudSnapshotAfterLogin();
    } else {
        await checkCloudSnapshotAfterLogin({ onlyIfRemoteNewer: true, uploadOnCancel: false });
    }
}, 1000);

    // --- Library Groups Logic ---
    async function initFavGroups() {
        const localStatus = await chrome.storage.local.get('device_initialized');
        const isDeviceInitialized = localStatus.device_initialized;

        const data = await chrome.storage.sync.get('favorite_groups');
        if (data.favorite_groups && Array.isArray(data.favorite_groups) && data.favorite_groups.length > 0) {
            favoriteGroupsList = data.favorite_groups;
            if (!isDeviceInitialized) await chrome.storage.local.set({ 'device_initialized': true });
            updateFavGroupUI();
        } else {
            if (!isDeviceInitialized) {
                // Potential fresh installation. Wait for user before overwriting cloud data.
                showConfirmModal(
                    "Data Sync Check / 資料同步檢查",
                    "No cloud data detected. If you have data from another device, Chrome may still be downloading it. \n(未偵測到雲端資料。若您有其他裝置的資料，Chrome 可能尚未完成下載。)\n\nDo you want to Wait & Load from Cloud (以雲端為主載入), or Start Fresh (清除建立全新記錄)?",
                    async () => {
                        // On Confirm -> Start Fresh. Require a second confirmation
                        // because this can upload an empty baseline to Supabase.
                        const confirmedFreshStart = await confirmCloudAction(
                            "Confirm Start Fresh / 確認清除",
                            "Start Fresh will create a new empty local library. If cloud sync is active, this can replace the Supabase cloud snapshot with this empty library.\n\nOnly continue if you intentionally want to clear the cloud copy and start over.\n\n按下確認後會建立新的空白本機資料；若 Cloud Sync 啟用，可能會用空白資料覆蓋 Supabase 雲端備份。",
                            "Clear Cloud & Start Fresh"
                        );
                        if (!confirmedFreshStart) {
                            alert("Cancelled. No local or cloud data was changed.\n\n(已取消，未變更本機或雲端資料。)");
                            return;
                        }

                        await chrome.storage.local.set({ 'device_initialized': true });
                        favoriteGroupsList = ["Default"];
                        await safeSyncSet({ 'favorite_groups': favoriteGroupsList }, 'Initialize library groups');
                        updateFavGroupUI();
                    },
                    () => {
                        // On Cancel -> Wait
                        alert("Please wait a moment for Chrome to download your cloud data.\n\n(請稍候讓 Chrome 完成下載資料。您隨後可以在選單中變更群組即可。)");
                    },
                    "Start Fresh / 清除紀錄"
                );

                // Tweak the Cancel button momentarily to show "Wait / 以雲端為主"
                setTimeout(() => {
                    const cancelBtn = document.getElementById('btn-cancel-confirm');
                    if (cancelBtn) {
                        const origCancelText = cancelBtn.textContent;
                        cancelBtn.textContent = 'Wait / 以雲端為主';
                        const origOnclick = cancelBtn.onclick;
                        cancelBtn.onclick = (e) => {
                            cancelBtn.textContent = origCancelText;
                            if (origOnclick) origOnclick(e);
                        };
                        const confirmBtn = document.getElementById('btn-confirm-action');
                        if (confirmBtn) {
                            const origConfirmClick = confirmBtn.onclick;
                            confirmBtn.onclick = (e) => {
                                cancelBtn.textContent = origCancelText;
                                if (origConfirmClick) origConfirmClick(e);
                            };
                        }
                    }
                }, 50);

                return; // halt and wait
            }

            favoriteGroupsList = ["Default"];
            await safeSyncSet({ 'favorite_groups': favoriteGroupsList }, 'Initialize library groups');
            updateFavGroupUI();
        }
    }

    function updateFavGroupUI() {
        const selector = document.getElementById('fav-group-selector');
        if (!selector) return;

        const currentVal = selector.value || currentFavGroup;
        selector.innerHTML = '';
        const allOpt = document.createElement('option');
        allOpt.value = ALL_VIDEOS_GROUP;
        allOpt.textContent = ALL_VIDEOS_LABEL;
        selector.appendChild(allOpt);

        favoriteGroupsList.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            selector.appendChild(opt);
        });
        if (currentVal === ALL_VIDEOS_GROUP || favoriteGroupsList.includes(currentVal)) {
            selector.value = currentVal;
            currentFavGroup = currentVal;
        } else {
            selector.value = ALL_VIDEOS_GROUP;
            currentFavGroup = ALL_VIDEOS_GROUP;
        }

        renderFavGroupMgmt();
        updateCollectionControls();
    }

    function updateCollectionControls() {
        const activeGroup = document.getElementById('fav-group-selector')?.value || currentFavGroup;
        const playBtn = document.getElementById('btn-play-group');
        if (playBtn) {
            playBtn.textContent = isAllVideosGroup(activeGroup) ? '▶ Play All' : '▶ Play Group';
            playBtn.title = isAllVideosGroup(activeGroup)
                ? 'Sequentially play all saved videos by recent update'
                : 'Sequentially play this group';
        }
    }

    function renderFavGroupMgmt() {
        const container = document.getElementById('fav-groups-list-mgmt');
        if (!container) return;
        container.innerHTML = '';

        favoriteGroupsList.forEach((g, index) => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:4px 6px; background:rgba(255,255,255,0.05); border-radius:4px; margin-bottom:2px;';

            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="text" inputmode="numeric" class="group-index-input" value="${index + 1}" 
                        style="width:28px; background:#000; border:1px solid #444; color:var(--accent-color); font-size:10px; padding:1px 2px; text-align:center; border-radius:3px;">
                    <span style="font-weight:500;">${g}</span>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="rename-group-btn" style="background:none; border:none; color:var(--accent-color); cursor:pointer; font-size:10px; padding:0;">Rename</button>
                    ${g !== 'Default' ? '<button class="delete-group-btn" style="background:none; border:none; color:var(--danger-color); cursor:pointer; font-size:10px; padding:0;">Delete</button>' : ''}
                </div>
            `;

            // Listen for direct index changes
            const indexInput = div.querySelector('.group-index-input');
            indexInput.onchange = (e) => {
                const newPos = parseInt(e.target.value) - 1;
                reorderFavGroup(index, newPos);
            };
            indexInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const newPos = parseInt(e.target.value) - 1;
                    reorderFavGroup(index, newPos);
                    e.target.blur();
                }
            };

            // Prevent general click when typing
            indexInput.onclick = (e) => e.stopPropagation();

            div.querySelector('.rename-group-btn').onclick = (e) => { e.stopPropagation(); renameFavGroup(g); };
            if (g !== 'Default') {
                div.querySelector('.delete-group-btn').onclick = (e) => { e.stopPropagation(); deleteFavGroup(g); };
            }
            container.appendChild(div);
        });
    }

    async function reorderFavGroup(oldIndex, newIndex) {
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= favoriteGroupsList.length) newIndex = favoriteGroupsList.length - 1;
        if (oldIndex === newIndex) return;

        const item = favoriteGroupsList.splice(oldIndex, 1)[0];
        favoriteGroupsList.splice(newIndex, 0, item);

        await safeSyncSet({ 'favorite_groups': favoriteGroupsList }, 'Reorder library groups');
        updateFavGroupUI();
    }

    async function addFavGroup(name) {
        name = name.trim();
        if (name === ALL_VIDEOS_LABEL || name === ALL_VIDEOS_GROUP) return;
        if (!name || favoriteGroupsList.includes(name)) return;
        favoriteGroupsList.push(name);
        await safeSyncSet({ 'favorite_groups': favoriteGroupsList }, 'Add library group');
        updateFavGroupUI();

        // Auto-scroll to bottom of the management list so user sees the new item
        setTimeout(() => {
            const container = document.getElementById('fav-groups-list-mgmt');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 50);
    }

    async function deleteFavGroup(name) {
        if (name === 'Default') return;

        showConfirmModal(
            "Delete Group",
            `Delete favorite group "${name}"? Videos will remain but won't be in this group.`,
            async () => {
                favoriteGroupsList = favoriteGroupsList.filter(g => g !== name);
                await safeSyncSet({ 'favorite_groups': favoriteGroupsList }, 'Delete library group');

                // Update all videos that had this group
                const all = await chrome.storage.sync.get(null);
                const updates = {};
                Object.keys(all).forEach(key => {
                    if (key.startsWith('v_') && all[key].favoriteGroups) {
                        if (all[key].favoriteGroups.includes(name)) {
                            all[key].favoriteGroups = all[key].favoriteGroups.filter(g => g !== name);
                            updates[key] = all[key];
                        }
                    }
                });
                if (Object.keys(updates).length > 0) await safeSyncSet(updates, 'Update library group assignments');

                updateFavGroupUI();
                if (views.favorites.style.display !== 'none') loadFavorites();
            }
        );
    }

    async function renameFavGroup(oldName) {
        const newName = prompt(`Rename group "${oldName}" to:`, oldName);
        if (!newName || newName === oldName || favoriteGroupsList.includes(newName.trim())) return;
        const trimmedNewName = newName.trim();
        if (trimmedNewName === ALL_VIDEOS_LABEL || trimmedNewName === ALL_VIDEOS_GROUP) return;

        // Update list
        favoriteGroupsList = favoriteGroupsList.map(g => g === oldName ? trimmedNewName : g);
        await safeSyncSet({ 'favorite_groups': favoriteGroupsList }, 'Rename library group');

        // Update all videos that had this group
        const all = await chrome.storage.sync.get(null);
        const updates = {};
        Object.keys(all).forEach(key => {
            if (key.startsWith('v_')) {
                let changed = false;
                if (all[key].favoriteGroups && all[key].favoriteGroups.includes(oldName)) {
                    all[key].favoriteGroups = all[key].favoriteGroups.map(g => g === oldName ? trimmedNewName : g);
                    changed = true;
                }
                if (changed) updates[key] = all[key];
            }
        });
        if (Object.keys(updates).length > 0) await safeSyncSet(updates, 'Rename library group assignments');

        updateFavGroupUI();
        if (views.favorites.style.display !== 'none') loadFavorites();
    }

    initFavGroups();

    // --- Edit Mode Logic ---
    const toggleEditMode = () => {
        isLibraryEditMode = !isLibraryEditMode;
        const favList = document.getElementById('favorites-list');
        const buttons = [document.getElementById('btn-fav-toggle-edit')];

        buttons.forEach(btn => {
            if (!btn) return;
            if (isLibraryEditMode) {
                btn.textContent = 'Done';
                btn.style.background = 'var(--success-color)';
                btn.style.color = '#000';
            } else {
                btn.textContent = 'Edit';
                btn.style.background = 'transparent';
                btn.style.color = '#888';
            }
        });

        if (isLibraryEditMode) {
            favList?.classList.add('edit-mode');
        } else {
            favList?.classList.remove('edit-mode');

            // Clear selections when exiting edit mode
            document.querySelectorAll('.item-select-checkbox').forEach(cb => cb.checked = false);
            updateBatchUI();
        }

        // Re-render to show/hide sort buttons and update UI state
        loadFavorites();
    };

    document.getElementById('btn-fav-toggle-edit')?.addEventListener('click', toggleEditMode);

    // --- Elements ---
    const views = {
        player: document.getElementById('view-player'),
        favorites: document.getElementById('view-favorites'),
        settings: document.getElementById('view-settings')
    };
    const navs = {
        player: document.getElementById('nav-player'),
        favorites: document.getElementById('nav-favorites'),
        settings: document.getElementById('nav-settings')
    };

    // Controls
    const playPauseBtn = document.getElementById('play-pause');
    const progressBar = document.getElementById('progress-bar');

    // Icons
    const ICON_PLAY = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

    // Use data-state attribute to avoid innerHTML mutation during click events
    function setPlayPauseIcon(btn, playing) {
        if (!btn) return;
        const current = btn.getAttribute('data-state');
        const next = playing ? 'pause' : 'play';
        if (current === next) return; // No change needed
        btn.setAttribute('data-state', next);
        btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    }
    const ICON_SMALL_PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const ICON_SMALL_PAUSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    const ICON_SMALL_RESTART = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>';
    const ICON_RENEW = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="opacity:0.7;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';

    // Loop Markers
    const markerA = document.getElementById('marker-a');
    const markerB = document.getElementById('marker-b');
    let currentLoopStart = null;
    let currentLoopEnd = null;
    let currentLoopEnabled = false;
    let isCurrentlyPlaying = false;

    // --- Real-time State Synchronization (Solution A: Hybrid Architecture) ---
    // Listen to session storage changes for INSTANT UI updates (<5ms latency)
    chrome.storage.session.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'session' || !connectedTabId) return;

        const stateKey = `videoPlaying_${connectedTabId}`;
        if (changes[stateKey]) {
            const newPlayingState = changes[stateKey].newValue;
            console.log(`[YT Study Sidebar] Instant state update (${stateKey}):`, newPlayingState ? 'PLAYING' : 'PAUSED');

            // Update UI immediately - this bypasses message passing delay!
            isCurrentlyPlaying = newPlayingState;
            if (playPauseBtn) {
                setPlayPauseIcon(playPauseBtn, isCurrentlyPlaying);
            }
            refreshActiveLibraryMarkers();
            syncMarkersUI();
        }
    });

    // Initialize state from session storage on load
    function refreshInitialState() {
        if (!connectedTabId) {
            console.log('[YT Study Sidebar] refreshInitialState skipped: No connectedTabId');
            return;
        }
        const stateKey = `videoPlaying_${connectedTabId}`;
        chrome.storage.session.get([stateKey], (result) => {
            if (result[stateKey] !== undefined) {
                isCurrentlyPlaying = result[stateKey];
                if (playPauseBtn) {
                    setPlayPauseIcon(playPauseBtn, isCurrentlyPlaying);
                }
                refreshActiveLibraryMarkers();
                console.log(`[YT Study Sidebar] State synchronized from storage (${stateKey}):`, isCurrentlyPlaying ? 'PLAYING' : 'PAUSED');
            }
        });
    }

    // --- Navigation ---
    function switchView(viewName) {
        const requestedView = viewName;
        if (viewName === 'library') {
            viewName = 'favorites';
            currentFavGroup = ALL_VIDEOS_GROUP;
            const selector = document.getElementById('fav-group-selector');
            if (selector) selector.value = ALL_VIDEOS_GROUP;
        }

        Object.keys(views).forEach(k => {
            if (views[k]) views[k].style.display = (k === viewName) ? 'flex' : 'none';
        });
        Object.keys(navs).forEach(k => {
            if (navs[k]) navs[k].classList.toggle('active', k === viewName || (requestedView === 'library' && k === 'favorites'));
        });

        if (viewName === 'favorites') {
            // Intelligent Jump: auto-select the group of the currently playing video
            try {
                const selector = document.getElementById('fav-group-selector');
                if (requestedView !== 'library' && selector && currentVideoData && currentVideoData.isSaved) {
                    const videoGroups = [...(currentVideoData.favoriteGroups || [])];
                    if (currentVideoData.isDefault && !videoGroups.includes("Default")) videoGroups.push("Default");
                    const validGroups = videoGroups.filter(g => g && favoriteGroupsList.includes(g));
                    if (validGroups.length > 0 && !validGroups.includes(selector.value)) {
                        selector.value = validGroups[0];
                        currentFavGroup = validGroups[0];
                    }
                }
            } catch (e) {
                console.warn('[YT Study] Intelligent jump skipped:', e);
            }
            loadFavorites();
        }
    }

    if (navs.player) navs.player.addEventListener('click', () => switchView('player'));
    if (navs.favorites) navs.favorites.addEventListener('click', () => switchView('library'));
    if (navs.settings) navs.settings.addEventListener('click', () => switchView('settings'));

    // Show Player view by default on startup
    switchView('player');

    // --- Player Sub-Panels ---
    const subPanels = {
        markers: document.getElementById('panel-markers'),
        connection: document.getElementById('panel-connection'),
        playlist: document.getElementById('panel-playlist')
    };
    const subTabs = {
        markers: document.getElementById('tab-markers'),
        connection: document.getElementById('tab-connection'),
        playlist: document.getElementById('tab-playlist')
    };

    function switchSubPanel(panelName) {
        Object.keys(subPanels).forEach(k => {
            if (subPanels[k]) {
                subPanels[k].classList.toggle('active', k === panelName);
            }
        });
        Object.keys(subTabs).forEach(k => {
            if (subTabs[k]) {
                subTabs[k].classList.toggle('active', k === panelName);
            }
        });
    }

    if (subTabs.markers) subTabs.markers.addEventListener('click', () => switchSubPanel('markers'));
    if (subTabs.connection) subTabs.connection.addEventListener('click', () => switchSubPanel('connection'));
    if (subTabs.playlist) subTabs.playlist.addEventListener('click', () => switchSubPanel('playlist'));

    // --- Pop Out Logic (Solution: Separate Sidebar and Popup behaviors) ---
    const popOutBtn = document.getElementById('nav-popout');
    if (popOutBtn) {
        // Synchronous check: Popup windows are opened with ?tabId=
        const isPopupWindow = window.location.search.includes('tabId=');

        if (isPopupWindow) {
            console.log('[YT Study] Instance: POPUP WINDOW');

            // 1. Setup Popup UI (Return to Sidebar Button)
            popOutBtn.title = "Return to Sidebar";
            popOutBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
            popOutBtn.style.color = ''; // Reset color
            popOutBtn.style.transform = 'scaleX(-1)'; // Flip to indicate return

            // 2. Setup Popup specific click listener (Open Sidebar and Close)
            popOutBtn.addEventListener('click', async () => {
                console.log('[YT Study] ===== Return to Sidebar clicked =====');

                try {
                    // Get tabId from URL
                    const urlParams = new URLSearchParams(window.location.search);
                    const tabIdStr = urlParams.get('tabId');

                    if (tabIdStr) {
                        const tabId = parseInt(tabIdStr, 10);
                        // Open the side panel for this tab
                        await chrome.sidePanel.open({ tabId });
                        console.log('[YT Study] Requested side panel open for tab:', tabId);
                    }

                    // Close this popup
                    const currentWindow = await chrome.windows.getCurrent();
                    await chrome.windows.remove(currentWindow.id);
                } catch (err) {
                    console.error('[YT Study] Error during return to sidebar:', err);
                    window.close(); // Fallback
                }
            });

        } else {
            console.log('[YT Study] Instance: SIDEBAR');

            // Sidebar-only logic
            let activePopupId = null;

            const updateBtnState = () => {
                if (activePopupId) {
                    popOutBtn.style.color = '#ff4e45'; // Red for Close
                    popOutBtn.title = "Close Pop Out";
                    popOutBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
                } else {
                    popOutBtn.style.color = '';
                    popOutBtn.title = "Pop Out Window";
                    popOutBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
                }
            };

            popOutBtn.addEventListener('click', async () => {
                // If we have an active popup, close it instead of opening more
                if (activePopupId) {
                    try { await chrome.windows.remove(activePopupId); } catch (e) { }
                    activePopupId = null;
                    updateBtnState();
                    return;
                }

                // Normal Pop-out sequence
                let targetId = connectedTabId;
                if (!targetId) {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab) targetId = tab.id;
                }

                const url = targetId ? `sidebar.html?tabId=${targetId}` : 'sidebar.html';

                chrome.windows.create({
                    url: url,
                    type: 'popup',
                    width: 400,
                    height: 700,
                    focused: true
                }, (win) => {
                    activePopupId = win.id;
                    // Skip updateBtnState() here to prevent icon flickering 
                    // since the sidebar is about to close anyway.

                    // Sidebar instance closes itself after handing off to popup
                    console.log('[YT Study] Handing off to popup, closing sidebar');
                    setTimeout(() => { window.close(); }, 100);

                    // Safety listener if window.close() fails or for cleanup
                    const onRemoved = (winId) => {
                        if (winId === activePopupId) {
                            activePopupId = null;
                            updateBtnState();
                            chrome.windows.onRemoved.removeListener(onRemoved);
                        }
                    };
                    chrome.windows.onRemoved.addListener(onRemoved);
                });
            });
        }
    }

    // --- Communication ---
    const statusIndicator = document.getElementById('connection-status');

    // Check URL for passed tabId
    const urlParams = new URLSearchParams(window.location.search);
    const passedTabId = urlParams.get('tabId');
    if (passedTabId) {
        connectedTabId = parseInt(passedTabId, 10);
        console.log("Locked to Tab ID:", connectedTabId);
    }

    let lastTabValidationTime = 0;

    /**
     * Fire-and-forget message for latency-sensitive actions (e.g. play/pause).
     * Skips tab validation entirely and falls back to full sendMessage on error.
     */
    async function sendMessageFast(action, payload = {}) {
        if (!connectedTabId) return sendMessage(action, payload);
        try {
            const response = await chrome.tabs.sendMessage(connectedTabId, { action, ...payload });
            if (response && response.success) return response;
            throw new Error(response ? response.error : 'No response');
        } catch (e) {
            return sendMessage(action, payload);
        }
    }

    async function sendMessage(action, payload = {}, retryCount = 0) {
        // Command logging removed to avoid ReferenceError
        try {
            let targetTabId = null;

            // Fast path: Use cached ID if validated recently (< 5s)
            if (connectedTabId && (Date.now() - lastTabValidationTime < 5000)) {
                targetTabId = connectedTabId;
            }
            else if (connectedTabId) {
                try {
                    const tab = await chrome.tabs.get(connectedTabId);
                    const isYT = tab && isYouTubeVideoUrl(tab.url);
                    if (isYT) {
                        targetTabId = connectedTabId;
                        lastTabValidationTime = Date.now();
                    } else {
                        connectedTabId = null;
                    }
                } catch (e) {
                    connectedTabId = null;
                }
            }

            // Fallback: Query for target tab
            if (!targetTabId) {
                const queryOptions = { url: YOUTUBE_VIDEO_QUERY_URLS };
                const tabs = await chrome.tabs.query(queryOptions);
                if (tabs.length > 0) {
                    const currentWindow = await chrome.windows.getCurrent();
                    const activeTab = tabs.find(t => t.active && t.windowId === currentWindow.id);
                    const anyActiveTab = tabs.find(t => t.active);
                    targetTabId = (activeTab || anyActiveTab || tabs[0]).id;
                    lastTabValidationTime = Date.now();
                }
            }

            if (!targetTabId) {
                statusIndicator.classList.remove('connected');
                statusIndicator.title = "Disconnected (No YouTube Page)";
                return { success: false, error: 'No target tab' };
            }

            connectedTabId = targetTabId;
            statusIndicator.classList.add('connected');
            statusIndicator.title = `Connected to Tab: ${targetTabId}`;

            // Send message
            const response = await chrome.tabs.sendMessage(targetTabId, { action, ...payload });

            if (response && response.success) {
                return response;
            } else {
                throw new Error(response ? response.error : 'No response');
            }

        } catch (error) {
            if (retryCount < 2) {
                const delay = 30 * (retryCount + 1);
                await new Promise(r => setTimeout(r, delay));
                return sendMessage(action, payload, retryCount + 1);
            }
            statusIndicator.classList.remove('connected');
            connectedTabId = null;
            throw error;
        }
    }

    // --- Logic ---
    function updatePlayPauseIcon(playing) {
        // Command Guard: Ignore status updates for 100ms after user action to prevent flickering
        if (Date.now() - lastCommandSentTime < 100) return;

        isCurrentlyPlaying = playing;
        if (playPauseBtn) {
            setPlayPauseIcon(playPauseBtn, isCurrentlyPlaying);
        }
        refreshActiveLibraryMarkers();
        syncMarkersUI();
    }

    // Debounce mechanism for Play/Pause button
    let playPauseDebounceTimer = null;
    let isProcessingPlayPause = false;

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', async () => {
            // Prevent rapid clicks
            if (isProcessingPlayPause) return;

            // Clear any pending debounce
            if (playPauseDebounceTimer) {
                clearTimeout(playPauseDebounceTimer);
            }

            isProcessingPlayPause = true;
            lastCommandSentTime = Date.now();

            const originalState = isCurrentlyPlaying;
            const nextPlayingState = !isCurrentlyPlaying;
            const action = 'TOGGLE_PLAY_PAUSE';

            // Visual feedback: brief flash
            playPauseBtn.style.opacity = '0.7';
            setTimeout(() => { if (playPauseBtn) playPauseBtn.style.opacity = '1'; }, 50);

            // Optimistic update for immediate feedback
            isCurrentlyPlaying = nextPlayingState;
            setPlayPauseIcon(playPauseBtn, isCurrentlyPlaying);
            syncMarkersUI(true);

            try {
                // Await so lock is held until message completes, preventing double-toggle
                await sendMessageFast(action);
            } catch (err) {
                console.error('[YT Study] Toggle failed:', err);
                isCurrentlyPlaying = originalState;
                setPlayPauseIcon(playPauseBtn, isCurrentlyPlaying);
                syncMarkersUI(true);
            } finally {
                // Small cooldown to prevent accidental double-tap
                playPauseDebounceTimer = setTimeout(() => {
                    isProcessingPlayPause = false;
                }, 100);
            }
        });
    }

    // Transport
    document.getElementById('restart-btn')?.addEventListener('click', () => sendMessage('SEEK_TO', { time: 0 }));
    document.getElementById('rwd-btn')?.addEventListener('click', () => sendMessage('SEEK_BY', { offset: -10 }));
    document.getElementById('fwd-btn')?.addEventListener('click', () => sendMessage('SEEK_BY', { offset: 10 }));

    // Speed
    const speedSlider = document.getElementById('speed-slider');
    const mainSpeedDisplayBadge = document.getElementById('main-speed-badge');

    speedSlider?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value).toFixed(2) + 'x';
        if (mainSpeedDisplayBadge) mainSpeedDisplayBadge.textContent = val;
        sendMessage('SET_SPEED', { speed: parseFloat(e.target.value) });
    });
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.speed;
            const formattedVal = parseFloat(val).toFixed(2) + 'x';
            if (speedSlider) speedSlider.value = val;
            if (mainSpeedDisplayBadge) mainSpeedDisplayBadge.textContent = formattedVal;
            sendMessage('SET_SPEED', { speed: parseFloat(val) });
        });
    });

    const speedDownBtn = document.getElementById('speed-down');
    const speedUpBtn = document.getElementById('speed-up');

    if (speedDownBtn) {
        speedDownBtn.addEventListener('click', () => {
            const currentSpeed = parseFloat(speedSlider.value);
            const newSpeed = Math.max(0.25, currentSpeed - 0.05);
            const formattedVal = newSpeed.toFixed(2) + 'x';
            if (speedSlider) speedSlider.value = newSpeed.toFixed(2);
            if (mainSpeedDisplayBadge) mainSpeedDisplayBadge.textContent = formattedVal;
            sendMessage('SET_SPEED', { speed: newSpeed });
        });
    }

    if (speedUpBtn) {
        speedUpBtn.addEventListener('click', () => {
            const currentSpeed = parseFloat(speedSlider.value);
            const newSpeed = Math.min(3.0, currentSpeed + 0.05);
            const formattedVal = newSpeed.toFixed(2) + 'x';
            if (speedSlider) speedSlider.value = newSpeed.toFixed(2);
            if (mainSpeedDisplayBadge) mainSpeedDisplayBadge.textContent = formattedVal;
            sendMessage('SET_SPEED', { speed: newSpeed });
        });
    }

    // --- Accordions (Collapsible Sections) ---
    const speedContent = document.getElementById('speed-content');
    const mainSpeedBadge = document.getElementById('main-speed-badge');

    if (mainSpeedBadge && speedContent) {
        mainSpeedBadge.addEventListener('click', () => {
            const isExpanding = speedContent.classList.contains('collapsed');
            setSpeedAccordionState(isExpanding);
        });
    }

    function setSpeedAccordionState(expand) {
        if (speedContent) {
            if (expand) {
                speedContent.classList.remove('collapsed');
                if (mainSpeedBadge) mainSpeedBadge.style.background = 'rgba(62, 166, 255, 0.3)';
            } else {
                speedContent.classList.add('collapsed');
                if (mainSpeedBadge) mainSpeedBadge.style.background = 'rgba(255, 255, 255, 0.1)';
            }
        }
    }

    const loopHeader = document.getElementById('loop-header');
    const loopContent = document.getElementById('loop-content');
    const loopChevron = document.getElementById('loop-chevron');

    if (loopHeader && loopContent) {
        loopHeader.addEventListener('click', (e) => {
            if (e.target.closest('.toggle-switch')) return;
            const isExpanding = loopContent.classList.contains('collapsed');
            setLoopAccordionState(isExpanding);
        });
    }

    function setLoopAccordionState(expand) {
        if (loopContent && loopChevron) {
            if (expand) {
                loopContent.classList.remove('collapsed');
                loopChevron.style.transform = 'rotate(90deg)';
            } else {
                loopContent.classList.add('collapsed');
                loopChevron.style.transform = 'rotate(0deg)';
            }
        }
    }

    // Progress
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');

    progressBar.addEventListener('mousedown', () => isDraggingProgress = true);
    progressBar.addEventListener('mouseup', () => isDraggingProgress = false);
    progressBar.addEventListener('input', (e) => {
        const t = parseFloat(e.target.value);
        if (timeCurrent) timeCurrent.textContent = formatTime(t);
        updateAddMarkerBtn(t);
    });
    progressBar.addEventListener('change', (e) => {
        sendMessage('SEEK_TO', { time: parseFloat(e.target.value) });
        isDraggingProgress = false;
    });

    function updateUIWithTime(currentTime) {
        if (!isDraggingProgress) {
            if (progressBar) progressBar.value = currentTime;
            if (timeCurrent) timeCurrent.textContent = formatTime(currentTime);
        }
        updateAddMarkerBtn(currentTime);
    }

    function updateTotalTime(duration) {
        if (progressBar) progressBar.max = duration;
        if (timeTotal) timeTotal.textContent = formatTime(duration);
        lastKnownDuration = duration;
        if (currentVideoData) currentVideoData.duration = duration;
    }

    // Loop & Manual Input
    const loopToggleBtn = document.getElementById('loop-toggle-btn');
    const loopStart = document.getElementById('loop-start');
    const loopEnd = document.getElementById('loop-end');

    function updateLoopVisuals() {
        if (!progressBar.max || parseFloat(progressBar.max) <= 0) return;
        const total = parseFloat(progressBar.max);

        if (markerA) {
            const posA = (currentLoopStart !== null) ? (currentLoopStart / total) * 100 : 0;
            markerA.style.left = `${posA}%`;
            markerA.classList.toggle('visible', currentLoopStart !== null);
        }
        if (markerB) {
            const posB = (currentLoopEnd !== null) ? (currentLoopEnd / total) * 100 : 0;
            markerB.style.left = `${posB}%`;
            markerB.classList.toggle('visible', currentLoopEnd !== null);
        }
        if (loopToggleBtn) {
            loopToggleBtn.classList.toggle('active', currentLoopEnabled);
        }
    }

    // document.getElementById('set-start')?.addEventListener('click', () => { sendMessage('SET_LOOP_START'); });
    // document.getElementById('set-end')?.addEventListener('click', () => { sendMessage('SET_LOOP_END'); });

    loopStart?.addEventListener('change', () => {
        const t = parseTime(loopStart.value);
        if (t !== null) {
            currentLoopStart = t;
            sendMessage('SET_LOOP_START', { time: t });
            updateLoopVisuals();
        }
    });
    loopEnd?.addEventListener('change', () => {
        const t = parseTime(loopEnd.value);
        if (t !== null) {
            currentLoopEnd = t;
            sendMessage('SET_LOOP_END', { time: t });
            updateLoopVisuals();
        }
    });

    // A-B Interactivity
    markerA?.addEventListener('click', () => {
        if (currentLoopStart !== null) sendMessage('SEEK_TO', { time: currentLoopStart });
    });
    markerB?.addEventListener('click', () => {
        if (currentLoopEnd !== null) sendMessage('SEEK_TO', { time: currentLoopEnd });
    });

    document.getElementById('label-set-a')?.addEventListener('click', () => {
        const t = lastKnownCurrentTime;
        // B > A enforcement: if setting A at/after B, clear B
        if (currentLoopEnd !== null && t >= currentLoopEnd) {
            currentLoopEnd = null;
            if (loopEnd) loopEnd.value = "0:00";
            sendMessage('SET_LOOP_END', { time: null });
        }
        currentLoopStart = t;
        if (loopStart) loopStart.value = formatTime(t);
        sendMessage('SET_LOOP_START', { time: t });
        updateLoopVisuals();
    });

    document.getElementById('label-set-b')?.addEventListener('click', () => {
        const t = lastKnownCurrentTime;
        // B > A enforcement: if setting B at/before A, clear A
        if (currentLoopStart !== null && t <= currentLoopStart) {
            currentLoopStart = null;
            if (loopStart) loopStart.value = "0:00";
            sendMessage('SET_LOOP_START', { time: null });
        }
        currentLoopEnd = t;
        if (loopEnd) loopEnd.value = formatTime(t);
        sendMessage('SET_LOOP_END', { time: t });
        updateLoopVisuals();
    });

    document.getElementById('clear-loop')?.addEventListener('click', () => {
        if (loopStart) loopStart.value = '0:00';
        if (loopEnd) loopEnd.value = '0:00';
        currentLoopStart = null;
        currentLoopEnd = null;
        sendMessage('CLEAR_LOOP');
        updateLoopVisuals();
    });

    document.getElementById('jump-loop')?.addEventListener('click', () => sendMessage('JUMP_LOOP_START'));

    loopToggleBtn?.addEventListener('click', () => {
        currentLoopEnabled = !currentLoopEnabled;
        sendMessage('TOGGLE_LOOP', { enabled: currentLoopEnabled });
        updateLoopVisuals();
    });

    // --- Marker Follow Persistence ---
    const followToggle = document.getElementById('follow-playback-toggle');
    if (followToggle) {
        // Load preference
        chrome.storage.sync.get('followMarkers', (res) => {
            if (res.hasOwnProperty('followMarkers')) {
                followToggle.checked = res.followMarkers;
            }
        });

        // Save preference
        followToggle.addEventListener('change', (e) => {
            safeSyncSet({ followMarkers: e.target.checked }, 'Save follow setting').catch(() => {
                e.target.checked = !e.target.checked;
            });
        });
    }


    // Bookmarks UI
    const groupSelector = document.getElementById('group-selector');
    const fileImport = document.getElementById('file-import');

    groupSelector?.addEventListener('change', (e) => {
        currentVideoData.activeGroup = e.target.value;
        saveData();
        renderBookmarks();
        updateAddMarkerBtn(); // Update label on group change
    });

    // --- Dynamic Marker Button ---
    const addMarkerBtn = document.getElementById('add-bookmark');
    let lastFormattedTime = "";

    function updateAddMarkerBtn(currentTime = null) {
        if (!addMarkerBtn) return;

        // 1. Get Group Name
        const groupName = groupSelector ? groupSelector.value : "Default";

        // 2. Get Time (if not passed, try to use last known or 0)
        // We need a stable source of 'current display time' if not provided
        let timeStr = "0:00";
        if (currentTime !== null) {
            timeStr = formatTime(currentTime);
            lastFormattedTime = timeStr;
        } else if (lastFormattedTime) {
            timeStr = lastFormattedTime;
        } else {
            // Fallback: try reading from DOM if needed, or just keep default
            const tVal = document.getElementById('time-current')?.textContent;
            if (tVal) timeStr = tVal;
        }

        // 3. Format Label: Add "Now(12:34)" to "Study" (A)
        addMarkerBtn.textContent = `+ Add Now(${timeStr}) to "${groupName}" (A)`;
    }

    async function canAddMarkerToGroup(groupName) {
        if (!isPro()) {
            if (!currentVideoData.tagGroups) currentVideoData.tagGroups = {};
            const currentMarkers = currentVideoData.tagGroups[groupName] || [];
            if (currentMarkers.length >= FREE_MARKER_GROUP_LIMIT) {
                if (confirm(`You have reached the limit of ${FREE_MARKER_GROUP_LIMIT} markers for this group in the Free version. Upgrade to PRO for unlimited markers!`)) {
                    upgradeToPro();
                }
                return false;
            }
        }
        return true;
    }

    document.getElementById('add-bookmark')?.addEventListener('click', async () => {
        const groupName = groupSelector ? groupSelector.value : "Default";
        if (!await canAddMarkerToGroup(groupName)) return;
        sendMessage('ADD_BOOKMARK_REQUEST');
    });
    // btn-export/import removed in Pro-Mode

    const libFileImport = document.getElementById('lib-file-import');
    document.getElementById('lib-btn-import')?.addEventListener('click', () => libFileImport?.click());
    libFileImport?.addEventListener('change', importVideoData);

    // --- Library Groups Listeners ---
    document.getElementById('btn-manage-fav-groups')?.addEventListener('click', () => {
        const mgmt = document.getElementById('fav-group-mgmt');
        if (mgmt) mgmt.style.display = (mgmt.style.display === 'none' ? 'block' : 'none');
    });

    document.getElementById('btn-close-fav-mgmt')?.addEventListener('click', () => {
        const mgmt = document.getElementById('fav-group-mgmt');
        if (mgmt) mgmt.style.display = 'none';
    });

    document.getElementById('btn-add-fav-group')?.addEventListener('click', () => {
        const input = document.getElementById('new-fav-group-name');
        if (input && input.value.trim()) {
            addFavGroup(input.value.trim());
            input.value = '';
        }
    });

    document.getElementById('fav-group-selector')?.addEventListener('change', () => {
        currentFavGroup = document.getElementById('fav-group-selector').value;
        updateCollectionControls();
        loadFavorites();
    });

    document.getElementById('btn-play-group')?.addEventListener('click', () => {
        togglePlaylist();
    });

    document.getElementById('prev-video-btn')?.addEventListener('click', () => {
        playPrevVideo();
    });

    document.getElementById('next-video-btn')?.addEventListener('click', () => {
        playNextVideo();
    });

    document.getElementById('btn-stop-playlist')?.addEventListener('click', () => {
        togglePlaylist();
    });

    document.getElementById('btn-manual-detect-playlist')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-manual-detect-playlist');
        const origText = btn.textContent;
        btn.textContent = 'Searching...';
        btn.disabled = true;

        try {
            // Force refresh connectedTabId to currently active tab for detection
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) connectedTabId = tabs[0].id;

            const response = await sendMessage('SCRAPE_PLAYLIST');
            if (response && response.success && response.data) {
                const playlist = response.data;
                showPlaylistImportModal(playlist, async () => {
                    btn.textContent = 'Importing...';
                    await importPlaylistToGroup(playlist);
                    btn.textContent = 'Import Done!';
                    setTimeout(() => { btn.textContent = origText; }, 2000);
                }, () => {
                    btn.textContent = origText;
                });
            } else {
                alert('No YouTube Playlist found on this page. Please make sure you are on a playlist page or a video with a playlist.');
                btn.textContent = origText;
            }
        } catch (e) {
            console.error(e);
            btn.textContent = origText;
        } finally {
            btn.disabled = false;
        }
    });

    /**
     * Shows a custom modal for playlist import confirmation
     */
    function showPlaylistImportModal(playlist, onConfirm, onCancel) {
        const modal = document.getElementById('playlist-import-modal');
        const nameEl = document.getElementById('playlist-modal-name');
        const countEl = document.getElementById('playlist-modal-count');
        const closeBtn = document.getElementById('btn-close-playlist-modal');
        const cancelBtn = document.getElementById('btn-cancel-playlist-import');
        const confirmBtn = document.getElementById('btn-confirm-playlist-import');

        if (!modal || !nameEl || !countEl) return;

        nameEl.textContent = playlist.title;
        countEl.textContent = `${playlist.videoCount} videos detected`;

        const closeModal = () => {
            modal.style.display = 'none';
        };

        confirmBtn.onclick = () => {
            closeModal();
            if (onConfirm) onConfirm();
        };

        closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        modal.style.display = 'flex';
    }

    /**
     * Shows a generic confirmation modal
     */
    function showConfirmModal(title, message, onConfirm, onCancel, confirmText = 'Delete') {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-modal-title');
        const msgEl = document.getElementById('confirm-modal-message');
        const closeBtn = document.getElementById('btn-close-confirm-modal');
        const cancelBtn = document.getElementById('btn-cancel-confirm');
        const confirmBtn = document.getElementById('btn-confirm-action');

        if (!modal || !titleEl || !msgEl) return;

        titleEl.textContent = title;
        msgEl.textContent = message;
        confirmBtn.textContent = confirmText;

        const closeModal = () => {
            modal.style.display = 'none';
        };

        confirmBtn.onclick = () => {
            closeModal();
            if (onConfirm) onConfirm();
        };

        cancelBtn.onclick = () => {
            closeModal();
            if (onCancel) onCancel();
        };

        closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        modal.style.display = 'flex';
    }

    async function importPlaylistToGroup(playlist) {
        // 1. Create/Find Group
        let groupName = playlist.title;
        if (!favoriteGroupsList.includes(groupName)) {
            favoriteGroupsList.push(groupName);
            await safeSyncSet({ 'favorite_groups': favoriteGroupsList }, 'Import playlist group');
        }
        updateFavGroupUI();

        // 2. Import Videos
        const all = await chrome.storage.sync.get(null);
        const updates = {};
        const newOrder = [];

        for (const v of playlist.videos) {
            const videoKey = `v_${v.id}_${Date.now()}`;
            const source = v.source || playlist.source || 'youtube';
            // Check if already exists (simplistic check by ID)
            let existingKey = Object.keys(all).find(k => isStorageKeyForVideo(k, v.id) && all[k].isSaved);

            if (existingKey) {
                const existing = all[existingKey];
                if (!existing.source) existing.source = source;
                if (!existing.favoriteGroups) existing.favoriteGroups = [];
                if (!existing.favoriteGroups.includes(groupName)) {
                    existing.favoriteGroups.push(groupName);
                }
                updates[existingKey] = existing;
                newOrder.push(existingKey);
            } else {
                const newData = createEmptyData(v.id, v.title);
                newData.thumbnail = v.thumbnail;
                newData.source = source;
                newData.isSaved = true;
                newData.favoriteGroups = [groupName];
                newData.createdAt = Date.now();
                newData.updatedAt = Date.now();
                updates[videoKey] = newData;
                newOrder.push(videoKey);
                // Also update local 'all' to avoid duplicates in same import
                all[videoKey] = newData;
            }
        }

        // 3. Save Order
        favoriteGroupOrders[groupName] = newOrder;
        updates['favorite_group_orders'] = favoriteGroupOrders;

        await safeSyncSet(updates, 'Import playlist videos');

        // Switch to the new group
        const selector = document.getElementById('fav-group-selector');
        if (selector) {
            selector.value = groupName;
            currentFavGroup = groupName;
            switchView('favorites');
            loadFavorites();
        }

        log(`Imported ${playlist.videoCount} videos to "${groupName}"`, "success");
    }

    async function showFavGroupPicker(videoKey) {
        const modal = document.getElementById('fav-group-picker-modal');
        const body = document.getElementById('fav-picker-body');
        if (!modal || !body) return;

        const all = await chrome.storage.sync.get(videoKey);
        const video = all[videoKey];
        if (!video) return;

        const currentGroups = video.favoriteGroups || [];
        if (video.isDefault && !currentGroups.includes("Default")) currentGroups.push("Default");

        // Clear and Populate
        body.innerHTML = '';
        favoriteGroupsList.forEach(groupName => {
            const item = document.createElement('label');
            item.className = 'fav-group-item';
            const checked = currentGroups.includes(groupName) ? 'checked' : '';
            item.innerHTML = `
                <input type="checkbox" value="${groupName}" ${checked}>
                <span>${groupName}</span>
            `;
            body.appendChild(item);
        });

        // Show Modal
        modal.style.display = 'flex';

        // Setup Buttons (One-time or re-bind)
        const closeBtn = document.getElementById('close-fav-picker');
        const saveBtn = document.getElementById('save-fav-picker');

        const closeModal = () => modal.style.display = 'none';

        closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        saveBtn.onclick = async () => {
            const checkedInputs = body.querySelectorAll('input:checked');
            const newGroups = Array.from(checkedInputs).map(input => input.value);

            video.favoriteGroups = newGroups;
            // Also update isDefault for backward compatibility if "Default" is selected
            video.isDefault = newGroups.includes("Default");

            await safeSyncSet({ [videoKey]: video }, 'Save library group assignment');

            // If this is the current video, sync its state
            if (videoKey === currentStorageKey) {
                currentVideoData.favoriteGroups = newGroups;
                currentVideoData.isDefault = video.isDefault;
                updateHeader();
            }

            loadLibrary();
            closeModal();
        };
    }

    // --- Batch Actions Logic ---
    function updateBatchUI() {
        const batchBar = document.getElementById('fav-batch-actions');
        const countSpan = document.getElementById('fav-selection-count');
        const selectAll = document.getElementById('fav-select-all');

        const checkboxes = document.querySelectorAll('.item-select-checkbox:checked');
        const allCheckboxes = document.querySelectorAll('.item-select-checkbox');

        if (!batchBar || !countSpan) return;

        const count = checkboxes.length;
        if (count > 0 && isLibraryEditMode) {
            batchBar.style.display = 'flex';
            countSpan.textContent = `${count} selected`;
        } else {
            batchBar.style.display = 'none';
        }

        if (selectAll && allCheckboxes.length > 0) {
            selectAll.checked = (count === allCheckboxes.length);
        }
    }

    document.getElementById('fav-select-all')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.item-select-checkbox').forEach(cb => cb.checked = checked);
        updateBatchUI();
    });

    document.getElementById('btn-fav-batch-add-fav')?.addEventListener('click', () => {
        const selectedKeys = Array.from(document.querySelectorAll('.item-select-checkbox:checked')).map(cb => cb.dataset.key);
        if (selectedKeys.length > 0) showBatchFavGroupPicker(selectedKeys);
    });

    const handleBatchDelete = async () => {
        const selectedKeys = Array.from(document.querySelectorAll('.item-select-checkbox:checked')).map(cb => cb.dataset.key);
        if (selectedKeys.length === 0) return;

        showConfirmModal(
            "Batch Delete",
            `Delete ${selectedKeys.length} selected videos and all their markers? This cannot be undone.`,
            async () => {
                await chrome.storage.sync.remove(selectedKeys);
                if (selectedKeys.includes(currentStorageKey)) {
                    resetInternalState();
                    showStandby('HOME');
                }
                log(`Deleted ${selectedKeys.length} items`, "success");
                loadLibrary();
                updateBatchUI();
            }
        );
    };

    document.getElementById('btn-fav-batch-delete')?.addEventListener('click', handleBatchDelete);

    async function showBatchFavGroupPicker(videoKeys) {
        const modal = document.getElementById('fav-group-picker-modal');
        const body = document.getElementById('fav-picker-body');
        const title = modal?.querySelector('.modal-title');
        if (!modal || !body) return;

        if (title) title.textContent = `Set Groups for ${videoKeys.length} items`;

        // Clear and Populate (Start with all unchecked for batch)
        body.innerHTML = '';
        favoriteGroupsList.forEach(groupName => {
            const item = document.createElement('label');
            item.className = 'fav-group-item';
            item.innerHTML = `
                <input type="checkbox" value="${groupName}">
                <span>${groupName}</span>
            `;
            body.appendChild(item);
        });

        // Show Modal
        modal.style.display = 'flex';

        const closeBtn = document.getElementById('close-fav-picker');
        const saveBtn = document.getElementById('save-fav-picker');
        const closeModal = () => {
            modal.style.display = 'none';
        if (title) title.textContent = 'Set Library Groups'; // Reset title
        };

        closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        saveBtn.onclick = async () => {
            const checkedInputs = body.querySelectorAll('input:checked');
            const newGroups = Array.from(checkedInputs).map(input => input.value);
            const isSetDefault = newGroups.includes("Default");

            const allData = await chrome.storage.sync.get(videoKeys);
            const updates = {};

            videoKeys.forEach(key => {
                const video = allData[key];
                if (video) {
                    video.favoriteGroups = newGroups;
                    video.isDefault = isSetDefault;
                    updates[key] = video;

                    // Sync current video state if it's in the batch
                    if (key === currentStorageKey) {
                        currentVideoData.favoriteGroups = newGroups;
                        currentVideoData.isDefault = isSetDefault;
                        updateHeader();
                    }
                }
            });

            await safeSyncSet(updates, 'Save batch library group assignments');

            loadLibrary();
            closeModal();
            updateBatchUI();
            // Deselect all after batch operation
            document.querySelectorAll('.item-select-checkbox').forEach(cb => cb.checked = false);
            updateBatchUI();
        };
    }

    // --- Re-Detect Video Button (Force Sync) ---
    document.getElementById('btn-detect-video')?.addEventListener('click', async () => {
        // Visual Feedback
        const btn = document.getElementById('btn-detect-video');
        const origColor = btn.style.color;
        btn.style.color = 'var(--accent-color)';
        setTimeout(() => btn.style.color = origColor, 500);

        // Force Hard Re-connection to Active Tab
        console.log("[YT Study] Re-Detect Video triggered: Forcing re-connection...");
        currentVideoId = null; // This ensures the incoming metadata triggers 'isNewVideo' logic
        establishConnection(true);
    });

    // --- Clone Button & Toggle Logic ---
    const btnCloneSession = document.getElementById('btn-clone-session');
    const toggleCloneSession = document.getElementById('toggle-clone-session');

    // Init from storage
    chrome.storage.local.get(['enableCloneSession'], (res) => {
        isCloneEnabled = res.enableCloneSession || false;
        if (toggleCloneSession) toggleCloneSession.checked = isCloneEnabled;
        if (btnCloneSession) btnCloneSession.style.display = isCloneEnabled ? 'inline-block' : 'none';

        // Re-render relevant UI
        updateHeader();
        loadLibrary();
    });

    // Handle toggle
    if (toggleCloneSession) {
        toggleCloneSession.addEventListener('change', (e) => {
            isCloneEnabled = e.target.checked;
            chrome.storage.local.set({ enableCloneSession: isCloneEnabled });
            if (btnCloneSession) btnCloneSession.style.display = isCloneEnabled ? 'inline-block' : 'none';

            // Sync dependent UI
            updateHeader();
            loadLibrary();
        });
    }

    btnCloneSession?.addEventListener('click', async () => {
        if (!currentVideoId) return;
        const clone = JSON.parse(JSON.stringify(currentVideoData));
        const now = Date.now();
        clone.isSaved = true;
        clone.isDefault = false;
        clone.createdAt = now;
        clone.updatedAt = now;
        clone.id = currentVideoId;
        const newKey = `v_${currentVideoId}_${now}`;
        await safeSyncSet({ [newKey]: clone }, 'Clone video profile');
        const all = await chrome.storage.sync.get(null);
        updateDataCache(all, currentVideoId);
        currentVideoData = clone;
        currentStorageKey = newKey;
        updateHeader();
        loadLibrary();
        const origColor = btnCloneSession.style.color;
        btnCloneSession.style.color = '#4cc713';
        setTimeout(() => btnCloneSession.style.color = origColor, 1000);
    });

    async function toggleVideoDefault(key) {
        if (!key) return;
        const all = await chrome.storage.sync.get(null);
        const video = all[key];
        if (!video) return;

        const vid = video.id || video.videoId || getVideoIdFromStorageKey(key);
        if (!vid) return;
        const newValue = !video.isDefault;
        video.isDefault = newValue;
        video.id = vid;

        if (newValue) {
            // Unset others for SAME video ID
            const related = Object.keys(all).filter(k => isStorageKeyForVideo(k, vid));
            const updates = {};
            related.forEach(k => {
                if (k !== key && all[k].isDefault) {
                    all[k].isDefault = false;
                    updates[k] = all[k];
                }
            });
            if (Object.keys(updates).length > 0) {
                await safeSyncSet(updates, 'Save default video profile');
            }
        }

        await safeSyncSet({ [key]: video }, 'Update default video profile');

        // If this is the current video, sync local state
        if (key === currentStorageKey) {
            currentVideoData.isDefault = newValue;
            updateHeader();
        }

        updateStorageUsage();
        loadLibrary();
    }

    // --- Set Default Button ---
    document.getElementById('btn-set-default')?.addEventListener('click', async () => {
        if (!currentVideoId) return;

        // Ensure saved first
        if (!currentStorageKey) {
            currentVideoData.isSaved = true;
            await saveData();
        }

        await toggleVideoDefault(currentStorageKey);
    });

    // --- Manage Favorites Button ---
    document.getElementById('btn-manage-favorites')?.addEventListener('click', async () => {
        if (!currentVideoId) return;

        // If not saved yet, save it first
        if (!currentVideoData.isSaved) {
            if (!isPro()) {
                const allData = await chrome.storage.sync.get(null);
                const savedVideos = Object.keys(allData).filter(k => k.startsWith('v_') && allData[k].isSaved);
                if (savedVideos.length >= FREE_LIBRARY_LIMIT) {
                    alert(`Free version is limited to ${FREE_LIBRARY_LIMIT} saved videos in the Library. Please upgrade to Pro to save unlimited videos.`);
                    switchView('library');
                    setTimeout(() => {
                        const container = document.getElementById('view-favorites');
                        if (container) container.scrollTop = container.scrollHeight;
                    }, 300);
                    return;
                }
            }
            currentVideoData.isSaved = true;
            await saveData();
        }

        showFavGroupPicker(currentStorageKey);
    });

    // --- Core Data Logic ---
    let cachedRelatedKeys = [];
    let cachedAllData = {};

    function getVideoIdFromStorageKey(key) {
        if (!key || !key.startsWith('v_')) return null;
        const body = key.slice(2);
        const lastUnderscore = body.lastIndexOf('_');
        if (lastUnderscore <= 0) return null;

        const suffix = body.slice(lastUnderscore + 1);
        if (!/^\d+$/.test(suffix)) return null;

        return body.slice(0, lastUnderscore);
    }

    function getVideoIdFromItem(item) {
        return item?.id || item?.videoId || getVideoIdFromStorageKey(item?._key);
    }

    function getSourceFromUrl(url) {
        return isYouTubeMusicUrl(url) ? 'music' : 'youtube';
    }

    async function getPreferredVideoSource(item = null) {
        if (item?.source === 'music' || item?.platform === 'music') return 'music';
        if (item?.source === 'youtube' || item?.platform === 'youtube') return 'youtube';

        if (connectedTabId) {
            const tab = await chrome.tabs.get(connectedTabId).catch(() => null);
            if (tab?.url) return getSourceFromUrl(tab.url);
        }

        if (currentVideoData?.source) return currentVideoData.source;

        return 'youtube';
    }

    function buildWatchUrl(videoId, source = 'youtube') {
        const host = source === 'music' ? 'music.youtube.com' : 'youtube.com';
        return `https://${host}/watch?v=${encodeURIComponent(videoId)}`;
    }

    function isStorageKeyForVideo(key, videoId) {
        return Boolean(videoId && getVideoIdFromStorageKey(key) === videoId);
    }

    function updateDataCache(allData, videoId) {
        cachedAllData = allData;
        cachedRelatedKeys = Object.keys(allData).filter(k => isStorageKeyForVideo(k, videoId));
    }

    // 1. Init New Session (Detached)
    async function initNewVideoSession(videoId, initialData = {}) {
        currentVideoId = videoId;
        currentStorageKey = null; // Detached

        currentVideoData = createEmptyData(videoId, initialData.title || "Loading...");
        currentVideoData.thumbnail = initialData.thumbnail || "";
        currentVideoData.source = initialData.source || currentVideoData.source;

        const allData = await chrome.storage.sync.get(null);
        updateDataCache(allData, videoId);

        updateHeader();
        renderBookmarks();

        // Fix: Clear/Update playlist highlight for unsaved sessions
        if (isPlaylistMode) renderPlayerPlaylist();
    }

    // 2. Load Specific Profile (Connected)
    async function loadStorageFavorite(key) {
        const res = await chrome.storage.sync.get(key);
        if (res[key]) {
            currentVideoData = res[key];
            currentStorageKey = key;
            currentVideoId = getVideoIdFromItem({ ...currentVideoData, _key: key });

            migrateDataIfNeeded(key, currentVideoId);

            const allData = await chrome.storage.sync.get(null);
            updateDataCache(allData, currentVideoId);

            updateHeader();
            renderBookmarks();
            loadLibrary();

            // Fix: Ensure playlist highlight is updated when switching profiles
            if (isPlaylistMode) renderPlayerPlaylist();
        }
    }

    function migrateDataIfNeeded(key, videoId) {
        let changed = false;
        if (!currentVideoData.id && videoId) {
            currentVideoData.id = videoId;
            changed = true;
        }
        if (!currentVideoData.tagGroups) {
            currentVideoData.tagGroups = { "Default": [], "Study": [], "Cust. A": [], "Cust. B": [] };
            if (currentVideoData.bookmarks) currentVideoData.tagGroups["Default"] = [...currentVideoData.bookmarks];
            delete currentVideoData.bookmarks;
            changed = true;
        }
        if (!currentVideoData.activeGroup) { currentVideoData.activeGroup = "Default"; changed = true; }
        if (!currentVideoData.source) {
            currentVideoData.source = 'youtube';
            changed = true;
        }

        if (!currentVideoData.createdAt) {
            currentVideoData.createdAt = currentVideoData.updatedAt || Date.now();
            changed = true;
        }

        groupSelector.value = currentVideoData.activeGroup;
        if (changed) saveData();
    }

    async function saveData() {
        if (!currentVideoId || (currentVideoData && currentVideoData.title === "Connecting...")) {
            console.log("[YT Study] saveData blocked: Uninitialized or Connecting state.");
            return;
        }

        if (!currentStorageKey) {
            // New save: check capacity first
            await cleanupOldUnfavoriteItems();

            currentStorageKey = `v_${currentVideoId}_${Date.now()}`;
            currentVideoData.isSaved = true;
            currentVideoData.createdAt = Date.now();
        }

        currentVideoData.id = currentVideoId;
        currentVideoData.source = currentVideoData.source || 'youtube';
        currentVideoData.updatedAt = Date.now();
        await safeSyncSet({ [currentStorageKey]: currentVideoData }, 'Save video data');
        updateStorageUsage();

        if (currentVideoId) {
            const all = await chrome.storage.sync.get(null);
            updateDataCache(all, currentVideoId);
            updateHeader();
        }
        loadLibrary();
    }

    // --- UI Header ---
    function updateHeader() {
        const titleContainer = document.getElementById('current-video-title');
        const defaultBtn = document.getElementById('btn-set-default');

        titleContainer.innerHTML = '';

        if (!currentStorageKey) {
            const tag = document.createElement('span');
            tag.textContent = "Unsaved";
            tag.style.cssText = "background:#444; color:#aaa; font-size:10px; padding:2px 4px; border-radius:3px; margin-right:6px;";
            titleContainer.appendChild(tag);
        } else if (currentVideoData.isDefault) {
            const tag = document.createElement('span');
            tag.textContent = "My default";
            tag.style.cssText = "background:#ffca28; color:#000; font-size:10px; padding:2px 4px; border-radius:3px; margin-right:6px; font-weight:600;";
            titleContainer.appendChild(tag);
        }

        // --- Conflict Badge (Multi-Profile) ---
        if (cachedRelatedKeys && cachedRelatedKeys.length > 1) {
            const warnTag = document.createElement('span');
            warnTag.textContent = "!";
            warnTag.title = `${cachedRelatedKeys.length} profiles found for this video. Check Library.`;
            warnTag.style.cssText = "background:#ff4e45; color:white; font-size:10px; padding:2px 5px; border-radius:10px; margin-right:6px; cursor:help; font-weight:bold;";
            titleContainer.appendChild(warnTag);
        }

        const titleSpan = document.createElement('span');
        titleSpan.textContent = currentVideoData.title || "Unknown Video";
        titleContainer.appendChild(titleSpan);

        if (defaultBtn) {
            if (isCloneEnabled) {
                defaultBtn.style.display = 'inline-block';
                defaultBtn.className = 'icon-btn small-btn';
                if (currentVideoData.isDefault) {
                    defaultBtn.classList.add('active');
                    defaultBtn.style.color = '#ffca28'; // Gold
                } else {
                    defaultBtn.style.color = '';
                    defaultBtn.classList.remove('active');
                }
            } else {
                defaultBtn.style.display = 'none';
            }
        }

        const favBtn = document.getElementById('btn-manage-favorites');
        if (favBtn) {
            favBtn.className = 'icon-btn small-btn';
            const hasGroups = currentVideoData.favoriteGroups && currentVideoData.favoriteGroups.length > 0;
            if (hasGroups) {
                favBtn.classList.add('active');
                favBtn.style.color = '#ff4e45'; // Heart Red
            } else {
                favBtn.style.color = '';
            }
        }
    }

    // --- Import / Export Handlers ---
    function exportData() {
        if (!currentVideoData.tagGroups) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentVideoData.tagGroups, null, 2));
        const cleanTitle = (currentVideoData.title || 'video').replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        triggerDownload(dataStr, `yt_tags_${cleanTitle}.json`);
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonObj = JSON.parse(event.target.result);
                const targetGroup = currentVideoData.activeGroup || "Default";
                if (confirm(`Import tags into active group "${targetGroup}"?`)) {
                    let newTags = [];
                    if (Array.isArray(jsonObj)) newTags = jsonObj;
                    else if (typeof jsonObj === 'object') Object.values(jsonObj).forEach(arr => { if (Array.isArray(arr)) newTags.push(...arr); });
                    if (newTags.length > 0) {
                        if (!currentVideoData.tagGroups[targetGroup]) currentVideoData.tagGroups[targetGroup] = [];
                        const targetArr = currentVideoData.tagGroups[targetGroup];
                        const existingTimes = new Set(targetArr.map(t => t.time));
                        let addedCount = 0;
                        newTags.forEach(tag => {
                            if (tag && typeof tag.time === 'number' && !existingTimes.has(tag.time)) {
                                targetArr.push({ time: tag.time, label: tag.label || 'Imported Marker' });
                                existingTimes.add(tag.time);
                                addedCount++;
                            }
                        });
                        if (addedCount > 0) { await saveData(); renderBookmarks(); alert(`Imported ${addedCount} markers.`); }
                        else alert("No new markers found.");
                    }
                }
            } catch (e) { alert("Invalid JSON"); }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    // --- Global Backup/Restore ---
    const btnGlobalExport = document.getElementById('btn-global-export');
    const btnGlobalImport = document.getElementById('btn-global-import');
    const fileGlobalImport = document.getElementById('file-global-import');
    const btnLocalBackupNow = document.getElementById('btn-local-backup-now');
    const btnLocalBackupRestore = document.getElementById('btn-local-backup-restore');
    const localBackupStatus = document.getElementById('local-backup-status');
    const localBackupFeedback = document.getElementById('local-backup-feedback');

    function formatLocalBackupStatus(status) {
        if (!status?.latest) return `No backups | Keeps ${status?.max || 5}`;
        const date = new Date(status.latest.createdAt);
        const label = Number.isNaN(date.getTime()) ? status.latest.createdAt : date.toLocaleString();
        const summary = status.latest.summary || {};
        return `${label} | ${summary.savedCount || 0} videos | ${summary.groupCount || 0} groups`;
    }

    function formatBackupSummary(summary = {}) {
        return `${summary.savedCount || 0} videos, ${summary.groupCount || 0} groups, ${summary.markerCount || 0} marks`;
    }

    function setLocalBackupFeedback(message, type = 'info') {
        if (!localBackupFeedback) return;
        localBackupFeedback.textContent = message;
        if (type === 'success') localBackupFeedback.style.color = 'var(--success-color)';
        else if (type === 'error') localBackupFeedback.style.color = 'var(--danger-color)';
        else localBackupFeedback.style.color = '#888';
    }

    function flashButtonLabel(button, label, finalLabel) {
        if (!button) return;
        button.textContent = label;
        setTimeout(() => {
            button.textContent = finalLabel;
        }, 1800);
    }

    async function refreshLocalBackupStatus() {
        if (!localBackupStatus) return;
        try {
            const status = await sendRuntimeMessage({ action: 'GET_LOCAL_BACKUP_STATUS' });
            localBackupStatus.textContent = formatLocalBackupStatus(status);
            if (btnLocalBackupRestore) btnLocalBackupRestore.disabled = !status?.latest;
        } catch (err) {
            localBackupStatus.textContent = 'Unavailable';
            if (btnLocalBackupRestore) btnLocalBackupRestore.disabled = true;
        }
    }

    if (btnGlobalExport) {
        btnGlobalExport.addEventListener('click', async () => {
            const allData = await chrome.storage.sync.get(null);
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            triggerDownload(dataStr, `yt_studio_backup_${timestamp}.json`);
            log("Backup Created", "success");
        });
    }

    if (btnLocalBackupNow) {
        btnLocalBackupNow.addEventListener('click', async () => {
            btnLocalBackupNow.disabled = true;
            btnLocalBackupNow.textContent = 'Creating...';
            setLocalBackupFeedback('Creating local backup...');
            let completedLabel = 'Create Local Backup Now';
            try {
                const result = await sendRuntimeMessage({ action: 'CREATE_LOCAL_BACKUP' });
                if (!result || typeof result !== 'object') {
                    throw new Error('No response from background backup service. Reload the extension and try again.');
                }

                if (result?.skipped) {
                    setLocalBackupFeedback('No saved data found to back up yet.', 'error');
                } else {
                    const summary = result.backup?.summary || result.status?.latest?.summary || {};
                    setLocalBackupFeedback(`Created: ${formatBackupSummary(summary)}`, 'success');
                    log('Local backup created', 'success');
                    completedLabel = 'Created';
                }
                await refreshLocalBackupStatus();
            } catch (err) {
                setLocalBackupFeedback('Local backup failed: ' + err.message, 'error');
            } finally {
                btnLocalBackupNow.disabled = false;
                flashButtonLabel(btnLocalBackupNow, completedLabel, 'Create Local Backup Now');
            }
        });
    }

    if (btnLocalBackupRestore) {
        btnLocalBackupRestore.addEventListener('click', async () => {
            btnLocalBackupRestore.disabled = true;
            btnLocalBackupRestore.textContent = 'Restoring...';
            setLocalBackupFeedback('Restoring latest local backup...');
            try {
                const backup = await sendRuntimeMessage({ action: 'GET_LATEST_LOCAL_BACKUP' });
                if (!backup?.data) {
                    setLocalBackupFeedback('No local backup found on this device.', 'error');
                    return;
                }
                const summary = backup.summary || {};
                const createdAt = new Date(backup.createdAt).toLocaleString();
                const ok = confirm(`Restore latest local backup from ${createdAt}?\n\nThis will merge with current data and overwrite matching keys.\n\n${summary.savedCount || 0} saved videos, ${summary.groupCount || 0} groups, ${summary.markerCount || 0} markers.`);
                if (!ok) return;

                await safeSyncSet(backup.data, 'Restore local backup');
                log('Local backup restored', 'success');
                await refreshAfterCloudRestore(backup.data);
                await refreshLocalBackupStatus();
                setLocalBackupFeedback(`Restored: ${formatBackupSummary(summary)}`, 'success');
                flashButtonLabel(btnLocalBackupRestore, 'Restored', 'Restore Latest Local Backup');
            } catch (err) {
                setLocalBackupFeedback('Restore local backup failed: ' + err.message, 'error');
            } finally {
                btnLocalBackupRestore.disabled = false;
                if (btnLocalBackupRestore.textContent === 'Restoring...') {
                    btnLocalBackupRestore.textContent = 'Restore Latest Local Backup';
                }
            }
        });
    }

    refreshLocalBackupStatus();

    if (btnGlobalImport) {
        btnGlobalImport.addEventListener('click', () => fileGlobalImport.click());
    }

    if (fileGlobalImport) {
        fileGlobalImport.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (typeof data !== 'object' || data === null) throw new Error("Invalid Data Format");

                    if (confirm("Restore All Data? This will merge with your current data and overwrite duplicates.")) {
                        await safeSyncSet(data, 'Restore backup');
                        log("All Data Restored!", "success");
                        loadLibrary();
                        // If current video is in backup, refresh UI
                        if (currentStorageKey && data[currentStorageKey]) {
                            currentVideoData = data[currentStorageKey];
                            updateHeader();
                            renderBookmarks();
                        }
                    }
                } catch (err) { alert("Import Failed: " + err.message); }
                e.target.value = '';
            };
            reader.readAsText(file);
        });
    }
    function exportVideoFull(vData) {
        const exportObj = { ...vData };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
        const cleanTitle = (vData.title || 'video').replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        triggerDownload(dataStr, `yt_video_${cleanTitle}.json`);
    }

    function importVideoData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonObj = JSON.parse(event.target.result);
                if (!jsonObj.id) throw new Error("Missing ID");

                const vid = jsonObj.id;
                const saveKey = `v_${vid}_${Date.now()}`;

                jsonObj.isSaved = true;
                jsonObj.createdAt = jsonObj.createdAt || Date.now();
                jsonObj.updatedAt = Date.now();

                await safeSyncSet({ [saveKey]: jsonObj }, 'Import video profile');

                const all = await chrome.storage.sync.get(null);
                updateDataCache(all, currentVideoId);
                loadLibrary();
                alert("Import Successful!");
            } catch (err) { alert("Invalid JSON"); }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    // --- Sync Diagnostic Logic ---
    const btnRefreshSync = document.getElementById('btn-refresh-sync');
    if (btnRefreshSync) {
        btnRefreshSync.addEventListener('click', async () => {
            log(`Starting Cloud Sync Refresh (ID: ${chrome.runtime.id.substring(0, 8)})...`, "info");
            btnRefreshSync.disabled = true;
            btnRefreshSync.textContent = "↻ Syncing...";

            try {
                // Force a fresh fetch of everything in sync storage
                const all = await chrome.storage.sync.get(null);
                const keys = Object.keys(all);
                const videoKeys = keys.filter(k => k.startsWith('v_'));
                const legacyKeys = keys.filter(k => !k.startsWith('v_') && k !== 'followMarkers');

                // Deep Diagnostics
                console.log("[YT Study Deep Audit]");
                console.log("- Extension ID:", chrome.runtime.id);
                console.log("- Total Keys in Sync Area:", keys.length);
                console.log("- Video Sessions found:", videoKeys.length);
                if (legacyKeys.length > 0) {
                    console.warn("- Potential Legacy/Foreign keys found:", legacyKeys);
                    log(`Warning: Found ${legacyKeys.length} unrecognized data keys.`, 'error');
                }

                let totalMarkers = 0;
                videoKeys.forEach(k => {
                    const v = all[k];
                    const mCount = v.tagGroups ? Object.values(v.tagGroups).reduce((acc, g) => acc + g.length, 0) : (v.bookmarks ? v.bookmarks.length : 0);
                    totalMarkers += mCount;
                });

                log(`Diagnostic Result: ${videoKeys.length} profiles, ${totalMarkers} markers total.`, "success");

                // Update UI Cache
                if (currentVideoId) updateDataCache(all, currentVideoId);

                // Refresh Lists
                await loadLibrary();

                // If we were "Connecting...", trigger a re-detect
                if (currentVideoData && (currentVideoData.title === "Connecting..." || currentVideoId === null)) {
                    establishConnection(true);
                }

                alert(`Sync Audit Complete!\n\nExtension ID: ${chrome.runtime.id}\nProfiles Found: ${videoKeys.length}\nTotal Markers: ${totalMarkers}\n\nIf your data is still missing, please ensure BOTH machines show the SAME Extension ID above.`);

            } catch (err) {
                log("Sync Audit failed: " + err.message, "error");
                alert("Sync Audit failed: " + err.message);
            } finally {
                btnRefreshSync.disabled = false;
                btnRefreshSync.textContent = "↻ Refresh Cloud Sync & Diagnostics";
            }
        });
    }

    function triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // --- Render Bookmarks ---
    function renderBookmarks(highlightTime = null) {
        if (highlightTime !== null) pendingHighlightTime = highlightTime;

        const checkTime = pendingHighlightTime;
        const groupName = currentVideoData.activeGroup || "Default";
        const groupTags = currentVideoData.tagGroups ? currentVideoData.tagGroups[groupName] : [];
        if (groupTags) groupTags.sort((a, b) => a.time - b.time);

        const list = document.getElementById('bookmarks-list');
        list.innerHTML = '';

        groupTags.forEach((bm, i) => {
            const li = document.createElement('li');
            li.className = 'bookmark-item';
            li.dataset.time = bm.time; // Add data-time for easier tracking

            // Highlight Check
            if (checkTime !== null && Math.abs(bm.time - checkTime) < 0.05) {
                li.classList.add('highlight-new');
                // Clear after application
                if (pendingHighlightTime === checkTime) pendingHighlightTime = null;
                // Only scroll if follow is enabled (handled by syncMarkersUI later or forced here)
                requestAnimationFrame(() => syncMarkersUI(true));
            }

            li.innerHTML = `
                <div class="bookmark-controls">
                    <button class="bookmark-restart-btn" title="Play from here">${ICON_SMALL_RESTART}</button>
                </div>
                <input type="text" class="bookmark-time-input" value="${formatTime(bm.time)}">
                <button class="renew-btn" title="Renew to current time">${ICON_RENEW}</button>
                <input type="text" class="bookmark-desc" value="${bm.label || ''}" placeholder="marker description">
                <div class="bookmark-controls">
                    <button class="loop-set-btn set-a">A</button>
                    <button class="loop-set-btn set-b">B</button>
                    <button class="delete-btn">×</button>
                </div>
            `;
            list.appendChild(li);
        });

        // Always re-apply active highlight after render to prevent flickering
        // Do NOT force scroll here, let syncMarkersUI decide based on toggle or manual trigger
        requestAnimationFrame(() => {
            syncMarkersUI(false);
        });
    }

    // --- EVENT DELEGATION FOR BOOKMARKS ---
    // This solves the issue of losing clicks during re-renders because the listener
    // is attached to the static PARENT, not the dynamic children.
    const bookmarksList = document.getElementById('bookmarks-list');
    if (bookmarksList) {
        bookmarksList.addEventListener('click', async (e) => {
            const li = e.target.closest('.bookmark-item');
            if (!li) return;

            const time = parseFloat(li.dataset.time);
            const groupName = currentVideoData.activeGroup || "Default";
            const groupTags = currentVideoData.tagGroups ? currentVideoData.tagGroups[groupName] : [];
            const index = Array.from(li.parentNode.children).indexOf(li);
            const bm = groupTags[index];

            // 1. Restart / Play Button
            if (e.target.closest('.bookmark-restart-btn')) {
                lastCommandSentTime = Date.now();
                const originalPlaying = isCurrentlyPlaying;
                const originalTime = lastKnownCurrentTime;

                isCurrentlyPlaying = true;
                lastKnownCurrentTime = time;
                syncMarkersUI(true);

                try {
                    await sendMessage('SEEK_AND_PLAY', { time: time });
                } catch (err) {
                    isCurrentlyPlaying = originalPlaying;
                    lastKnownCurrentTime = originalTime;
                    syncMarkersUI(true);
                }
            }
            // 2. Renew Button
            else if (e.target.closest('.renew-btn')) {
                if (bm) {
                    bm.time = lastKnownCurrentTime;
                    saveData();
                    renderBookmarks();
                    log(`Marker renewed to ${formatTime(lastKnownCurrentTime)}`, 'success');
                }
            }
            // 3. Set A Button
            else if (e.target.closest('.set-a')) {
                lastCommandSentTime = Date.now();
                currentLoopStart = time;
                if (loopStart) loopStart.value = formatTime(time);
                sendMessage('SET_LOOP_START', { time: time });
                if (currentLoopEnd !== null) currentLoopEnabled = true;
                updateLoopVisuals();
                setLoopAccordionState(true);
            }
            // 4. Set B Button
            else if (e.target.closest('.set-b')) {
                lastCommandSentTime = Date.now();
                currentLoopEnd = time;
                if (loopEnd) loopEnd.value = formatTime(time);
                sendMessage('SET_LOOP_END', { time: time });
                if (currentLoopStart !== null) currentLoopEnabled = true;
                updateLoopVisuals();
                setLoopAccordionState(true);
            }
            // 5. Delete Button
            else if (e.target.closest('.delete-btn')) {
                groupTags.splice(index, 1);
                saveData();
                renderBookmarks();
            }
        });

        // Delegate 'change' events for inputs too
        bookmarksList.addEventListener('change', (e) => {
            const li = e.target.closest('.bookmark-item');
            if (!li) return;

            const groupName = currentVideoData.activeGroup || "Default";
            const groupTags = currentVideoData.tagGroups ? currentVideoData.tagGroups[groupName] : [];
            const index = Array.from(li.parentNode.children).indexOf(li);
            const bm = groupTags[index];
            if (!bm) return;

            if (e.target.classList.contains('bookmark-time-input')) {
                const t = parseTime(e.target.value);
                if (t !== null) { bm.time = t; saveData(); renderBookmarks(); }
                else { e.target.value = formatTime(bm.time); }
            } else if (e.target.classList.contains('bookmark-desc')) {
                bm.label = e.target.value;
                saveData();
            }
        });
    }

    function syncMarkersUI(force = false) {
        const followToggle = document.getElementById('follow-playback-toggle');
        const isFollowEnabled = followToggle && followToggle.checked;

        // CRITICAL: If follow is disabled and this is an automatic update (not forced),
        // skip finding active marker and updating UI highlights.
        if (!isFollowEnabled && !force) return;

        const listItems = document.querySelectorAll('#bookmarks-list .bookmark-item');
        if (listItems.length === 0) return;

        const currentTime = lastKnownCurrentTime;
        let activeLi = null;

        // 1. Find the active marker (the one most recently passed)
        listItems.forEach(li => {
            const itemTime = parseFloat(li.dataset.time);
            if (!isNaN(itemTime) && itemTime <= (currentTime + 0.1)) {
                if (!activeLi || itemTime >= parseFloat(activeLi.dataset.time)) {
                    activeLi = li;
                }
            }
        });

        const activeTime = activeLi ? parseFloat(activeLi.dataset.time) : -1;

        // PERFORMANCE OPTIMIZATION: Only update DOM if the active marker truly changed
        // This avoids expensive classList toggles and scrolling on every 150ms tick.
        if (activeTime === lastActiveLiTime && !force) return;

        lastActiveLiTime = activeTime;

        // 2. Update Classes and Icons for all markers
        listItems.forEach(li => {
            const isActive = (li === activeLi);

            // Highlight background/bar
            if (isActive) {
                li.classList.add('active-playing');
            } else {
                li.classList.remove('active-playing');
            }
        });

        // 3. Auto-scroll to active marker
        if (activeLi) {
            // CRITICAL: We ONLY scroll if Follow is ON,
            // OR if it's a forced scroll (like clicking/adding a marker).
            const followToggle = document.getElementById('follow-playback-toggle');
            const isFollowEnabled = followToggle && followToggle.checked;

            if (isFollowEnabled || force) {
                const container = document.querySelector('.bookmarks-list-container');
                if (container) {
                    const topPos = activeLi.offsetTop;
                    const containerHeight = container.clientHeight;
                    const itemHeight = activeLi.clientHeight;
                    const targetScroll = topPos - (containerHeight / 2) + (itemHeight / 2);

                    // Prevent jitter: Only scroll if significantly different or forced
                    if (force || Math.abs(container.scrollTop - targetScroll) > 5) {
                        container.scrollTo({
                            top: targetScroll,
                            behavior: force ? 'smooth' : 'auto'
                        });
                    }
                }
            }
        }
        else {
            lastActiveLiTime = -1;
        }
    }

    // --- Library Logic ---
    async function loadLibrary() {
        updateStorageUsage();
        return loadFavorites();
    }

    function getMarkerCount(v) {
        if (v.tagGroups) return Object.values(v.tagGroups).reduce((acc, g) => acc + g.length, 0);
        if (v.bookmarks) return v.bookmarks.length;
        return 0;
    }

    function resolveActiveLibraryKey(items) {
        if (!Array.isArray(items) || items.length === 0) return null;

        if (currentStorageKey && items.some(v => v._key === currentStorageKey)) {
            return currentStorageKey;
        }

        if (!currentVideoId) return null;

        const related = items.filter(v => getVideoIdFromItem(v) === currentVideoId);
        if (related.length === 0) return null;

        related.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;

            const countDiff = getMarkerCount(b) - getMarkerCount(a);
            if (countDiff !== 0) return countDiff;

            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

        return related[0]._key;
    }

    function refreshActiveLibraryMarkers() {
        ['favorites-list', 'player-playlist-items'].forEach(id => {
            const container = document.getElementById(id);
            if (!container) return;

            const items = Array.from(container.querySelectorAll('.library-item[data-key]'));
            let activeApplied = false;

            items.forEach(el => {
                const shouldBeActive = Boolean(container.dataset.activeKey) &&
                    !activeApplied &&
                    el.dataset.key === container.dataset.activeKey;
                el.classList.toggle('active', shouldBeActive);
                if (shouldBeActive) activeApplied = true;
            });
        });
    }

    function isAllVideosGroup(groupName) {
        return groupName === ALL_VIDEOS_GROUP;
    }

    // --- Favorites Logic ---
    async function loadFavorites() {
        const container = document.getElementById('favorites-list');
        if (!container) return;
        container.innerHTML = 'Loading...';

        const storageData = await chrome.storage.sync.get(null);
        favoriteGroupOrders = storageData.favorite_group_orders || {};

        let items = [];
        const activeGroup = document.getElementById('fav-group-selector')?.value || currentFavGroup;
        currentFavGroup = activeGroup;
        updateCollectionControls();

        Object.keys(storageData).forEach(key => {
            if (key.startsWith('v_') && storageData[key].isSaved) {
                const video = storageData[key];
                let isMatch = false;

                if (isAllVideosGroup(activeGroup)) {
                    isMatch = true;
                } else {
                    const favGroups = video.favoriteGroups || [];
                    if (video.isDefault && !favGroups.includes("Default")) {
                        favGroups.push("Default");
                    }

                    if (favGroups.includes(activeGroup)) isMatch = true;
                }
                if (isMatch) items.push({ ...video, id: video.id || getVideoIdFromStorageKey(key), _key: key });
            }
        });

        if (items.length === 0) {
            const emptyLabel = isAllVideosGroup(activeGroup) ? 'No saved videos.' : `No videos in "${activeGroup}" group.`;
            container.innerHTML = `<p style="padding:20px;text-align:center;color:#666">${emptyLabel}</p>`;
            return;
        }

        if (isAllVideosGroup(activeGroup)) {
            items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            browsedGroupItems = items;
            renderList(container, items);
            return;
        }

        // Apply Custom Sort
        const data = await chrome.storage.sync.get('favorite_group_orders');
        favoriteGroupOrders = data.favorite_group_orders || {};

        const order = favoriteGroupOrders[activeGroup] || [];
        const currentKeys = items.map(i => i._key);

        // Filter and sync markers locally without aggressive storage writing
        let syncedOrder = order.filter(k => currentKeys.includes(k));
        currentKeys.forEach(k => {
            if (!syncedOrder.includes(k)) syncedOrder.push(k);
        });

        // Use the synced order for display
        items.sort((a, b) => {
            const idxA = syncedOrder.indexOf(a._key);
            const idxB = syncedOrder.indexOf(b._key);
            return idxA - idxB;
        });

        // Update memory cache and persist to storage for subsequent reorders
        favoriteGroupOrders[activeGroup] = syncedOrder;
        await safeSyncSet({ 'favorite_group_orders': favoriteGroupOrders }, 'Save group order');

        browsedGroupItems = items; // Cache for starting a playlist
        renderList(container, items);
    }

    async function moveFavoriteItem(key, direction) {
        const activeGroup = document.getElementById('fav-group-selector')?.value || currentFavGroup;
        const order = favoriteGroupOrders[activeGroup];
        if (!order) return;

        const idx = order.indexOf(key);
        if (idx === -1) return;

        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= order.length) return;

        // Swap
        const temp = order[idx];
        order[idx] = order[newIdx];
        order[newIdx] = temp;

        favoriteGroupOrders[activeGroup] = order;
        await safeSyncSet({ 'favorite_group_orders': favoriteGroupOrders }, 'Save group order');
        loadFavorites();
    }

    async function reorderFavoriteItem(oldIndex, newIndex) {
        const activeGroup = document.getElementById('fav-group-selector')?.value || currentFavGroup;

        // Always get the latest full order map from sync to avoid overwriting other groups
        const data = await chrome.storage.sync.get('favorite_group_orders');
        let allOrders = data.favorite_group_orders || {};
        let order = allOrders[activeGroup];

        if (!order || !Array.isArray(order) || order.length === 0) return;

        // Bounds check
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= order.length) newIndex = order.length - 1;

        if (oldIndex === newIndex) {
            loadFavorites(); // Reset UI
            return;
        }

        // Move item
        const item = order.splice(oldIndex, 1)[0];
        order.splice(newIndex, 0, item);

        allOrders[activeGroup] = order;
        favoriteGroupOrders = allOrders; // Sync memory cache

        await safeSyncSet({ 'favorite_group_orders': allOrders }, 'Save group order');
        console.log(`[YT Study] Favorite Reordered in "${activeGroup}": ${oldIndex + 1} -> ${newIndex + 1}`);

        loadFavorites();
    }

    function togglePlaylist() {
        isPlaylistMode = !isPlaylistMode;
        const btn = document.getElementById('btn-play-group');
        const prevBtn = document.getElementById('prev-video-btn');
        const nextBtn = document.getElementById('next-video-btn');
        const playlistTab = document.getElementById('tab-playlist');

        // Specialized UI elements to hide during Group Play
        const sessionUI = [
            document.getElementById('jump-loop'),
            document.getElementById('loop-toggle-btn'),
            document.getElementById('clear-loop'),
            document.getElementById('main-speed-badge'),
            document.getElementById('speed-content'),
            document.getElementById('speed-down'),
            document.getElementById('speed-up'),
            document.getElementById('speed-slider'),
            document.getElementById('restart-btn'),
            document.querySelector('.loop-inputs-merged'),
            document.getElementById('marker-a'),
            document.getElementById('marker-b')
        ];

        if (!btn) return;

        const playerView = document.getElementById('view-player');
        if (playerView) playerView.classList.toggle('playlist-mode-active', isPlaylistMode);

        if (isPlaylistMode) {
            if (prevBtn) prevBtn.style.display = 'flex';
            if (nextBtn) nextBtn.style.display = 'flex';
            if (playlistTab) playlistTab.style.display = 'block';

            // Lock in the current browsed group as our active playlist
            currentPlaylistItems = [...browsedGroupItems];

            // Hide Marker-specific tools
            sessionUI.forEach(el => { if (el) el.style.display = 'none'; });

            log("Group Playlist Mode: Active", "success");

            // Switch to Player view and Playlist tab
            switchView('player');
            switchSubPanel('playlist');
            renderPlayerPlaylist();

            // If current video is not in group, start first one
            const isInGroup = currentPlaylistItems.some(i => i.id === currentVideoId);
            if (!isInGroup && currentPlaylistItems.length > 0) {
                openVideo(currentPlaylistItems[0]);
            }
        } else {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (playlistTab) playlistTab.style.display = 'none';

            // Restore Marker/Session UI
            sessionUI.forEach(el => { if (el) el.style.display = ''; });

            // Switch back to Markers tab if we were on Playlist tab
            const activeTab = document.querySelector('.player-tabs .tab-btn.active');
            if (activeTab && activeTab.id === 'tab-playlist') {
                switchSubPanel('markers');
            }

            log("Group Playlist Mode: Stopped", "info");
        }
    }

    async function handleVideoEnded() {
        if (!isPlaylistMode || currentPlaylistItems.length === 0) return;
        await playNextVideo();
        // Removed renderPlayerPlaylist() here as it triggers too early (before navigation completes).
        // The highlight will be updated by VIDEO_METADATA handler after navigation.
    }

    function renderPlayerPlaylist() {
        const container = document.getElementById('player-playlist-items');
        if (!container) return;

        // Update Title
        const titleEl = document.getElementById('playlist-group-title');
        if (titleEl) {
            const activeGroupValue = document.getElementById('fav-group-selector')?.value || currentFavGroup;
            const activeGroupName = isAllVideosGroup(activeGroupValue) ? ALL_VIDEOS_LABEL : activeGroupValue || 'Playlist';
            titleEl.textContent = `Group: ${activeGroupName}`;
        }

        container.innerHTML = '';

        if (currentPlaylistItems.length === 0) {
            container.innerHTML = '<p style="padding:20px;text-align:center;color:#666">No videos in group.</p>';
            return;
        }

        const activeKey = resolveActiveLibraryKey(currentPlaylistItems);
        container.dataset.activeKey = activeKey || '';

        currentPlaylistItems.forEach((v, index) => {
            const el = document.createElement('div');
            el.className = 'library-item';
            el.dataset.key = v._key || '';

            const isActive = v._key === activeKey;
            if (isActive) el.classList.add('active');

            el.innerHTML = `
                <div class="thumbnail-wrapper" style="width: 80px; height: 45px; flex-shrink: 0;">
                    <img src="${v.thumbnail || 'https://via.placeholder.com/120x68'}" class="video-thumbnail" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">
                    <div style="position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.8); color:#fff; font-size:9px; padding:1px 3px; border-radius:2px;">${index + 1}</div>
                </div>
                <div class="video-info" style="margin-left:8px; overflow:hidden;">
                    <div class="video-title" style="font-size:11px; line-height:1.2; max-height:2.4em; overflow:hidden; font-weight:500;">${v.title || 'Untitled'}</div>
                    <div class="video-meta" style="font-size:9px; color:#888; margin-top:2px;">${v.favoriteGroups ? v.favoriteGroups.join(', ') : ''}</div>
                </div>
            `;

            el.onclick = () => {
                if (v._key !== currentStorageKey) {
                    openVideo(v);
                }
            };
            container.appendChild(el);

            // Auto-scroll to active item
            if (v._key === activeKey) {
                setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
            }
        });
    }

    async function playNextVideo() {
        if (currentPlaylistItems.length === 0) return;

        // Find current index by Key or ID fallback
        let currentIndex = currentPlaylistItems.findIndex(i => i._key === currentStorageKey);
        if (currentIndex === -1 && currentVideoId) {
            currentIndex = currentPlaylistItems.findIndex(i => i.id === currentVideoId);
        }

        if (currentIndex !== -1 && currentIndex < currentPlaylistItems.length - 1) {
            const nextVideo = currentPlaylistItems[currentIndex + 1];
            log(`Playlist: Moving to next video (${currentIndex + 2}/${currentPlaylistItems.length})`, "info");
            openVideo(nextVideo);
        } else {
            log("Playlist finished.", "success");
            if (isPlaylistMode) togglePlaylist(); // Stop if at end
        }
    }

    async function playPrevVideo() {
        if (currentPlaylistItems.length === 0) return;

        let currentIndex = currentPlaylistItems.findIndex(i => i._key === currentStorageKey);
        if (currentIndex === -1 && currentVideoId) {
            currentIndex = currentPlaylistItems.findIndex(i => i.id === currentVideoId);
        }

        if (currentIndex > 0) {
            const prevVideo = currentPlaylistItems[currentIndex - 1];
            log(`Playlist: Moving to previous video (${currentIndex}/${currentPlaylistItems.length})`, "info");
            openVideo(prevVideo);
        } else {
            log("Already at the first video.", "info");
        }
    }

    async function openVideo(v) {
        const vid = getVideoIdFromItem(v);
        if (!vid) return;

        showStandby(false);
        switchView('player');

        // Respect current playing state if possible
        const isCurrentlyPlaying = true; // Force play for playlist

        chrome.storage.local.set({
            [`pending_nav_${vid}`]: v._key,
            'playback_intent': { value: isCurrentlyPlaying, ts: Date.now() }
        });

        const watchUrl = buildWatchUrl(vid, await getPreferredVideoSource(v));
        if (connectedTabId) {
            chrome.tabs.update(connectedTabId, { url: watchUrl, active: true });
        } else {
            const nt = await chrome.tabs.create({ url: watchUrl });
            connectedTabId = nt.id;
        }
        establishConnection(true);
    }

    function renderList(container, items) {
        container.innerHTML = '';
        container.classList.toggle('edit-mode', isLibraryEditMode);
        const activeKey = resolveActiveLibraryKey(items);
        container.dataset.activeKey = activeKey || '';

        // Safety check for monetization status
        let paid = false;
        try {
            if (typeof isPro === 'function') paid = isPro();
        } catch (e) { console.warn("monetization check failed", e); }

        items.forEach((v, index) => {
            const isGated = !paid && index >= FREE_LIBRARY_LIMIT;
            const el = document.createElement('div');
            el.className = 'library-item';
            el.dataset.key = v._key || '';
            if (v._key === activeKey) el.classList.add('active');

            if (isGated) {
                el.style.opacity = '0.4';
                el.style.cursor = 'not-allowed';
                el.title = `Free version is limited to ${FREE_LIBRARY_LIMIT} videos. Upgrade to Pro to unlock.`;
            }

            const thumbSrc = v.thumbnail || '';
            let count = 0;
            if (v.tagGroups) Object.values(v.tagGroups).forEach(g => count += g.length);
            else if (v.bookmarks) count = v.bookmarks.length;

            const createDate = v.createdAt || v.updatedAt || Date.now();
            const dateStr = new Date(createDate).toLocaleString('zh-TW', { hour12: false, month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });

            // Meta Label
            let metaLabel = dateStr;
            if (v.isDefault) {
                metaLabel = `<span style="color:#ffca28; font-weight:bold;">★</span> ${dateStr}`;
            }

            // Library Group Badge
            let favBadge = '';
            if (v.favoriteGroups && v.favoriteGroups.length > 0) {
                favBadge = `<span style="font-size:9px; color:var(--accent-color); background:rgba(62,166,255,0.1); padding:0 4px; border-radius:4px; margin-left:4px;">${v.favoriteGroups[0]}${v.favoriteGroups.length > 1 ? '+' : ''}</span>`;
            }

            let sortIndexUI = '';
            if (isLibraryEditMode && container.id === 'favorites-list') {
                const activeGroup = document.getElementById('fav-group-selector')?.value || currentFavGroup;
                if (!isAllVideosGroup(activeGroup)) {
                    const order = favoriteGroupOrders[activeGroup] || [];
                    const currentIdx = order.indexOf(v._key) + 1; // 1-based
                    sortIndexUI = `
                        <div style="display:flex; align-items:center; margin-right:6px;">
                            <input type="text" inputmode="numeric" class="item-sort-index" value="${currentIdx}"
                                data-key="${v._key}"
                                style="width:28px; height:20px; font-size:10px; text-align:center; background:#000; border:1px solid #444; color:var(--accent-color); border-radius:3px; padding:0;">
                        </div>
                    `;
                }
            }

            el.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="item-select-checkbox" data-key="${v._key}" style="cursor:pointer; width:14px; height:14px; accent-color:var(--accent-color);">
                    ${sortIndexUI}
                    <img src="${thumbSrc}" class="library-thumb" onerror="this.style.display='none'">
                </div>
                <div class="library-info">
                    <div class="library-title" title="${v.title}">
                        ${v.title || 'Untitled'}
                    </div>
                    <div class="library-meta" style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:10px; color:#888;">${metaLabel}${favBadge} • ${count} markers</span>
                        <div style="display:flex; gap:4px;">
                            ${isCloneEnabled ? `<button class="icon-btn small-action toggle-item-default-btn" title="Set as My Default Profile" style="width:20px;height:20px;font-size:10px; color:${v.isDefault ? '#ffca28' : ''};">★</button>` : ''}
                            <button class="icon-btn small-action set-fav-groups-btn" title="Add to Library Groups" style="width:20px;height:20px;font-size:10px; color:${v.favoriteGroups && v.favoriteGroups.length > 0 ? '#ff4e45' : ''};">❤</button>
                            <button class="icon-btn small-action export-item-btn" title="Export" style="width:20px;height:20px;font-size:10px;">⬇</button>
                        </div>
                    </div>
                </div>
                <button class="delete-btn">×</button>
            `;

            if (sortIndexUI) {
                const input = el.querySelector('.item-sort-index');
                input.onclick = (e) => e.stopPropagation();
                input.onchange = (e) => {
                    const newPos = parseInt(e.target.value) - 1;
                    if (!isNaN(newPos)) reorderFavoriteItem(index, newPos);
                };
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        const newPos = parseInt(e.target.value) - 1;
                        if (!isNaN(newPos)) reorderFavoriteItem(index, newPos);
                    }
                };
            }

            el.querySelector('.item-select-checkbox').addEventListener('click', (e) => {
                e.stopPropagation();
                updateBatchUI();
            });

            el.addEventListener('click', async (e) => {
                if (isLibraryEditMode) return;
                if (e.target.tagName !== 'BUTTON') {
                    if (isGated) {
                        alert(`This video is locked. Free version is limited to ${FREE_LIBRARY_LIMIT} videos. Please upgrade to Pro in Settings.`);
                        return;
                    }
                    const vid = getVideoIdFromItem(v);
                    log(`Library click: vid=${vid}, key=${v._key}`, "info");

                    try {
                        if (!vid) throw new Error("Missing Video ID");

                        // 1. UI Response
                        showStandby(false);
                        const titleEl = document.getElementById('current-video-title');
                        if (titleEl) titleEl.textContent = "Opening YouTube...";
                        switchView('player');

                        // 2. Storage Intention (Non-blocking)
                        chrome.storage.local.set({
                            [`pending_nav_${vid}`]: v._key,
                            'playback_intent': {
                                value: true,
                                ts: Date.now()
                            }
                        });

                        // 3. Navigate
                        let targetId = connectedTabId;
                        log(`Checking navigation: targetId=${targetId}`, "info");

                        if (!targetId) {
                            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                            if (tabs[0]) {
                                targetId = tabs[0].id;
                                log("Found active targetId: " + targetId, "info");
                            }
                        }

                        if (targetId) {
                            const t = await chrome.tabs.get(targetId).catch(() => null);
                            if (t) {
                                connectedTabId = targetId;
                                log(`Updating tab ${targetId} to ${vid}`, "info");
                                const watchUrl = buildWatchUrl(vid, await getPreferredVideoSource(v));
                                chrome.tabs.update(targetId, { url: watchUrl, active: true });
                            } else {
                                log("TargetId invalid, creating new", "info");
                                const watchUrl = buildWatchUrl(vid, await getPreferredVideoSource(v));
                                const nt = await chrome.tabs.create({ url: watchUrl });
                                connectedTabId = nt.id;
                            }
                        } else {
                            log("No target, creating new tab", "info");
                            const watchUrl = buildWatchUrl(vid, await getPreferredVideoSource(v));
                            const nt = await chrome.tabs.create({ url: watchUrl });
                            connectedTabId = nt.id;
                        }

                        // 4. Trigger handshake
                        log("Triggering connection...", "info");
                        establishConnection(true);

                    } catch (err) {
                        console.error("Library Click Error:", err);
                        log("Failed to open: " + err.message, "error");
                        // Force debug console open if failure
                        const dbg = document.getElementById('debug-console');
                        if (dbg) dbg.style.display = 'block';
                    }
                }
            });

            el.querySelector('.delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                showConfirmModal(
                    "Delete Save",
                    `Delete this save for "${v.title || 'Untitled'}"? This action cannot be undone.`,
                    async () => {
                        await secureRemove(v._key);
                        if (currentStorageKey === v._key) {
                            initNewVideoSession(currentVideoId, { title: v.title, thumbnail: v.thumbnail });
                        }
                        loadLibrary();
                    }
                );
            });
            el.querySelector('.export-item-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                exportVideoFull(v);
            });
            el.querySelector('.set-fav-groups-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                showFavGroupPicker(v._key);
            });
            el.querySelector('.toggle-item-default-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleVideoDefault(v._key);
            });
            container.appendChild(el);
        });
    }

    // --- State Sync (Multi-Window) ---
    // --- State Sync (Multi-Window) ---
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'sync') return;
        
        // s4.0.0: Automated Cloud Sync 
        if (!isApplyingCloudSnapshot && typeof triggerCloudSync === 'function') triggerCloudSync();

        if (changes.favorite_groups) {
            favoriteGroupsList = changes.favorite_groups.newValue || ["Default"];
            updateFavGroupUI();
            loadFavorites();
        }

        let shouldRefreshLib = false;
        let shouldRefreshFav = false;

        // Optimized Logic: Only refresh if relevant keys changed significantly
        // or if a new video was added/removed (keys starting with v_ count changed)

        const videoKeysChanged = Object.keys(changes).filter(k => k.startsWith('v_'));

        if (videoKeysChanged.length > 0) {
            // Check if any change was an ADD or REMOVE or IS_DEFAULT toggle
            // If it's just a timestamp update, we might not need to re-render the whole list
            // Significant Change Check: Only re-render if markers actually changed
            const significantChange = videoKeysChanged.some(k => {
                const val = changes[k].newValue;
                const old = changes[k].oldValue;
                if (!val || !old) return true;
                if (val.title !== old.title) return true;
                if (val.isDefault !== old.isDefault) return true;
                if (val.isSaved !== old.isSaved) return true;

                // Check tag groups count and first item time/label for quick difference
                const newGroups = val.tagGroups || {};
                const oldGroups = old.tagGroups || {};
                const newCount = Object.values(newGroups).reduce((acc, g) => acc + g.length, 0);
                const oldCount = Object.values(oldGroups).reduce((acc, g) => acc + g.length, 0);
                if (newCount !== oldCount) return true;

                // If count is same, check if the current active group tags changed
                const group = val.activeGroup || "Default";
                const newTags = newGroups[group] || [];
                const oldTags = oldGroups[group] || [];
                if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) return true;

                return false;
            });

            if (significantChange) {
                shouldRefreshLib = true;
                shouldRefreshFav = true;
            }

            // Specific case: Current video updated externally (e.g. from popup to sidebar)
            if (videoKeysChanged.includes(currentStorageKey)) {
                if (changes[currentStorageKey].newValue) {
                    const newVal = changes[currentStorageKey].newValue;
                    const oldVal = changes[currentStorageKey].oldValue || {};

                    currentVideoData = newVal;
                    updateHeader();

                    // ONLY re-render bookmarks if the tag groups for the ACTIVE group changed
                    const group = newVal.activeGroup || "Default";
                    if (JSON.stringify(newVal.tagGroups?.[group]) !== JSON.stringify(oldVal.tagGroups?.[group])) {
                        renderBookmarks();
                    }
                }
            }
        }

        if (shouldRefreshLib) loadLibrary();
        else if (shouldRefreshFav) loadFavorites();

        if (shouldRefreshLib || shouldRefreshFav) {
            // Update Cache for Detect Button
            chrome.storage.sync.get(null).then(all => {
                if (currentVideoId) updateDataCache(all, currentVideoId);
            });
        }

        // --- Follow Markers Sync ---
        if (changes.followMarkers) {
            const followToggle = document.getElementById('follow-playback-toggle');
            if (followToggle) {
                followToggle.checked = changes.followMarkers.newValue;
            }
        }
    });

    // Messages
    chrome.runtime.onMessage.addListener(async (msg, sender) => {
        // Strict Isolation with Discovery Latch:
        // Normally only accept from connectedTabId.
        // But if we are in "Connecting..." state, allow auto-binding to any ACTIVE YouTube tab.
        let isMatch = connectedTabId && sender.tab && sender.tab.id === connectedTabId;

        if (!isMatch) {
            const isConnecting = currentVideoData && currentVideoData.title === "Connecting...";
            const isTabActive = sender.tab && sender.tab.active;
            const isYT = sender.tab && isYouTubeVideoUrl(sender.tab.url);

            if (isConnecting && isTabActive && isYT) {
                console.log("[YT Study] Discovery Latch: Auto-binding to", sender.tab.id);
                connectedTabId = sender.tab.id;
            } else {
                return;
            }
        }

        // Connection Check
        if (statusIndicator) statusIndicator.classList.add('connected');
        showStandby(false); // Hide instructions if we were in orphaned mode

        if (msg.action === 'VIDEO_METADATA') {
            const d = msg.data;
            const isNewVideo = d.videoId !== currentVideoId;
            const isUninitialized = currentVideoId === null;

            // 1. ALWAYS check for explicit Library navigation first
            const pendingKey = `pending_nav_${d.videoId}`;
            const localData = await chrome.storage.local.get(pendingKey);

            if (localData[pendingKey]) {
                console.log("[YT Study] Loading Explicit Profile from Library:", localData[pendingKey]);
                currentVideoId = d.videoId; // Ensure ID is sync'd
                isSyncing = true;
                await loadStorageFavorite(localData[pendingKey]);
                chrome.storage.local.remove(pendingKey); // Consume the token
                isSyncing = false;

                // Explicitly refresh playlist UI here because we return early
                if (isPlaylistMode) renderPlayerPlaylist();
                return; // Priority handled
            }

            // 2. Normal Auto-Detect/Title-Update Logic
            if (isNewVideo || (d.title && d.title !== "YouTube" && currentVideoData.title !== d.title)) {
                currentVideoId = d.videoId;

                if (isNewVideo || isUninitialized) {
                    if (isSyncing) return;

                    // Auto Detect Logic
                    const all = await chrome.storage.sync.get(null);
                    const related = [];
                    Object.keys(all).forEach(k => {
                        if (isStorageKeyForVideo(k, d.videoId) && all[k].isSaved) {
                            related.push({ ...all[k], id: all[k].id || getVideoIdFromStorageKey(k), _key: k });
                        }
                    });

                    if (related.length > 0) {
                        // Sort: Default > Marker Count > Recent
                        related.sort((a, b) => {
                            if (a.isDefault && !b.isDefault) return -1;
                            if (!a.isDefault && b.isDefault) return 1;

                            const getCount = (v) => {
                                if (v.tagGroups) return Object.values(v.tagGroups).reduce((acc, g) => acc + g.length, 0);
                                if (v.bookmarks) return v.bookmarks.length;
                                return 0;
                            };
                            const countA = getCount(a);
                            const countB = getCount(b);
                            if (countA !== countB) return countB - countA;
                            return (b.updatedAt || 0) - (a.updatedAt || 0);
                        });

                        console.log("Auto-Detected Favorite (Smart):", related[0]._key);
                        log(`Auto-detected Profile: ${related[0].title || 'video'}`, 'success');
                        isSyncing = true;
                        await loadStorageFavorite(related[0]._key);
                        isSyncing = false;
                    } else {
                        // Truly new video with no saved sessions
                        log(`New session: ${d.title}`, 'info');
                        initNewVideoSession(d.videoId, { title: d.title, thumbnail: d.thumbnail, source: d.source });
                    }
                } else if (d.title && d.title !== "YouTube") {
                    // Update title if it was "Loading..." or changed
                    currentVideoData.title = d.title;
                    currentVideoData.thumbnail = d.thumbnail || currentVideoData.thumbnail;
                    currentVideoData.source = d.source || currentVideoData.source;
                    updateHeader();
                }

                // If in Playlist Mode, refresh the playlist UI to show current video highlight
                if (isPlaylistMode) renderPlayerPlaylist();
            }
            // Command Guard: Ignore status updates for a window after user action (seek/play)
            // This prevents "pulse rollback" where the UI jumps back to old time before seek completes
            const isGuarded = (Date.now() - lastCommandSentTime < 200);

            // Update UI based on incoming metadata
            if (d.currentTime !== undefined) {
                if (!isGuarded) {
                    lastKnownCurrentTime = d.currentTime;
                }

                if (!isDraggingProgress) {
                    // Update main progress bar and timer only if not dragging and not guarded
                    if (!isGuarded) {
                        updateUIWithTime(lastKnownCurrentTime);
                    }
                }
            }
            if (d.isPlaying !== undefined) {
                // Initial stabilization: If we just sent a command or just connected, 
                // trust the lastCommandSentTime guard more strictly for isPlaying too
                const isRecentlyCommanded = (Date.now() - lastCommandSentTime < 800);
                if (!isRecentlyCommanded) {
                    updatePlayPauseIcon(d.isPlaying);
                }
            }
            if (d.duration !== undefined) {
                updateTotalTime(d.duration);
            }

            if (d.playbackRate !== undefined) {
                const speedVal = d.playbackRate.toFixed(2) + 'x';
                const speedDisplay = document.getElementById('speed-display');
                const mainSpeedBadge = document.getElementById('main-speed-badge');
                const speedSlider = document.getElementById('speed-slider');

                if (speedDisplay) speedDisplay.textContent = speedVal;
                if (mainSpeedBadge) mainSpeedBadge.textContent = speedVal;
                if (speedSlider) speedSlider.value = d.playbackRate;
            }

            // Sync all UI components
            // Note: syncMarkersUI will respect Follow toggle internally
            syncMarkersUI();
            updateLoopVisuals();
        }
        else if (msg.action === 'UPDATE_LOOP_TIMES') {
            // Guard: ignore if we just set a loop point ourselves (within 500ms)
            const isRecentlySet = (Date.now() - lastCommandSentTime < 500);
            if (!isRecentlySet) {
                currentLoopStart = msg.start;
                currentLoopEnd = msg.end;
                currentLoopEnabled = msg.enabled;

                if (loopStart) loopStart.value = (msg.start !== null) ? formatTime(msg.start) : '0:00';
                if (loopEnd) loopEnd.value = (msg.end !== null) ? formatTime(msg.end) : '0:00';
            }

            updateLoopVisuals();
        }
        else if (msg.action === 'VIDEO_ENDED') {
            handleVideoEnded();
        }
        else if (msg.action === 'TIME_UPDATE') {
            // Only update time if it matches current video or if we are still uninitialized
            if (msg.videoId && currentVideoId && msg.videoId !== currentVideoId) return;

            const isGuarded = (Date.now() - lastCommandSentTime < 200);
            if (!isGuarded) {
                lastKnownCurrentTime = msg.currentTime;
                if (!isDraggingProgress) {
                    updateUIWithTime(msg.currentTime);
                }
                syncMarkersUI();
            }
        }
        else if (msg.action === 'PLAYBACK_STATUS') {
            // Only update if it matches current video to avoid race conditions during navigation
            if (msg.videoId === currentVideoId) {
                updatePlayPauseIcon(msg.playing);
            }
        }
        else if (msg.action === 'BOOKMARK_ADDED') {
            // CRITICAL: Block saving if videoId doesn't match to prevent data corruption
            if (msg.videoId && msg.videoId !== currentVideoId) {
                console.warn("[YT Study] Blocked bookmark addition: Video ID mismatch.", { msg: msg.videoId, current: currentVideoId });
                return;
            }

            const groupName = currentVideoData.activeGroup || "Default";
            if (!currentVideoData.tagGroups) currentVideoData.tagGroups = {};
            if (!currentVideoData.tagGroups[groupName]) currentVideoData.tagGroups[groupName] = [];

            if (!await canAddMarkerToGroup(groupName)) return;

            const groupTags = currentVideoData.tagGroups[groupName];
            const isDuplicate = groupTags.some(bm => Math.abs(bm.time - msg.time) < 0.05);

            if (!isDuplicate) {
                groupTags.push({ time: msg.time, label: '' });
                saveData();
                renderBookmarks(msg.time);
            } else {
                console.log(`[YT Study] Duplicate marker at ${msg.time} ignored.`);
                renderBookmarks(msg.time);
            }
        }
    });

    // Handle Restart from Content Script (Global Hotkey)
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'HOTKEY_RESTART') {
            const activeLi = document.querySelector('.bookmark-item.active-playing');
            if (activeLi) {
                const restartBtn = activeLi.querySelector('.bookmark-restart-btn');
                if (restartBtn) restartBtn.click();
            }
        }
    });

    // --- Sidebar Hotkeys ---
    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input/textarea
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

        const key = e.key.toLowerCase();

        // Mirror YouTube Native
        if (key === ' ' || key === 'k') {
            e.preventDefault();
            if (playPauseBtn) playPauseBtn.click();
        } else if (key === 'j') {
            e.preventDefault();
            sendMessage('SEEK_BY', { offset: -10 });
        } else if (key === 'l') {
            e.preventDefault();
            sendMessage('SEEK_BY', { offset: 10 });
        } else if (key === 'arrowleft') {
            e.preventDefault();
            sendMessage('SEEK_BY', { offset: -5 });
        } else if (key === 'arrowright') {
            e.preventDefault();
            sendMessage('SEEK_BY', { offset: 5 });
        } else if (key === 'r') {
            e.preventDefault();
            // Restart current highlighted marker
            const activeLi = document.querySelector('.bookmark-item.active-playing');
            if (activeLi) {
                const restartBtn = activeLi.querySelector('.bookmark-restart-btn');
                if (restartBtn) restartBtn.click();
            }
        } else if (key === 's') {
            e.preventDefault();
            const followToggle = document.getElementById('follow-playback-toggle');
            if (followToggle) {
                followToggle.checked = !followToggle.checked;
                // Manually trigger change event if needed, but sidebar usually listens to change
                followToggle.dispatchEvent(new Event('change'));
                log(`Follow Playback: ${followToggle.checked ? 'ENABLED' : 'DISABLED'}`, 'info');
            }
        } else if (key === '[' || key === '{') {
            e.preventDefault();
            if (e.altKey) {
                playPrevVideo();
            } else if (!isPlaylistMode) {
                if (e.shiftKey || key === '{') {
                    sendMessage('JUMP_LOOP_START');
                } else {
                    sendMessage('SET_LOOP_START');
                }
            }
        } else if (key === ']' || key === '}') {
            e.preventDefault();
            if (e.altKey) {
                playNextVideo();
            } else if (!isPlaylistMode) {
                if (e.shiftKey || key === '}') {
                    currentLoopEnabled = !currentLoopEnabled;
                    sendMessage('TOGGLE_LOOP', { enabled: currentLoopEnabled });
                    updateLoopVisuals();
                } else {
                    sendMessage('SET_LOOP_END');
                }
            }
        } else if (key === 'a') {
            e.preventDefault();
            sendMessage('ADD_BOOKMARK_REQUEST');
        } else if (key === ',' || key === '<') {
            // YouTube: < decreases speed, , seeks back 1 frame (approx)
            e.preventDefault();
            if (e.shiftKey) {
                // Decrease Speed
                const currentSpeed = parseFloat(document.getElementById('speed-slider')?.value || "1.0");
                const newSpeed = Math.max(0.25, currentSpeed - 0.05);
                sendMessage('SET_SPEED', { speed: newSpeed });
            } else {
                // Micro Seek Back (0.05s ~ 1 frame @ 20fps)
                sendMessage('SEEK_BY', { offset: -0.05 });
            }
        } else if (key === '.' || key === '>') {
            // YouTube: > increases speed, . seeks forward 1 frame
            e.preventDefault();
            if (e.shiftKey) {
                // Increase Speed
                const currentSpeed = parseFloat(document.getElementById('speed-slider')?.value || "1.0");
                const newSpeed = Math.min(3.0, currentSpeed + 0.05);
                sendMessage('SET_SPEED', { speed: newSpeed });
            } else {
                // Micro Seek Forward
                sendMessage('SEEK_BY', { offset: 0.05 });
            }
        } else if (key === 'arrowup' || key === 'arrowdown') {
            e.preventDefault();
            const listItems = Array.from(document.querySelectorAll('#bookmarks-list .bookmark-item'));
            if (listItems.length === 0) return;

            // 1. Find currently active marker index (the one with 'active-playing' class)
            // If none, find the one most recently passed by time
            let currentIndex = listItems.findIndex(li => li.classList.contains('active-playing'));
            if (currentIndex === -1) {
                const currentTime = lastKnownCurrentTime;
                currentIndex = listItems.findLastIndex(li => parseFloat(li.dataset.time) <= currentTime + 0.1);
            }

            // 2. Determine target index
            let targetIndex = currentIndex;
            if (key === 'arrowup') {
                targetIndex = (currentIndex === -1) ? listItems.length - 1 : Math.max(0, currentIndex - 1);
            } else {
                targetIndex = Math.min(listItems.length - 1, currentIndex + 1);
            }

            const targetLi = listItems[targetIndex];
            if (targetLi) {
                const targetTime = parseFloat(targetLi.dataset.time);
                if (!isNaN(targetTime)) {
                    // 3. Disable Follow Playback
                    const followToggle = document.getElementById('follow-playback-toggle');
                    if (followToggle && followToggle.checked) {
                        followToggle.checked = false;
                        followToggle.dispatchEvent(new Event('change'));
                        log("Follow Playback DISABLED for manual navigation", "info");
                    }

                    // 4. Seek Only
                    sendMessage('SEEK_TO', { time: targetTime });

                    // 5. Force UI update/scroll
                    lastKnownCurrentTime = targetTime;
                    syncMarkersUI(true);
                }
            }
        } else if (/^[0-9]$/.test(key)) {
            // 0-9 for 0% to 90%
            e.preventDefault();
            const percent = parseInt(key) * 10;
            if (lastKnownDuration > 0) {
                sendMessage('SEEK_TO', { time: lastKnownDuration * (percent / 100) });
            }
        }
    });

    // --- Focus Management ---
    // Prevent buttons/checkboxes from staying focused after click, 
    // ensuring 'Space' hotkey always defaults to playback control.
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button, input[type="checkbox"], input[type="radio"]');
        if (target && document.activeElement === target) {
            target.blur();
        }
    });

    // --- Shortcut Guide Logic ---
    const shortcutGuideBtn = document.getElementById('btn-shortcut-guide');
    const shortcutOverlay = document.getElementById('shortcut-overlay');
    const closeShortcutBtn = document.getElementById('close-shortcut-guide');

    if (shortcutGuideBtn && shortcutOverlay) {
        shortcutGuideBtn.addEventListener('click', () => {
            shortcutOverlay.style.display = 'flex';
        });
    }

    if (closeShortcutBtn && shortcutOverlay) {
        closeShortcutBtn.addEventListener('click', () => {
            shortcutOverlay.style.display = 'none';
        });
        // Close on background click
        shortcutOverlay.addEventListener('click', (e) => {
            if (e.target === shortcutOverlay) shortcutOverlay.style.display = 'none';
        });
    }

    // Helpers
    function formatTime(s) {
        if (isNaN(s)) return "0:00";
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
        return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
    }
    function pad(n) { return n.toString().padStart(2, '0'); }
    function parseTime(str) {
        const p = str.split(':').map(Number);
        if (p.some(isNaN)) return null;
        if (p.length === 1) return p[0];
        if (p.length === 2) return p[0] * 60 + p[1];
        if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
        return null;
    }

    // --- Standby / Connection Monitor ---
    const showStandby = (mode) => {
        let overlay = document.getElementById('standby-overlay');
        const container = document.getElementById('view-player');
        if (mode) {
            if (!overlay && container) {
                overlay = document.createElement('div');
                overlay.id = 'standby-overlay';
                overlay.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:9000;text-align:center;padding:20px;transition:opacity 0.2s;";
                container.style.position = 'relative'; // Ensure absolute child works
                container.appendChild(overlay);
            }
            if (overlay) {
                overlay.classList.remove('hidden');
                overlay.style.display = 'flex';
            }

            if (mode === 'HOME') {
                overlay.innerHTML = `
                    <div style="font-size:48px;margin-bottom:10px;">👋</div>
                    <div style="font-size:18px;font-weight:600;margin-bottom:8px;">Ready</div>
                    <div style="font-size:13px;color:#ccc;line-height:1.5;">
                        Select a video to start.<br>
                        <span style="font-size:11px;color:#888;display:block;margin-top:12px;border-top:1px solid #444;padding-top:8px;">
                            Controls active during playback
                        </span>
                    </div>
                `;
            } else {
                overlay.innerHTML = `
                    <div style="font-size:48px;margin-bottom:10px;">zzz</div>
                    <div style="font-size:16px;font-weight:600;">Standby Mode</div>
                    <div style="font-size:12px;color:#aaa;margin-top:5px;">Switch to a YouTube tab<br>to resume control.</div>
                `;
            }
        } else {
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = 'none';
            }
        }
    };

    // Monitor Active Tab
    let activeTabCheckTimeout;
    const checkActiveTab = async () => {
        // Debounce to prevent rapid firing during tab switch
        if (activeTabCheckTimeout) clearTimeout(activeTabCheckTimeout);

        activeTabCheckTimeout = setTimeout(async () => {
            try {
                // Check for passed tabId (Popout Lock)
                const urlParams = new URLSearchParams(window.location.search);
                const lockedTabId = urlParams.get('tabId');

                // Helper to determine status
                const determineStatus = (url) => {
                    if (!url) return 'SLEEP';
                    // Inclusive matching for video pages (watch, shorts, v, embed)
                    if (isYouTubeVideoUrl(url)) return 'WATCH';
                    if (isYouTubeUrl(url)) return 'HOME';
                    return 'SLEEP';
                };

                let targetTab = null;
                let status = 'SLEEP';

                if (lockedTabId) {
                    try {
                        targetTab = await chrome.tabs.get(parseInt(lockedTabId, 10));
                    } catch (e) { /* Tab might be closed */ }
                } else {
                    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
                    targetTab = t;
                }

                if (targetTab) {
                    status = determineStatus(targetTab.url);

                    if (status === 'WATCH') {
                        showStandby(false);
                        // Only update if we are NOT already connected to this tab
                        // This prevents resetting UI just because we checked again
                        if (!connectedTabId || connectedTabId !== targetTab.id) {
                            connectedTabId = targetTab.id;
                            console.log("Re-connecting to tab:", connectedTabId);
                            sendMessage('GET_STATUS');
                        }
                    } else {
                        // Only show standby if we are DEFINITELY not watching
                        // But for Side Panel, we might still want to keep "connectedTabId" valid 
                        // if the user just briefly switched away? 
                        // Actually, for Side Panel, if they switch tab, they ARE away.
                        // So showing standby is correct.
                        showStandby(status);
                    }
                } else {
                    showStandby('SLEEP');
                }

            } catch (e) { console.error(e); }
        }, 300); // 300ms debounce
    };

    // chrome.tabs.onActivated.addListener(checkActiveTab);
    // Monitor Tab Switching (Crucial for Persistent Side Panel)
    /*
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        // When user switches tab, check if it's a YouTube video and re-bind.
        // We delay slightly to ensure the tab is fully "active" in Chrome's internal state.
        setTimeout(() => {
            // Reset connection ID to allow establishing new connection
            connectedTabId = null;
            statusIndicator.classList.remove('connected');
            establishConnection();
        }, 100);
    });
    */

    // Monitor internal navigation (e.g. clicking related video) without treating it
    // as a browser tab switch. The content script will emit VIDEO_METADATA for the
    // new video; this is just a gentle status refresh for full page navigations.
    let connectedTabNavigationRefreshTimeout = null;
    chrome.tabs.onUpdated.addListener((id, info, tab) => {
        if (id !== connectedTabId) return;

        const nextUrl = info.url || tab?.url || '';
        if (nextUrl && !isYouTubeVideoUrl(nextUrl)) {
            establishConnection(true);
            return;
        }

        if (info.status === 'complete' || info.url) {
            if (connectedTabNavigationRefreshTimeout) {
                clearTimeout(connectedTabNavigationRefreshTimeout);
            }
            connectedTabNavigationRefreshTimeout = setTimeout(async () => {
                try {
                    await sendMessage('GET_STATUS');
                    checkActiveTabDetach();
                } catch (e) {
                    console.log('[YT Study] Navigation status refresh skipped:', e.message);
                }
            }, 250);
        }
    });

    // Initial Check

    // Reset State Helper
    function resetInternalState() {
        console.log('[YT Study] Resetting internal state...');
        currentVideoId = null;
        currentStorageKey = null; // CRITICAL: Stop updateHeader from using old key
        currentVideoData = createEmptyData(null, "Connecting...");
        isSyncing = false; // Release any old locks

        // Update UI via central renderers
        updateHeader();
        checkActiveTabDetach(); // Ensure state is checked on reset


        // Clear times and lists
        document.getElementById('time-current').textContent = "--:--";
        document.getElementById('time-total').textContent = "--:--";
        const list = document.getElementById('bookmarks-list');
        if (list) list.innerHTML = '';

        // Also reload library to clear active markers from potentially different videos
        loadLibrary();
    }

    // Init
    async function establishConnection(forceDiscovery = false) {
        if (forceDiscovery) connectedTabId = null;
        if (statusIndicator) statusIndicator.classList.remove('connected');

        // CRITICAL: Wipe old state immediately so we don't show phantom data
        resetInternalState();

        // 1. Check URL param (Popup Mode)
        const urlParams = new URLSearchParams(window.location.search);
        const passedId = urlParams.get('tabId');
        if (passedId) {
            const tid = parseInt(passedId, 10);
            try {
                await chrome.tabs.get(tid);
                connectedTabId = tid;
                console.log("Popup: Locked to Tab", tid);
            } catch (e) { console.log("Popup: Passed Tab Invalid"); }
        }

        // 2. Scan active tab in currentWindow
        if (!connectedTabId) {
            const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (t && isYouTubeVideoUrl(t.url)) {
                connectedTabId = t.id;
                log("Detecting YouTube video...", "info");
            }
        }

        // 2b. Scan active tab in ALL windows (fixes Edge Side Panel where currentWindow != YouTube window)
        if (!connectedTabId) {
            const allActive = await chrome.tabs.query({ active: true });
            const ytActive = allActive.find(t => isYouTubeVideoUrl(t.url));
            if (ytActive) {
                connectedTabId = ytActive.id;
                log("Detecting YouTube video (cross-window)...", "info");
            }
        }

        // 3. Scan Global if still null (Popup Fallback)
        if (!connectedTabId) {
            const tabs = await chrome.tabs.query({ url: YOUTUBE_VIDEO_QUERY_URLS });
            const active = tabs.find(t => t.active) || tabs[0];
            if (active) connectedTabId = active.id;
        }

        // 4. Initial Ping with retry
        if (connectedTabId) {
            // Try multiple times with short delays for better responsiveness
            const tryConnect = async (attempt = 0) => {
                try {
                    await sendMessage('GET_STATUS');
                    console.log('[YT Study] Connected to tab', connectedTabId);
                    refreshInitialState(); // Sync UI after connection
                    checkActiveTabDetach(); // Immediate check after connection
                } catch (e) {
                    if (attempt < 15) {
                        // Faster initial retry (50ms) for first 3 attempts, then backoff
                        const delay = attempt < 3 ? 50 : 100 * Math.pow(2, attempt - 3);

                        // Self-Healing: If we fail a few times, try to inject the script ourselves
                        // The user might have reloaded the tab or extension was reloaded
                        if (attempt === 2) {
                            console.log('[YT Study] Connection lagging, attempting to inject content script...');
                            document.getElementById('current-video-title').textContent = "Injecting Script...";
                            try {
                                await chrome.scripting.executeScript({
                                    target: { tabId: connectedTabId },
                                    files: ['content.js']
                                });
                            } catch (err) {
                                console.log("Injection failed (might already exist or no permission):", err);
                            }
                        }

                        setTimeout(() => tryConnect(attempt + 1), delay);
                    } else {
                        console.log('[YT Study] Connection timeout, content script may not be ready');
                        document.getElementById('current-video-title').textContent = "Connection Failed (Refresh Tab)";
                        statusIndicator.style.backgroundColor = 'var(--danger-color)';
                    }
                }
            };
            tryConnect();
        } else {
            console.log("No Video Tab Found");
            document.getElementById('current-video-title').textContent = "No Video Found";
            updateConnectionStrip({
                mode: 'disconnected',
                state: 'Disconnected',
                target: 'No YouTube video tab found'
            });
            showStandby('HOME'); // Restore instructions when orphaned
        }
    }

    establishConnection();

    function compactTabTitle(tab) {
        const title = (tab?.title || 'YouTube').replace(/\s+-\s+YouTube(?: Music)?$/, '').trim();
        return title.length > 46 ? `${title.substring(0, 43)}...` : title;
    }

    function formatTabTarget(tab) {
        if (!tab) return 'No controlled tab';
        return `W${tab.windowId} / T${tab.id}: ${compactTabTitle(tab)}`;
    }

    function updateConnectionStrip({ mode = 'disconnected', state = 'Disconnected', target = 'No controlled tab' } = {}) {
        const strip = document.getElementById('connection-strip');
        const stateEl = document.getElementById('connection-state');
        const targetEl = document.getElementById('connection-target');
        const tabEl = document.getElementById('tab-connection');
        if (!strip || !stateEl || !targetEl) return;

        strip.classList.remove('active', 'hidden-tab', 'remote', 'disconnected');
        strip.classList.add(mode);
        if (tabEl) {
            tabEl.classList.remove('connection-active', 'connection-hidden-tab', 'connection-remote', 'connection-disconnected');
            tabEl.classList.add(`connection-${mode}`);
            tabEl.title = `${state}: ${target}`;
        }
        stateEl.textContent = state;
        targetEl.textContent = target;
        targetEl.title = target;
    }

    async function focusControlledTab() {
        if (!connectedTabId) {
            updateConnectionStrip({
                mode: 'disconnected',
                state: 'Disconnected',
                target: 'No controlled tab to focus'
            });
            return;
        }

        const tab = await chrome.tabs.get(connectedTabId).catch(() => null);
        if (!tab) {
            connectedTabId = null;
            updateConnectionStrip({
                mode: 'disconnected',
                state: 'Disconnected',
                target: 'Controlled tab was closed'
            });
            return;
        }

        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true }).catch(() => { });
        setTimeout(checkActiveTabDetach, 100);
    }

    async function findActiveYouTubeTabForLock() {
        const lastFocused = await chrome.windows.getLastFocused({ populate: true }).catch(() => null);
        const focusedActive = lastFocused?.tabs?.find(t => t.active && isYouTubeVideoUrl(t.url));
        if (focusedActive) return focusedActive;

        const activeTabs = await chrome.tabs.query({ active: true });
        return activeTabs.find(t => isYouTubeVideoUrl(t.url) && t.id !== connectedTabId)
            || activeTabs.find(t => isYouTubeVideoUrl(t.url))
            || null;
    }

    async function lockToCurrentYouTubeTab() {
        const tab = await findActiveYouTubeTabForLock();
        if (!tab) {
            updateConnectionStrip({
                mode: connectedTabId ? 'remote' : 'disconnected',
                state: connectedTabId ? 'Still Locked' : 'Disconnected',
                target: 'No active YouTube video tab found to lock'
            });
            return;
        }

        connectedTabId = tab.id;
        console.log('[YT Study] Locked to current YouTube tab:', connectedTabId);
        updateConnectionStrip({
            mode: 'active',
            state: 'Locked',
            target: formatTabTarget(tab)
        });
        establishConnection(false);
    }

    /**
     * Tab Detach Logic: Highlight title if user switches away from controlled tab
     */
    async function checkActiveTabDetach() {
        if (!connectedTabId) {
            const titleEl = document.getElementById('current-video-title');
            titleEl?.classList.remove('detached', 'remote');
            updateTabBanners(false, false, null, null);
            updateConnectionStrip({
                mode: 'disconnected',
                state: 'Disconnected',
                target: 'No controlled tab'
            });
            return;
        }

        try {
            const controlledTab = await chrome.tabs.get(connectedTabId);
            const [activeInControlledWindow] = await chrome.tabs.query({
                active: true,
                windowId: controlledTab.windowId
            });
            const currentWin = await chrome.windows.getCurrent().catch(() => null);

            const titleEl = document.getElementById('current-video-title');
            if (!titleEl) return;

            const isCurrentTabYouTube = activeInControlledWindow &&
                activeInControlledWindow.id !== connectedTabId &&
                isYouTubeVideoUrl(activeInControlledWindow.url);

            // Step 1: Controlled window check. Query the active tab from the
            // YouTube tab's own window so side-panel/popup windows do not cause
            // false "tab switched" warnings during normal YouTube SPA navigation.
            if (activeInControlledWindow && activeInControlledWindow.id === connectedTabId) {
                titleEl.classList.remove('detached', 'remote');
                titleEl.title = currentVideoData?.title || "";
                updateTabBanners(false, false, null, null);
                updateConnectionStrip({
                    mode: 'active',
                    state: 'Active Tab',
                    target: formatTabTarget(controlledTab)
                });
            } else if (!currentWin || controlledTab.windowId === currentWin.id) {
                titleEl.classList.remove('remote');
                if (activeInControlledWindow && activeInControlledWindow.id !== connectedTabId) {
                    titleEl.classList.add('detached'); // Amber
                    titleEl.title = "Warning: Controlled Video is on a hidden tab in this window.";
                    updateTabBanners(true, isCurrentTabYouTube, activeInControlledWindow, controlledTab);
                    updateConnectionStrip({
                        mode: 'hidden-tab',
                        state: 'Hidden Tab',
                        target: formatTabTarget(controlledTab)
                    });
                } else {
                    titleEl.classList.remove('detached');
                    titleEl.title = currentVideoData?.title || "";
                    updateTabBanners(false, false, null, null);
                    updateConnectionStrip({
                        mode: 'active',
                        state: 'Controlled',
                        target: formatTabTarget(controlledTab)
                    });
                }
            }
            // Step 2: Different Window Check (Pop-out / Dual Monitor Usage)
            else {
                titleEl.classList.remove('detached');
                titleEl.classList.add('remote'); // Blue
                titleEl.title = "Connected to Video in another window (Remote Mode)";
                updateTabBanners(true, false, null, controlledTab);
                updateConnectionStrip({
                    mode: 'remote',
                    state: 'Remote Window',
                    target: formatTabTarget(controlledTab)
                });
            }
        } catch (e) {
            console.warn("[YT Study] Detach check failed:", e);
            updateConnectionStrip({
                mode: 'disconnected',
                state: 'Check Failed',
                target: e.message || 'Unable to inspect controlled tab'
            });
        }
    }

    /**
     * Update the detach banner and relink button in the player view
     */
    function updateTabBanners(showDetachBanner, showRelinkBtn, activeTab, controlledTab = null) {
        const playerView = document.getElementById('view-player');
        if (!playerView) return;

        // --- Detach Banner (Feature 1: Switch back to YouTube tab) ---
        let detachBanner = document.getElementById('tab-detach-banner');
        if (showDetachBanner) {
            if (!detachBanner) {
                detachBanner = document.createElement('div');
                detachBanner.id = 'tab-detach-banner';
                detachBanner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(255,180,0,0.15);border:1px solid rgba(255,180,0,0.4);color:#ffb400;font-size:11px;padding:6px 8px;border-radius:6px;margin:6px 8px 0;cursor:pointer;user-select:none;';
                playerView.insertBefore(detachBanner, playerView.firstChild);
            }
            const targetTitle = controlledTab ? compactTabTitle(controlledTab) : 'YouTube tab';
            detachBanner.innerHTML = `
                <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">&#x25B6; Switch back: "${targetTitle}"</span>
                <span style="display:flex;gap:4px;flex-shrink:0;">
                    <button class="tab-detach-action tab-detach-focus" title="Focus controlled tab">Focus</button>
                    <button class="tab-detach-action tab-detach-lock" title="Lock to current active YouTube tab">Lock Current</button>
                </span>
            `;
            detachBanner.onclick = () => {
                focusControlledTab().catch(err => console.warn('[YT Study] Focus controlled tab failed:', err));
            };
            detachBanner.querySelector('.tab-detach-focus')?.addEventListener('click', (e) => {
                e.stopPropagation();
                focusControlledTab().catch(err => console.warn('[YT Study] Focus controlled tab failed:', err));
            });
            detachBanner.querySelector('.tab-detach-lock')?.addEventListener('click', (e) => {
                e.stopPropagation();
                lockToCurrentYouTubeTab().catch(err => console.warn('[YT Study] Lock current tab failed:', err));
            });
            detachBanner.style.display = 'flex';
        } else if (detachBanner) {
            detachBanner.style.display = 'none';
        }

        // --- Relink Button (Feature 2: Link to current YouTube tab) ---
        let relinkBtn = document.getElementById('tab-relink-btn');
        if (showRelinkBtn && activeTab) {
            if (!relinkBtn) {
                relinkBtn = document.createElement('div');
                relinkBtn.id = 'tab-relink-btn';
                relinkBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(62,166,255,0.12);border:1px solid rgba(62,166,255,0.35);color:var(--accent-color);font-size:11px;padding:6px 10px;border-radius:6px;margin:4px 8px 0;cursor:pointer;user-select:none;';
                playerView.insertBefore(relinkBtn, playerView.firstChild);
            }
            const tabTitle = (activeTab.title || 'YouTube').substring(0, 40);
            relinkBtn.innerHTML = '<span>&#x1F517;</span><span>Link to current YouTube tab: "' + tabTitle + '"</span>';
            relinkBtn.onclick = async () => {
                connectedTabId = activeTab.id;
                console.log('[YT Study] Re-linked to tab:', connectedTabId);
                updateTabBanners(false, false, null);
                establishConnection(false);
            };
            relinkBtn.style.display = 'flex';
            if (detachBanner && detachBanner.nextSibling !== relinkBtn) {
                playerView.insertBefore(relinkBtn, detachBanner.nextSibling);
            }
        } else if (relinkBtn) {
            relinkBtn.style.display = 'none';
        }
    }

    document.getElementById('btn-focus-controlled-tab')?.addEventListener('click', () => {
        focusControlledTab().catch(err => {
            console.warn('[YT Study] Focus controlled tab failed:', err);
            updateConnectionStrip({
                mode: 'disconnected',
                state: 'Focus Failed',
                target: err.message || 'Unable to focus controlled tab'
            });
        });
    });

    document.getElementById('btn-lock-current-tab')?.addEventListener('click', () => {
        lockToCurrentYouTubeTab().catch(err => {
            console.warn('[YT Study] Lock current tab failed:', err);
            updateConnectionStrip({
                mode: 'disconnected',
                state: 'Lock Failed',
                target: err.message || 'Unable to lock current YouTube tab'
            });
        });
    });

    // Monitor Tab Switching
    chrome.tabs.onActivated.addListener(() => {
        // Slight delay to allow tab state to settle
        setTimeout(checkActiveTabDetach, 100);
    });

    // Monitor controlled tab closure so stale UI state is cleared immediately.
    chrome.tabs.onRemoved.addListener((tabId) => {
        if (tabId !== connectedTabId) return;

        console.log('[YT Study] Controlled tab closed:', tabId);
        connectedTabId = null;
        if (statusIndicator) {
            statusIndicator.classList.remove('connected');
            statusIndicator.title = "Disconnected (Controlled tab closed)";
        }
        updateTabBanners(false, false, null);
        establishConnection(true);
    });

    // Monitor Window Focus (Handle multi-window setups)
    chrome.windows.onFocusChanged.addListener((winId) => {
        if (winId !== chrome.windows.ID_NONE) {
            setTimeout(checkActiveTabDetach, 100);
        }
    });


    /* --- Storage Usage Monitoring --- */
    async function updateStorageUsage() {
        if (!chrome || !chrome.storage || !chrome.storage.sync || !chrome.storage.sync.getBytesInUse) return;

        const bars = [document.getElementById('sync-usage-bar'), document.getElementById('fav-sync-usage-bar')];
        const texts = [document.getElementById('sync-usage-text'), document.getElementById('fav-sync-usage-text')];

        chrome.storage.sync.get(null, (all) => {
            const summary = summarizeSyncData(all);
            let libraryCount = 0;
            let favoritesCount = 0;
            const groupCount = summary.groupCount;
            const bytes = JSON.stringify(all).length; // Rough estimate if getBytesInUse fails

            Object.keys(all).forEach(key => {
                if (key.startsWith('v_')) {
                    const video = all[key];
                    if (video.isSaved) {
                        libraryCount++;
                        const favGroups = video.favoriteGroups || [];
                        if ((favGroups.length > 0) || video.isDefault) {
                            favoritesCount++;
                        }
                    }
                }
            });

            // Update Item Counts
            const favCountEl = document.getElementById('stats-favorites-count');
            const libCountEl = document.getElementById('stats-library-count');
            if (favCountEl) favCountEl.textContent = favoritesCount;
            if (libCountEl) libCountEl.textContent = libraryCount;

            // Update Storage Bar
            chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
                const usedBytes = bytesInUse || bytes;
                const quota = chrome.storage.sync.QUOTA_BYTES || 102400;
                const percent = Math.min(100, Math.ceil((usedBytes / quota) * 100));

                bars.forEach(bar => {
                    if (bar) {
                        bar.style.width = percent + '%';
                        if (percent < 70) bar.style.backgroundColor = 'var(--success-color)';
                        else if (percent < 90) bar.style.backgroundColor = 'var(--warning-color)';
                        else bar.style.backgroundColor = 'var(--danger-color)';
                    }
                });

                texts.forEach(text => {
                    if (text) text.textContent = `${percent}% Used | ${libraryCount} videos | ${groupCount} groups`;
                });
            });
        });
    }

    /**
     * Auto-cleanup Library items (Limit: 200)
     * Rule: Deletes oldest items that are NOT in any Library Group
     */
    async function cleanupOldUnfavoriteItems() {
        try {
            const all = await chrome.storage.sync.get(null);
            const items = [];

            Object.keys(all).forEach(key => {
                if (key.startsWith('v_')) {
                    const video = all[key];
                    const inFav = video.favoriteGroups && video.favoriteGroups.length > 0;
                    items.push({ key, updatedAt: video.updatedAt || 0, inFav });
                }
            });

            if (items.length < 200) return;

            // Sort by age (oldest first)
            items.sort((a, b) => a.updatedAt - b.updatedAt);

            // Filter out favorites
            const candidates = items.filter(i => !i.inFav);

            // If we have more than 200 total items, start deleting candidates from oldest
            let toDelete = items.length - 200 + 1; // Delete one extra space for the current new video
            if (toDelete <= 0) return;

            const selectedForDeletion = candidates.slice(0, toDelete).map(c => c.key);

            if (selectedForDeletion.length > 0) {
                console.log(`[YT Study] Auto-cleanup: Removing ${selectedForDeletion.length} oldest un-favorited items.`);
                await chrome.storage.sync.remove(selectedForDeletion);
            }
        } catch (e) {
            console.error("Cleanup failed", e);
        }
    }

} catch (e) { console.error(e); }
