// sidebar.js

const debugConsole = document.getElementById('debug-console');
const debugLogs = document.getElementById('debug-logs');

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

    function createEmptyData(id = null, title = "Unknown") {
        return {
            id: id,
            title: title,
            thumbnail: "",
            isSaved: false,
            isDefault: false,
            createdAt: 0,
            updatedAt: 0,
            profileName: "New Session",
            activeGroup: "Default",
            tagGroups: { "Default": [], "Study": [], "Cust. A": [], "Cust. B": [] },
            duration: 0
        };
    }

    // --- Elements ---
    const views = {
        player: document.getElementById('view-player'),
        library: document.getElementById('view-library'),
        favorites: document.getElementById('view-favorites')
    };
    const navs = {
        player: document.getElementById('nav-player'),
        library: document.getElementById('nav-library'),
        favorites: document.getElementById('nav-favorites')
    };

    // Controls
    const playPauseBtn = document.getElementById('play-pause');
    const progressBar = document.getElementById('progress-bar');

    // Icons
    const ICON_PLAY = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
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

    // --- Navigation ---
    function switchView(viewName) {
        Object.keys(views).forEach(k => {
            if (views[k]) views[k].style.display = (k === viewName) ? 'flex' : 'none';
        });
        Object.keys(navs).forEach(k => {
            if (navs[k]) navs[k].classList.toggle('active', k === viewName);
        });

        if (viewName === 'library') loadLibrary();
        if (viewName === 'favorites') loadFavorites();
    }

    if (navs.player) navs.player.addEventListener('click', () => switchView('player'));
    if (navs.library) navs.library.addEventListener('click', () => switchView('library'));
    if (navs.favorites) navs.favorites.addEventListener('click', () => switchView('favorites'));

    // Show Player view by default on startup
    switchView('player');

    // --- Player Sub-Panels ---
    const subPanels = {
        markers: document.getElementById('panel-markers'),
        controls: document.getElementById('panel-controls')
    };
    const subTabs = {
        markers: document.getElementById('tab-markers'),
        controls: document.getElementById('tab-controls')
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
    if (subTabs.controls) subTabs.controls.addEventListener('click', () => switchSubPanel('controls'));

    // --- Pop Out Logic ---
    const popOutBtn = document.getElementById('nav-popout');
    if (popOutBtn) {
        chrome.windows.getCurrent((win) => {
            if (win.type === 'popup') {
                popOutBtn.style.display = 'none';
            }
        });

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
            // Close if active
            if (activePopupId) {
                try { await chrome.windows.remove(activePopupId); } catch (e) { }
                activePopupId = null;
                updateBtnState();
                return;
            }

            // Find current target tab to pass
            let targetId = connectedTabId;
            if (!targetId) {
                // Determine current active tab in this window
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
                updateBtnState();

                // Reset state when closed externally
                const onRemoved = (winId) => {
                    if (winId === activePopupId) {
                        activePopupId = null;
                        updateBtnState();
                        chrome.windows.onRemoved.removeListener(onRemoved);
                    }
                };
                chrome.windows.onRemoved.addListener(onRemoved);

                // Auto Close on Sidebar Unload (Keep this preference)
                const closePopup = () => {
                    try { chrome.windows.remove(win.id); } catch (e) { }
                };
                window.addEventListener('unload', closePopup);
            });
        });
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

    async function sendMessage(action, payload = {}, retryCount = 0) {
        log(`Command: ${action}`);
        try {
            let targetTabId = null;

            if (connectedTabId) {
                targetTabId = connectedTabId;
            }

            if (!targetTabId) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.url.includes('youtube.com/watch')) {
                    targetTabId = tab.id;
                }
            }

            if (!targetTabId) {
                const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/watch*" });
                const active = tabs.find(t => t.active) || tabs[0];
                if (active) targetTabId = active.id;
            }

            if (!targetTabId) {
                statusIndicator.classList.remove('connected');
                statusIndicator.title = "Disconnected (No YT Video)";
                return { success: false, error: 'No target tab' };
            }

            connectedTabId = targetTabId;
            statusIndicator.classList.add('connected');
            statusIndicator.title = `Connected to Tab: ${targetTabId}`;

            // Send message and AWAIT response (Confirmation)
            const response = await chrome.tabs.sendMessage(targetTabId, { action, ...payload });

            if (response && response.success) {
                log(`Confirmed: ${action}`, 'success');
                return response;
            } else {
                throw new Error(response ? response.error : 'No response');
            }

        } catch (error) {
            log(`Retry ${retryCount + 1}: ${action} (${error.message})`, 'error');

            if (retryCount < 2) { // 3 tries total
                const delay = 50 * (retryCount + 1);
                await new Promise(r => setTimeout(r, delay));
                return sendMessage(action, payload, retryCount + 1);
            }

            log(`FATAL: ${action} failed after retries`, 'error');
            statusIndicator.classList.remove('connected');
            connectedTabId = null;
            throw error;
        }
    }

    // --- Logic ---
    function updatePlayPauseIcon(playing) {
        // Command Guard: Ignore status updates for 200ms after user action to prevent flickering
        if (Date.now() - lastCommandSentTime < 200) return;

        isCurrentlyPlaying = playing;
        if (playPauseBtn) {
            playPauseBtn.innerHTML = isCurrentlyPlaying ? ICON_PAUSE : ICON_PLAY;
        }
        syncMarkersUI();
    }

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', async () => {
            lastCommandSentTime = Date.now();
            const originalState = isCurrentlyPlaying;
            const nextPlayingState = !isCurrentlyPlaying;
            const action = nextPlayingState ? 'PLAY_VIDEO' : 'PAUSE_VIDEO';

            // Speculative update for immediate feedback
            isCurrentlyPlaying = nextPlayingState;
            playPauseBtn.innerHTML = isCurrentlyPlaying ? ICON_PAUSE : ICON_PLAY;
            syncMarkersUI(true);

            try {
                await sendMessage(action);
            } catch (err) {
                // Revert if it fails
                isCurrentlyPlaying = originalState;
                playPauseBtn.innerHTML = isCurrentlyPlaying ? ICON_PAUSE : ICON_PLAY;
                syncMarkersUI(true);
            }
        });
    }

    // Transport
    document.getElementById('restart-btn')?.addEventListener('click', () => sendMessage('SEEK_TO', { time: 0 }));
    document.getElementById('rwd-btn')?.addEventListener('click', () => sendMessage('SEEK_BY', { offset: -10 }));
    document.getElementById('fwd-btn')?.addEventListener('click', () => sendMessage('SEEK_BY', { offset: 10 }));

    // Speed
    const speedSlider = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-display');
    speedSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        if (speedDisplay) speedDisplay.textContent = val + 'x';
        sendMessage('SET_SPEED', { speed: parseFloat(val) });
    });
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.speed;
            speedSlider.value = val;
            speedDisplay.textContent = val + 'x';
            sendMessage('SET_SPEED', { speed: parseFloat(val) });
            // Optional: Auto-expand if set via presets somehow? Usually already expanded.
        });
    });

    // --- Accordions (Collapsible Sections) ---
    const speedHeader = document.getElementById('speed-header');
    const speedContent = document.getElementById('speed-content');
    const speedChevron = document.getElementById('speed-chevron');

    if (speedHeader && speedContent) {
        speedHeader.addEventListener('click', () => {
            const isExpanding = speedContent.classList.contains('collapsed');
            setSpeedAccordionState(isExpanding);
        });
    }

    function setSpeedAccordionState(expand) {
        if (speedContent && speedChevron) {
            if (expand) {
                speedContent.classList.remove('collapsed');
                speedChevron.style.transform = 'rotate(90deg)';
            } else {
                speedContent.classList.add('collapsed');
                speedChevron.style.transform = 'rotate(0deg)';
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
            chrome.storage.sync.set({ followMarkers: e.target.checked });
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

    document.getElementById('add-bookmark')?.addEventListener('click', () => sendMessage('ADD_BOOKMARK_REQUEST'));
    // btn-export/import removed in Pro-Mode

    const libFileImport = document.getElementById('lib-file-import');
    document.getElementById('lib-btn-import')?.addEventListener('click', () => libFileImport?.click());
    libFileImport?.addEventListener('change', importVideoData);

    // --- Auto Detect Button (Force Sync) ---
    document.getElementById('btn-detect-video')?.addEventListener('click', async () => {
        // Visual Feedback
        const btn = document.getElementById('btn-detect-video');
        const origColor = btn.style.color;
        btn.style.color = 'var(--accent-color)';
        setTimeout(() => btn.style.color = origColor, 500);

        // Force Hard Re-connection to Active Tab
        console.log("[YT Study] Manual Auto-Detect triggered: Forcing re-connection...");
        currentVideoId = null; // This ensures the incoming metadata triggers 'isNewVideo' logic
        establishConnection(true);
    });

    // --- Clone Button ---
    document.getElementById('btn-clone-session')?.addEventListener('click', async () => {
        if (!currentVideoId) return;
        const clone = JSON.parse(JSON.stringify(currentVideoData));
        const now = Date.now();
        clone.isSaved = true;
        clone.isDefault = false;
        clone.createdAt = now;
        clone.updatedAt = now;
        const newKey = `v_${currentVideoId}_${now}`;
        await chrome.storage.sync.set({ [newKey]: clone });
        const all = await chrome.storage.sync.get(null);
        updateDataCache(all, currentVideoId);
        currentVideoData = clone;
        currentStorageKey = newKey;
        updateHeader();
        loadLibrary();
        const btn = document.getElementById('btn-clone-session');
        const origColor = btn.style.color;
        btn.style.color = '#4cc713';
        setTimeout(() => btn.style.color = origColor, 1000);
    });

    // --- Set Default Button ---
    document.getElementById('btn-set-default')?.addEventListener('click', async () => {
        if (!currentStorageKey || !currentVideoId) return;

        // Toggle
        const newValue = !currentVideoData.isDefault;
        currentVideoData.isDefault = newValue;

        if (newValue) {
            // Unset others
            const all = await chrome.storage.sync.get(null);
            const related = Object.keys(all).filter(k => k.startsWith('v_' + currentVideoId));
            const updates = {};
            related.forEach(k => {
                if (k !== currentStorageKey && all[k].isDefault) {
                    all[k].isDefault = false;
                    updates[k] = all[k];
                }
            });
            if (Object.keys(updates).length > 0) {
                await chrome.storage.sync.set(updates);
            }
        }

        saveData();
    });

    // --- Core Data Logic ---
    let cachedRelatedKeys = [];
    let cachedAllData = {};

    function updateDataCache(allData, videoId) {
        cachedAllData = allData;
        cachedRelatedKeys = Object.keys(allData).filter(k => k.startsWith('v_' + videoId));
    }

    // 1. Init New Session (Detached)
    async function initNewVideoSession(videoId, initialData = {}) {
        currentVideoId = videoId;
        currentStorageKey = null; // Detached

        currentVideoData = createEmptyData(videoId, initialData.title || "Loading...");
        currentVideoData.thumbnail = initialData.thumbnail || "";

        const allData = await chrome.storage.sync.get(null);
        updateDataCache(allData, videoId);

        updateHeader();
        renderBookmarks();
    }

    // 2. Load Specific Profile (Connected)
    async function loadStorageFavorite(key) {
        const res = await chrome.storage.sync.get(key);
        if (res[key]) {
            currentVideoData = res[key];
            currentStorageKey = key;
            currentVideoId = currentVideoData.id;

            migrateDataIfNeeded(key, currentVideoId);

            const allData = await chrome.storage.sync.get(null);
            updateDataCache(allData, currentVideoId);

            updateHeader();
            renderBookmarks();
            loadLibrary();
            loadFavorites();
        }
    }

    function migrateDataIfNeeded(key, videoId) {
        let changed = false;
        if (!currentVideoData.tagGroups) {
            currentVideoData.tagGroups = { "Default": [], "Study": [], "Cust. A": [], "Cust. B": [] };
            if (currentVideoData.bookmarks) currentVideoData.tagGroups["Default"] = [...currentVideoData.bookmarks];
            delete currentVideoData.bookmarks;
            changed = true;
        }
        if (!currentVideoData.activeGroup) { currentVideoData.activeGroup = "Default"; changed = true; }

        if (!currentVideoData.createdAt) {
            currentVideoData.createdAt = currentVideoData.updatedAt || Date.now();
            changed = true;
        }

        groupSelector.value = currentVideoData.activeGroup;
        if (changed) saveData();
    }

    async function saveData() {
        if (!currentStorageKey) {
            if (!currentVideoId) return;
            currentStorageKey = `v_${currentVideoId}_${Date.now()}`;
            currentVideoData.isSaved = true;
            currentVideoData.createdAt = Date.now();
        }

        currentVideoData.updatedAt = Date.now();
        await chrome.storage.sync.set({ [currentStorageKey]: currentVideoData });
        updateStorageUsage();

        const heartBtn = document.getElementById('toggle-library-save');
        if (heartBtn) heartBtn.classList.toggle('active', !!currentVideoData.isSaved);

        if (currentVideoId) {
            const all = await chrome.storage.sync.get(null);
            updateDataCache(all, currentVideoId);
            updateHeader();
        }
        loadLibrary();
        loadFavorites();
    }

    // --- UI Header ---
    function updateHeader() {
        const titleContainer = document.getElementById('current-video-title');
        const heartBtn = document.getElementById('toggle-library-save');
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

        const titleSpan = document.createElement('span');
        titleSpan.textContent = currentVideoData.title || "Unknown Video";
        titleContainer.appendChild(titleSpan);

        if (heartBtn) {
            heartBtn.className = 'icon-btn small-btn';
            if (currentVideoData.isSaved) heartBtn.classList.add('active');
        }

        if (defaultBtn) {
            defaultBtn.className = 'icon-btn small-btn';
            if (currentVideoData.isDefault) {
                defaultBtn.classList.add('active');
                defaultBtn.style.color = '#ffca28'; // Gold
            } else {
                defaultBtn.style.color = '';
            }
        }
    }

    document.getElementById('toggle-library-save')?.addEventListener('click', () => {
        if (currentVideoData.isSaved) {
            if (confirm("Remove this session from Library?")) {
                // Delete
                chrome.storage.sync.remove(currentStorageKey).then(async () => {
                    initNewVideoSession(currentVideoId, { title: currentVideoData.title, thumbnail: currentVideoData.thumbnail });
                    loadLibrary();
                    loadFavorites();
                });
            }
        } else {
            // Save
            currentVideoData.isSaved = true;
            saveData();
        }
    });

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

    if (btnGlobalExport) {
        btnGlobalExport.addEventListener('click', async () => {
            const allData = await chrome.storage.sync.get(null);
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            triggerDownload(dataStr, `yt_studio_backup_${timestamp}.json`);
            log("Backup Created", "success");
        });
    }

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
                        await chrome.storage.sync.set(data);
                        log("All Data Restored!", "success");
                        loadLibrary();
                        loadFavorites();
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

                await chrome.storage.sync.set({ [saveKey]: jsonObj });

                const all = await chrome.storage.sync.get(null);
                updateDataCache(all, currentVideoId);
                loadLibrary();
                alert("Import Successful!");
            } catch (err) { alert("Invalid JSON"); }
            e.target.value = '';
        };
        reader.readAsText(file);
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
                sendMessage('SET_LOOP_START', { time: time });
                setLoopAccordionState(true);
            }
            // 4. Set B Button
            else if (e.target.closest('.set-b')) {
                sendMessage('SET_LOOP_END', { time: time });
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
        const container = document.getElementById('library-list');
        if (!container) return;
        updateStorageUsage();
        container.innerHTML = 'Loading...';
        const all = await chrome.storage.sync.get(null);
        let items = [];
        Object.keys(all).forEach(key => { if (key.startsWith('v_') && all[key].isSaved) items.push({ ...all[key], _key: key }); });

        if (items.length === 0) {
            container.innerHTML = '<p style="padding:20px;text-align:center;color:#666">No saved videos.</p>';
            return;
        }

        // Standard Chronological Sort
        items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        renderList(container, items);
    }

    // --- Favorites Logic ---
    async function loadFavorites() {
        const container = document.getElementById('favorites-list');
        if (!container) return;
        container.innerHTML = 'Loading...';
        const all = await chrome.storage.sync.get(null);
        let items = [];
        Object.keys(all).forEach(key => { if (key.startsWith('v_') && all[key].isSaved && all[key].isDefault) items.push({ ...all[key], _key: key }); });

        if (items.length === 0) {
            container.innerHTML = '<p style="padding:20px;text-align:center;color:#666">No favorite videos set.</p>';
            return;
        }

        items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        renderList(container, items);
    }

    function renderList(container, items) {
        container.innerHTML = '';
        items.forEach(v => {
            const el = document.createElement('div');
            el.className = 'library-item';
            if (v._key === currentStorageKey) el.classList.add('active');

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

            el.innerHTML = `
                <img src="${thumbSrc}" class="library-thumb" onerror="this.style.display='none'">
                <div class="library-info">
                    <div class="library-title" title="${v.title}">
                        ${v.title || 'Untitled'}
                    </div>
                    <div class="library-meta" style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:10px; color:#888;">${metaLabel} • ${count} markers</span>
                        <button class="icon-btn small-action export-item-btn" title="Export" style="width:20px;height:20px;font-size:10px;">⬇</button>
                    </div>
                </div>
                <button class="delete-btn">×</button>
            `;

            el.addEventListener('click', async (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    // Visual Feedback & Immediate State Clean
                    showStandby(false);
                    document.getElementById('current-video-title').textContent = "Opening YouTube...";

                    const vid = v.id || v.videoId; // Fallback for safety
                    if (!vid) {
                        log("Error: Missing Video ID for library item", "error");
                        return;
                    }

                    // Set Intention
                    await chrome.storage.local.set({ [`pending_nav_${vid}`]: v._key });

                    // Optimistic Load (Wait for data lookup)
                    await loadStorageFavorite(v._key);

                    // Switch Video Logic
                    let targetId = connectedTabId;
                    if (!targetId) {
                        const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
                        // Only use active tab if it's already a YouTube page or a safe replacable page
                        if (t && (t.url.includes('youtube.com') || t.url.includes('chrome://newtab') || t.url === 'about:blank')) {
                            targetId = t.id;
                        }
                    }

                    if (targetId) {
                        const t = await chrome.tabs.get(targetId).catch(() => null);
                        if (t) {
                            connectedTabId = targetId; // Bind immediately
                            if (!t.url.includes(vid)) {
                                chrome.tabs.update(targetId, { url: `https://youtube.com/watch?v=${vid}`, active: true });
                            } else {
                                await loadStorageFavorite(v._key);
                                chrome.storage.local.remove(`pending_nav_${vid}`);
                            }
                        } else {
                            // Target closed, create new
                            const newTab = await chrome.tabs.create({ url: `https://youtube.com/watch?v=${vid}` });
                            connectedTabId = newTab.id; // Bind immediately
                        }
                    } else {
                        // No suitable tab to replace, create new
                        const newTab = await chrome.tabs.create({ url: `https://youtube.com/watch?v=${vid}` });
                        connectedTabId = newTab.id; // Bind immediately
                    }

                    // Start the discovery process for the new tab
                    establishConnection();

                    switchView('player');
                }
            });

            el.querySelector('.delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Delete this save?')) {
                    await chrome.storage.sync.remove(v._key);
                    const all = await chrome.storage.sync.get(null);
                    if (currentStorageKey === v._key) {
                        initNewVideoSession(currentVideoId, { title: v.title, thumbnail: v.thumbnail });
                    }
                    loadLibrary();
                    loadFavorites();
                }
            });
            el.querySelector('.export-item-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                exportVideoFull(v);
            });
            container.appendChild(el);
        });
    }

    // --- State Sync (Multi-Window) ---
    // --- State Sync (Multi-Window) ---
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'sync') return;

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
        if (shouldRefreshFav) loadFavorites();

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
            const isYT = sender.tab && (sender.tab.url.includes('youtube.com/watch') || sender.tab.url.includes('/shorts/') || sender.tab.url.includes('/v/'));

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
            // Redundant safety check: ensure we are not processing data from a different video ID 
            // naturally, if tab ID matches, video ID should match, but race conditions exist on navigation.

            const isNewVideo = d.videoId !== currentVideoId;
            const isUninitialized = currentVideoId === null;

            if (isNewVideo || (d.title && d.title !== "YouTube" && currentVideoData.title !== d.title)) {
                // Keep ID updated immediately
                currentVideoId = d.videoId;

                // --- Smart Load Logic ---
                if (isNewVideo || isUninitialized) {
                    if (isSyncing) return; // Wait for current sync to finish

                    // 1. Check Pending Navigation (User clicked specific profile)
                    const pendingKey = `pending_nav_${d.videoId}`;
                    const localData = await chrome.storage.local.get(pendingKey);

                    if (localData[pendingKey]) {
                        console.log("Loading Pending Favorite:", localData[pendingKey]);
                        isSyncing = true;
                        await loadStorageFavorite(localData[pendingKey]);
                        chrome.storage.local.remove(pendingKey); // Clear
                        isSyncing = false;
                    } else {
                        // 2. Auto Detect (Default or Recent)
                        const all = await chrome.storage.sync.get(null);
                        const related = [];
                        Object.keys(all).forEach(k => {
                            if (k.startsWith('v_' + d.videoId) && all[k].isSaved) {
                                related.push({ ...all[k], _key: k });
                            }
                        });

                        if (related.length > 0) {
                            // Sort: Default > Recent
                            related.sort((a, b) => {
                                if (a.isDefault && !b.isDefault) return -1;
                                if (!a.isDefault && b.isDefault) return 1;
                                return (b.updatedAt || 0) - (a.updatedAt || 0);
                            });
                            console.log("Auto-Detected Favorite:", related[0]._key);
                            log(`Auto-detected: ${related[0].title || 'video'}`, 'success');
                            isSyncing = true;
                            await loadStorageFavorite(related[0]._key);
                            isSyncing = false;
                        } else {
                            // 3. New Session
                            log(`New session: ${d.title}`, 'info');
                            initNewVideoSession(d.videoId, { title: d.title, thumbnail: d.thumbnail });
                        }
                    }
                } else {
                    // Same video, just update title if better
                    currentVideoData.title = d.title;
                    if (d.thumbnail) currentVideoData.thumbnail = d.thumbnail;
                    updateHeader();
                }
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
                updatePlayPauseIcon(d.isPlaying);
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
            currentLoopStart = msg.start;
            currentLoopEnd = msg.end;
            currentLoopEnabled = msg.enabled;

            if (loopStart) loopStart.value = (msg.start !== null) ? formatTime(msg.start) : '0:00';
            if (loopEnd) loopEnd.value = (msg.end !== null) ? formatTime(msg.end) : '0:00';

            updateLoopVisuals();
        }
        else if (msg.action === 'TIME_UPDATE') {
            const isGuarded = (Date.now() - lastCommandSentTime < 200);
            if (!isGuarded) {
                lastKnownCurrentTime = msg.currentTime;
                if (!isDraggingProgress) {
                    updateUIWithTime(msg.currentTime);
                }
                // syncMarkersUI will respect Follow toggle internally
                syncMarkersUI();
            }
        }
        else if (msg.action === 'PLAYBACK_STATUS') {
            updatePlayPauseIcon(msg.playing);
        }
        else if (msg.action === 'BOOKMARK_ADDED') {
            const groupName = currentVideoData.activeGroup || "Default";
            if (!currentVideoData.tagGroups) currentVideoData.tagGroups = {};
            if (!currentVideoData.tagGroups[groupName]) currentVideoData.tagGroups[groupName] = [];

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
            if (e.shiftKey || key === '{') {
                sendMessage('JUMP_LOOP_START');
            } else {
                sendMessage('SET_LOOP_START');
            }
        } else if (key === ']' || key === '}') {
            e.preventDefault();
            if (e.shiftKey || key === '}') {
                currentLoopEnabled = !currentLoopEnabled;
                sendMessage('TOGGLE_LOOP', { enabled: currentLoopEnabled });
                updateLoopVisuals();
            } else {
                sendMessage('SET_LOOP_END');
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
                const newSpeed = Math.max(0.25, currentSpeed - 0.25);
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
                const newSpeed = Math.min(3.0, currentSpeed + 0.25);
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
                    if (url.includes('youtube.com/watch') || url.includes('/shorts/') || url.includes('/v/') || url.includes('/embed/')) return 'WATCH';
                    if (url.includes('youtube.com')) return 'HOME';
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

    // Monitor internal navigation (e.g. clicking related video)
    chrome.tabs.onUpdated.addListener((id, info, tab) => {
        if (id === connectedTabId && info.status === 'complete') {
            // If our connected tab navigated, re-establish to capture new video ID
            establishConnection();
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

        // 2. Scan active if still null
        if (!connectedTabId) {
            const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
            // Optimized query: use the determineStatus logic for consistency
            if (t && (t.url.includes('youtube.com/watch') || t.url.includes('/shorts/') || t.url.includes('/v/') || t.url.includes('/embed/'))) {
                connectedTabId = t.id;
                log("Detecting YouTube video...", "info");
            }
        }

        // 3. Scan Global if still null (Popup Fallback)
        if (!connectedTabId) {
            // Find any tab that matches a video URL pattern
            const tabs = await chrome.tabs.query({ url: ["*://*.youtube.com/watch*", "*://*.youtube.com/shorts/*", "*://*.youtube.com/v/*"] });
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
            showStandby('HOME'); // Restore instructions when orphaned
        }
    }

    establishConnection();

    /* --- Storage Usage Monitoring --- */
    async function updateStorageUsage() {
        if (!chrome || !chrome.storage || !chrome.storage.sync || !chrome.storage.sync.getBytesInUse) return;

        const usageBar = document.getElementById('sync-usage-bar');
        const usageText = document.getElementById('sync-usage-text');
        if (!usageBar || !usageText) return;

        chrome.storage.sync.getBytesInUse(null, (bytes) => {
            const quota = chrome.storage.sync.QUOTA_BYTES || 102400;
            const percent = Math.min(100, Math.ceil((bytes / quota) * 100));

            usageBar.style.width = percent + '%';
            usageText.textContent = `${percent}% Used`;

            // Color Coding
            if (percent < 70) {
                usageBar.style.backgroundColor = 'var(--success-color)';
            } else if (percent < 90) {
                usageBar.style.backgroundColor = 'var(--warning-color)';
            } else {
                usageBar.style.backgroundColor = 'var(--danger-color)';
            }
        });
    }

} catch (e) { console.error(e); }
