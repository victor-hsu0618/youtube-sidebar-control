// sidebar.js

const debugConsole = document.getElementById('debug-console');
const debugLogs = document.getElementById('debug-logs');

function log(msg, type = 'info') {
    if (debugConsole) debugConsole.style.display = 'block';
    if (!debugLogs) return;
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    if (type === 'error') line.style.color = '#ff4e45';
    else if (type === 'success') line.style.color = '#4cc713';
    else line.style.color = '#aaa';
    debugLogs.appendChild(line);
    console.log(msg);
}

try {
    // --- State ---
    let currentVideoId = null;
    let currentStorageKey = null; // null = Temporary Session (Unsaved)
    let isPlaying = false;
    let currentVideoData = createEmptyData();
    let isDraggingProgress = false;
    let connectedTabId = null; // Track connected tab for Popout
    let pendingHighlightTime = null; // Persistent highlight state
    let isSyncing = false; // Prevent concurrent profile loads
    let lastKnownCurrentTime = 0; // Cache for active marker tracking

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
            tagGroups: { "Default": [], "Study": [], "Cust. A": [], "Cust. B": [] }
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

    async function sendMessage(action, payload = {}) {
        try {
            let targetTabId = null;

            // Strategy 1: Use Established/Passed ID
            if (connectedTabId) {
                targetTabId = connectedTabId;
            }

            // Strategy 2: If no connection, find standard active tab (Side Panel Mode)
            if (!targetTabId) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.url.includes('youtube.com/watch')) {
                    targetTabId = tab.id;
                }
            }

            // Strategy 3: (Popout Mode Fallback) Scan for ANY YouTube tab
            if (!targetTabId) {
                const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/watch*" });
                // Prioritize audible or focused
                const active = tabs.find(t => t.active) || tabs[0];
                if (active) targetTabId = active.id;
            }

            if (!targetTabId) {
                statusIndicator.classList.remove('connected');
                return;
            }

            // Validate existence logic can be tricky if permissions are tight, 
            // but assuming host permissions, we can just send.

            // Soft validation / ID tracking
            connectedTabId = targetTabId;

            await chrome.tabs.sendMessage(targetTabId, { action, ...payload });
            statusIndicator.classList.add('connected');
        } catch (error) {
            statusIndicator.classList.remove('connected');
            // Reset if error (tab closed etc)
            // But if it was passed via param, maybe we shouldn't reset immediately unless sure?
            // For now, reset is safer to allow auto-finding other tabs.
            connectedTabId = null;
        }
    }

    // --- Logic ---
    function updatePlayPauseIcon(playing) {
        isPlaying = playing;
        if (playPauseBtn) {
            playPauseBtn.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;
        }
    }

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => sendMessage('TOGGLE_PLAYBACK'));
    }

    // Transport
    document.getElementById('restart-btn')?.addEventListener('click', () => sendMessage('SEEK_TO', { time: 0 }));
    document.getElementById('rwd-btn')?.addEventListener('click', () => sendMessage('SEEK_BY', { offset: -10 }));
    document.getElementById('fwd-btn')?.addEventListener('click', () => sendMessage('SEEK_BY', { offset: 10 }));

    // Speed
    const speedSlider = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-display');
    speedSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        speedDisplay.textContent = val + 'x';
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
    progressBar.addEventListener('input', (e) => timeCurrent.textContent = formatTime(parseFloat(e.target.value)));
    progressBar.addEventListener('change', (e) => {
        sendMessage('SEEK_TO', { time: parseFloat(e.target.value) });
        isDraggingProgress = false;
    });

    // Loop & Manual Input
    const loopToggle = document.getElementById('loop-toggle');
    const loopStart = document.getElementById('loop-start');
    const loopEnd = document.getElementById('loop-end');

    document.getElementById('set-start').addEventListener('click', () => { sendMessage('SET_LOOP_START'); setLoopAccordionState(true); });
    document.getElementById('set-end').addEventListener('click', () => { sendMessage('SET_LOOP_END'); setLoopAccordionState(true); });

    loopStart.addEventListener('change', () => {
        const t = parseTime(loopStart.value);
        if (t !== null) sendMessage('SET_LOOP_START', { time: t });
        setLoopAccordionState(true);
    });
    loopEnd.addEventListener('change', () => {
        const t = parseTime(loopEnd.value);
        if (t !== null) sendMessage('SET_LOOP_END', { time: t });
        setLoopAccordionState(true);
    });

    document.getElementById('clear-loop')?.addEventListener('click', () => {
        loopStart.value = ''; loopEnd.value = ''; sendMessage('CLEAR_LOOP');
    });
    document.getElementById('jump-loop')?.addEventListener('click', () => sendMessage('JUMP_LOOP_START'));

    loopToggle.addEventListener('change', (e) => {
        sendMessage('TOGGLE_LOOP', { enabled: e.target.checked });
        setLoopAccordionState(e.target.checked);
    });


    // Bookmarks UI
    const groupSelector = document.getElementById('group-selector');
    const fileImport = document.getElementById('file-import');

    groupSelector.addEventListener('change', (e) => {
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

        // 3. Format Label: Add "Now(12:34)" to "Study"
        addMarkerBtn.textContent = `Add "Now(${timeStr})" to "${groupName}"`;
    }

    document.getElementById('add-bookmark').addEventListener('click', () => sendMessage('ADD_BOOKMARK_REQUEST'));
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => fileImport.click());
    fileImport.addEventListener('change', importData);

    const libFileImport = document.getElementById('lib-file-import');
    document.getElementById('lib-btn-import').addEventListener('click', () => libFileImport.click());
    libFileImport.addEventListener('change', importVideoData);

    // --- Auto Detect Button ---
    document.getElementById('btn-detect-video')?.addEventListener('click', async () => {
        if (!currentVideoId) {
            const btn = document.getElementById('btn-detect-video');
            btn.style.color = '#ff4e45';
            setTimeout(() => btn.style.color = '', 1000);
            return;
        }

        const all = await chrome.storage.sync.get(null);
        const related = [];
        Object.keys(all).forEach(k => {
            if (k.startsWith('v_' + currentVideoId) && all[k].isSaved) {
                related.push({ ...all[k], _key: k });
            }
        });

        if (related.length === 0) {
            const btn = document.getElementById('btn-detect-video');
            btn.style.color = '#ff4e45'; // Error Red
            setTimeout(() => btn.style.color = '', 1000);
            return;
        }

        related.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

        const best = related[0];
        loadStorageProfile(best._key);

        const btn = document.getElementById('btn-detect-video');
        const origColor = btn.style.color;
        btn.style.color = '#4cc713'; // Success Green
        setTimeout(() => btn.style.color = origColor, 1000);
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
    async function loadStorageProfile(key) {
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

    document.getElementById('toggle-library-save').addEventListener('click', () => {
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
                setTimeout(() => {
                    const container = document.querySelector('.bookmarks-list-container');
                    if (container) {
                        const topPos = li.offsetTop;
                        const containerHeight = container.clientHeight;
                        const itemHeight = li.clientHeight;
                        container.scrollTo({
                            top: topPos - (containerHeight / 2) + (itemHeight / 2),
                            behavior: 'smooth'
                        });
                    }
                    // Clear after application
                    if (pendingHighlightTime === checkTime) pendingHighlightTime = null;
                }, 100);
            }

            li.innerHTML = `
                <div class="bookmark-controls">
                    <button class="bookmark-play-btn" title="Play">${ICON_SMALL_PLAY}</button>
                </div>
                <input type="text" class="bookmark-time-input" value="${formatTime(bm.time)}">
                <input type="text" class="bookmark-desc" value="${bm.label || ''}" placeholder="marker description">
                <div class="bookmark-controls">
                    <button class="loop-set-btn set-a">A</button>
                    <button class="loop-set-btn set-b">B</button>
                    <button class="delete-btn">×</button>
                </div>
            `;
            li.querySelector('.bookmark-play-btn').addEventListener('click', () => sendMessage('SEEK_TO', { time: bm.time }));
            li.querySelector('.bookmark-time-input').addEventListener('change', (e) => {
                const t = parseTime(e.target.value);
                if (t !== null) { bm.time = t; saveData(); renderBookmarks(); }
                else { e.target.value = formatTime(bm.time); }
            });
            li.querySelector('.bookmark-desc').addEventListener('change', (e) => {
                bm.label = e.target.value; saveData();
            });
            li.querySelector('.set-a').addEventListener('click', () => { sendMessage('SET_LOOP_START', { time: bm.time }); setLoopAccordionState(true); });
            li.querySelector('.set-b').addEventListener('click', () => { sendMessage('SET_LOOP_END', { time: bm.time }); setLoopAccordionState(true); });
            li.querySelector('.delete-btn').addEventListener('click', () => {
                groupTags.splice(i, 1);
                saveData();
                renderBookmarks();
            });
            list.appendChild(li);
        });

        // Always re-apply active highlight after render to prevent flickering
        updateActiveMarker(lastKnownCurrentTime);
    }

    function updateActiveMarker(currentTime) {
        const listItems = document.querySelectorAll('#bookmarks-list .bookmark-item');
        let activeLi = null;

        // The active marker is the one with the largest time <= currentTime
        listItems.forEach(li => {
            const itemTime = parseFloat(li.dataset.time);
            if (itemTime <= currentTime) {
                if (!activeLi || itemTime > parseFloat(activeLi.dataset.time)) {
                    activeLi = li;
                }
            }
            li.classList.remove('active-playing');
        });

        if (activeLi) {
            activeLi.classList.add('active-playing');

            // Auto-scroll if enabled
            const followToggle = document.getElementById('follow-playback-toggle');
            if (followToggle && followToggle.checked) {
                const container = document.querySelector('.bookmarks-list-container');
                if (container) {
                    const topPos = activeLi.offsetTop;
                    const containerHeight = container.clientHeight;
                    const itemHeight = activeLi.clientHeight;
                    const targetScroll = topPos - (containerHeight / 2) + (itemHeight / 2);

                    // Only scroll if significantly different to avoid jitter
                    if (Math.abs(container.scrollTop - targetScroll) > 10) {
                        container.scrollTo({
                            top: targetScroll,
                            behavior: 'smooth'
                        });
                    }
                }
            }
        }
    }

    // --- Library Logic ---
    async function loadLibrary() {
        const container = document.getElementById('library-list');
        if (!container) return;
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
                    // Set Intention
                    await chrome.storage.local.set({ [`pending_nav_${v.id}`]: v._key });

                    // Optimistic Load (Wait for it)
                    await loadStorageProfile(v._key);

                    // Switch Video Logic (Unified for Sidebar & Popup)
                    let targetId = connectedTabId;
                    if (!targetId) {
                        const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (t) targetId = t.id;
                    }

                    if (targetId) {
                        const t = await chrome.tabs.get(targetId).catch(() => null);
                        if (t && !t.url.includes(v.id)) {
                            chrome.tabs.update(targetId, { url: `https://youtube.com/watch?v=${v.id}` });
                        } else {
                            // Already on page, manually load trigger 
                            // because METADATA might not fire if navigation doesn't happen
                            await loadStorageProfile(v._key);
                            chrome.storage.local.remove(`pending_nav_${v.id}`);
                        }
                    }
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
            const significantChange = videoKeysChanged.some(k => {
                const val = changes[k].newValue;
                const old = changes[k].oldValue;

                // Added or Removed
                if (!val || !old) return true;

                // Title changed, Default changed, Saved status changed
                if (val.title !== old.title) return true;
                if (val.isDefault !== old.isDefault) return true;
                if (val.isSaved !== old.isSaved) return true;

                // If Tag count changed, we should probably update list metadata
                const newCount = val.tagGroups ? Object.values(val.tagGroups).reduce((acc, g) => acc + g.length, 0) : 0;
                const oldCount = old.tagGroups ? Object.values(old.tagGroups).reduce((acc, g) => acc + g.length, 0) : 0;
                if (newCount !== oldCount) return true;

                return false;
            });

            if (significantChange) {
                shouldRefreshLib = true;
                shouldRefreshFav = true;
            }

            // Specific case: Current video updated externally (e.g. from popup to sidebar)
            if (videoKeysChanged.includes(currentStorageKey)) {
                if (changes[currentStorageKey].newValue) {
                    // Silent update of data, don't necessarily re-render the whole list
                    currentVideoData = changes[currentStorageKey].newValue;
                    updateHeader();
                    renderBookmarks();
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
    });

    // Messages
    chrome.runtime.onMessage.addListener(async (msg) => {
        // Connection Check
        if (statusIndicator) statusIndicator.classList.add('connected');

        if (msg.action === 'VIDEO_METADATA') {
            const d = msg.data;
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
                        console.log("Loading Pending Profile:", localData[pendingKey]);
                        isSyncing = true;
                        await loadStorageProfile(localData[pendingKey]);
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
                            console.log("Auto-Detected Profile:", related[0]._key);
                            log(`Auto-detected: ${related[0].title || 'video'}`, 'success');
                            isSyncing = true;
                            await loadStorageProfile(related[0]._key);
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

            lastKnownCurrentTime = d.currentTime; // Sync cache

            if (!isDraggingProgress) {
                progressBar.max = d.duration;
                progressBar.value = d.currentTime;
                timeCurrent.textContent = formatTime(d.currentTime);
                timeTotal.textContent = formatTime(d.duration);
                updateAddMarkerBtn(d.currentTime);
                updateActiveMarker(d.currentTime);
            }
        }
        else if (msg.action === 'UPDATE_LOOP_TIMES') {
            if (msg.start !== null) loopStart.value = formatTime(msg.start);
            if (msg.end !== null) loopEnd.value = formatTime(msg.end);
            if (typeof msg.enabled === 'boolean') {
                loopToggle.checked = msg.enabled;
                setLoopAccordionState(msg.enabled);
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
            } else {
                console.log(`[YT Studio] Duplicate marker at ${msg.time} ignored.`);
            }

            renderBookmarks(msg.time); // Always render/highlight to show feedback
        }
    });

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
        if (mode) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'standby-overlay';
                overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:9999;text-align:center;padding:20px;transition:opacity 0.2s;";
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';

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
            if (overlay) overlay.style.display = 'none';
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
                    if (url.includes('youtube.com/watch')) return 'WATCH';
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

    chrome.tabs.onActivated.addListener(checkActiveTab);
    chrome.tabs.onUpdated.addListener((id, info, tab) => {
        if (tab.active && info.status === 'complete') checkActiveTab();
    });

    // Initial Check
    checkActiveTab();

    // Init
    async function establishConnection() {
        if (statusIndicator) statusIndicator.classList.remove('connected');

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
            if (t && t.url.includes('youtube.com/watch')) {
                connectedTabId = t.id;
                log("Detecting YouTube video...", "info");
            }
        }

        // 3. Scan Global if still null (Popup Fallback)
        if (!connectedTabId) {
            const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/watch*" });
            const active = tabs.find(t => t.active) || tabs[0];
            if (active) connectedTabId = active.id;
        }

        // 4. Initial Ping with retry
        if (connectedTabId) {
            // Try multiple times with short delays for better responsiveness
            const tryConnect = async (attempt = 0) => {
                try {
                    await sendMessage('GET_STATUS');
                    console.log('[YT Studio] Connected to tab', connectedTabId);
                } catch (e) {
                    if (attempt < 8) {
                        // Faster initial retry (50ms) for first 3 attempts, then backoff
                        const delay = attempt < 3 ? 50 : 100 * Math.pow(2, attempt - 3);
                        setTimeout(() => tryConnect(attempt + 1), delay);
                    } else {
                        console.log('[YT Studio] Connection timeout, content script may not be ready');
                    }
                }
            };
            tryConnect();
        } else {
            console.log("No Video Tab Found");
        }
    }

    establishConnection();

} catch (e) { console.error(e); }
