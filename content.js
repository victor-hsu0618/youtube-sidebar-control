// content.js
let video = null;
let loopStart = null;
let loopEnd = null;
let loopEnabled = false;
let initAttempts = 0;
let lastInitedVideoId = null;
let isInitializing = false;
let myTabId = null;

// Request Tab ID on load
chrome.runtime.sendMessage({ action: 'GET_TAB_ID' }, (response) => {
    if (response && response.tabId) {
        myTabId = response.tabId;
        console.log('[YT Study] Content script assigned Tab ID:', myTabId);
        broadcastPlayState(); // Initial broadcast with tab ID
    }
});

function getActiveVideoId() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('v');

    if (!id && window.location.pathname.startsWith('/shorts/')) {
        const parts = window.location.pathname.split('/');
        id = parts[2];
    }

    // Check player for source of truth if available
    try {
        const player = document.getElementById('movie_player');
        if (player && typeof player.getVideoData === 'function') {
            const data = player.getVideoData();
            if (data && data.video_id) return data.video_id;
        }
    } catch (e) { }

    return id;
}

function init(shouldResetLoop = false) {
    if (isInitializing) return;

    const currentVideoId = getActiveVideoId();
    if (!currentVideoId) {
        console.log('[YT Study] No active video ID found, skipping init');
        return;
    }

    isInitializing = true;

    if (shouldResetLoop) {
        console.log('[YT Study] Resetting A-B Loop for new video:', currentVideoId);
        loopStart = null;
        loopEnd = null;
        loopEnabled = false;
        notifyLoop();
    }

    video = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (!video) {
        initAttempts++;
        isInitializing = false;
        // Faster retry for better responsiveness
        const retryDelay = initAttempts < 10 ? 100 : 500;
        setTimeout(() => init(shouldResetLoop), retryDelay);
        return;
    }

    // Check if the video element is actually ready (for SPA transitions)
    if (video.readyState < 1 && initAttempts < 10) {
        initAttempts++;
        isInitializing = false;
        setTimeout(() => init(shouldResetLoop), 200);
        return;
    }

    // Clear any existing listeners to avoid duplicates
    video.removeEventListener('timeupdate', handleTimeUpdate);
    video.removeEventListener('play', notifyStatus);
    video.removeEventListener('pause', notifyStatus);
    video.removeEventListener('ratechange', notifyStatus);
    video.removeEventListener('loadedmetadata', notifyStatus);
    video.removeEventListener('play', broadcastPlayState);
    video.removeEventListener('pause', broadcastPlayState);

    // Events
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', () => notifyStatus());
    video.addEventListener('pause', () => notifyStatus());
    video.addEventListener('ratechange', () => notifyStatus());
    video.addEventListener('loadedmetadata', () => notifyStatus());

    // Real-time state broadcasting for instant UI updates
    video.addEventListener('play', broadcastPlayState);
    video.addEventListener('pause', broadcastPlayState);
    video.addEventListener('ended', () => {
        chrome.runtime.sendMessage({ action: 'VIDEO_ENDED', videoId: getActiveVideoId() }).catch(() => { });
    });

    console.log('[YT Study] Video element found, content script ready for:', currentVideoId);

    // Track what we inited on
    lastInitedVideoId = currentVideoId;
    initAttempts = 0;
    isInitializing = false;

    notifyStatus(); // Initial sync
    notifyLoop();   // Initial sync
    broadcastPlayState(); // Initial state broadcast

    // Handle Playback Intent (Respect user state from Library navigation)
    chrome.storage.local.get(['playback_intent'], (res) => {
        const intent = res.playback_intent;
        if (intent && Date.now() - intent.ts < 5000) { // Valid for 5 seconds
            console.log('[YT Study] Detected Playback Intent:', intent);

            if (intent.value === false) {
                console.log('[YT Study] Intent is PAUSE. Engaging Force-Pause Guard.');

                // YouTube is very aggressive with auto-play. 
                // We need to fight it for a short duration until it settles.
                let guardCount = 0;
                const guardInterval = setInterval(() => {
                    if (video && !video.paused) {
                        console.log('[YT Study] Guard Force-Pause...');
                        executeCommand('PAUSE');
                    }
                    guardCount++;
                    if (guardCount > 12) clearInterval(guardInterval); // 1.2 seconds of guard
                }, 100);

                // Initial pause
                executeCommand('PAUSE');
            }
        }
        // Always clear to avoid accidental consumption later
        chrome.storage.local.remove('playback_intent');
    });
}

// Unify Speed Hotkeys: Intercept Shift + < / > to ensure 0.05x increments
document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input/textarea/contenteditable
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    if (e.shiftKey) {
        if (e.key === ',' || e.key === '<') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!video) video = document.querySelector('video'); // Emergency re-detect
            if (video) {
                const currentSpeed = video.playbackRate;
                const newSpeed = Math.max(0.25, Math.round((currentSpeed - 0.05) * 100) / 100);
                console.log(`[YT Study] Speed Down: ${currentSpeed} -> ${newSpeed}`);
                executeCommand('SPEED', newSpeed);
            }
        } else if (e.key === '.' || e.key === '>') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!video) video = document.querySelector('video'); // Emergency re-detect
            if (video) {
                const currentSpeed = video.playbackRate;
                const newSpeed = Math.min(3.0, Math.round((currentSpeed + 0.05) * 100) / 100);
                console.log(`[YT Study] Speed Up: ${currentSpeed} -> ${newSpeed}`);
                executeCommand('SPEED', newSpeed);
            }
        }
    }
}, true); // Use capture phase to intercept before YouTube's own listeners

// Instant state broadcasting to session storage for zero-latency UI
function broadcastPlayState() {
    if (!video || !myTabId) return;
    const isPlaying = !video.paused;

    // Update session storage immediately (this is FAST, <1ms)
    // Use Tab ID in key to prevent cross-tab interference
    try {
        const stateKey = `videoPlaying_${myTabId}`;
        chrome.storage.session.set({
            [stateKey]: isPlaying,
            lastGlobalUpdate: Date.now()
        }).catch(() => { });

        console.log(`[YT Study] State broadcast (${stateKey}):`, isPlaying ? 'PLAYING' : 'PAUSED');
    } catch (err) {
        console.log('[YT Study] Cannot broadcast state, extension context invalidated');
    }
}

// Use MutationObserver for faster detection when video element appears
const observer = new MutationObserver(() => {
    if (!video && document.querySelector('video')) {
        init();
    }
});

// Start observing as soon as possible
if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

let lastTick = 0;
function handleTimeUpdate() {
    if (!video) return;

    // Loop
    if (loopEnabled && loopStart !== null && loopEnd !== null) {
        if (video.currentTime >= loopEnd) {
            video.currentTime = loopStart;
            video.play();
        }
    }

    // Throttle UI updates (Progress Bar)
    const now = Date.now();
    if (now - lastTick > 150) {
        notifyStatus(true); // Is periodic
        lastTick = now;
    }
}

function scrapePlaylistInfo() {
    const params = new URLSearchParams(window.location.search);
    const listId = params.get('list');
    if (!listId) return null;

    let title = "";
    const titleEl = document.querySelector('ytd-playlist-header-renderer h1')
        || document.querySelector('ytd-playlist-header-renderer #text')
        || document.querySelector('ytd-playlist-header-renderer .title')
        || document.querySelector('#header-description h3')
        || document.querySelector('yt-dynamic-sizing-formatted-string#container')
        || document.querySelector('.ytd-playlist-header-renderer.title');

    // On watch page, find the playlist title in the panel
    const panelTitleEl = document.querySelector('ytd-playlist-panel-renderer #title-container a')
        || document.querySelector('ytd-playlist-panel-renderer .title a');

    if (panelTitleEl) title = panelTitleEl.innerText;
    else if (titleEl) title = titleEl.innerText;

    // Fallback title from page title
    if (!title || title.trim() === "") {
        title = document.title.replace(' - YouTube', '');
    }

    const videos = [];
    let items = document.querySelectorAll('ytd-playlist-video-renderer');
    if (items.length === 0) {
        items = document.querySelectorAll('ytd-playlist-panel-video-renderer');
    }
    // Fallback for list-style items in some layouts
    if (items.length === 0) {
        items = document.querySelectorAll('ytd-item-section-renderer ytd-playlist-video-renderer');
    }

    items.forEach(item => {
        // Find title element - it's often the best source for both title and href
        const vTitleEl = item.querySelector('#video-title') || item.querySelector('a.yt-simple-endpoint');
        const vThumbnail = item.querySelector('a#thumbnail');

        let vId = null;
        let vTitle = "";

        // Try to get ID and Title from the title element (usually an <a>)
        if (vTitleEl) {
            vTitle = vTitleEl.innerText.trim();
            const href = vTitleEl.getAttribute('href');
            if (href) {
                const url = new URL(href, window.location.origin);
                vId = url.searchParams.get('v');
            }
        }

        // Fallback or verify ID from thumbnail
        if (!vId && vThumbnail) {
            const href = vThumbnail.getAttribute('href');
            if (href) {
                const url = new URL(href, window.location.origin);
                vId = url.searchParams.get('v');
            }
        }

        if (vId) {
            videos.push({
                id: vId,
                title: vTitle || `Video ${videos.length + 1}`,
                thumbnail: `https://img.youtube.com/vi/${vId}/mqdefault.jpg`
            });
        }
    });

    if (videos.length === 0) {
        console.warn(`[YT Study] Scrape failed: Found 0 items for list ${listId}`);
        return null;
    }

    return {
        listId: listId,
        title: title.trim() || "Imported Playlist",
        videoCount: videos.length,
        videos: videos
    };
}

let lastMetadataSentTime = 0;

function notifyStatus(isPeriodic = false) {
    if (!video) return;

    try {
        const videoId = getActiveVideoId();

        // 1. Playback Status (Always send)
        chrome.runtime.sendMessage({
            action: 'PLAYBACK_STATUS',
            videoId: videoId,
            playing: !video.paused
        }).catch(() => { });

        // 2. Metadata (Throttle heavily)
        if (videoId) {
            const now = Date.now();
            const shouldSendFullMetadata = !isPeriodic || (now - lastMetadataSentTime > 5000);

            if (shouldSendFullMetadata) {
                lastMetadataSentTime = now;
                chrome.runtime.sendMessage({
                    action: 'VIDEO_METADATA',
                    data: {
                        videoId: videoId,
                        title: document.title.replace(' - YouTube', ''),
                        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                        duration: video.duration || 0,
                        currentTime: video.currentTime || 0,
                        isPlaying: !video.paused,
                        playbackRate: video.playbackRate || 1.0
                    }
                }).catch(() => { });
            } else {
                chrome.runtime.sendMessage({
                    action: 'TIME_UPDATE',
                    videoId: videoId,
                    currentTime: video.currentTime || 0
                }).catch(() => { });
            }
        }
    } catch (e) { }
}

// Helper for robust playback control using YouTube's internal API with zero-latency fallback
function executeCommand(action, value) {
    const player = document.getElementById('movie_player');
    const hasAPI = player && typeof player.playVideo === 'function';

    const useVideoFallback = () => {
        if (!video || !video.isConnected) {
            video = document.querySelector('video.html5-main-video') || document.querySelector('video');
        }

        if (!video) return;

        console.log(`[YT Study] Executing fallback for ${action}`);
        if (action === 'PLAY') {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn("[YT Study] video.play() failed:", error);
                    // If it failed due to user gesture requirement, we might need 
                    // to show a UI hint later, but for now we just log it.
                });
            }
        }
        else if (action === 'PAUSE') video.pause();
        else if (action === 'SEEK') video.currentTime = value;
        else if (action === 'SPEED') video.playbackRate = value;
    };

    try {
        switch (action) {
            case 'PLAY':
                if (hasAPI) {
                    player.playVideo();
                    // YouTube sometimes ignores playVideo() if called immediately after navigation
                    // or during certain overlay states. We check after a short delay.
                    setTimeout(() => {
                        if (video && video.paused) {
                            console.log("[YT Study] API play failed to start, using fallback...");
                            useVideoFallback();
                        }
                    }, 150);
                } else useVideoFallback();
                break;
            case 'PAUSE':
                if (hasAPI) {
                    player.pauseVideo();
                    setTimeout(() => {
                        if (video && !video.paused) useVideoFallback();
                    }, 100);
                } else useVideoFallback();
                break;
            case 'SEEK':
                if (hasAPI) player.seekTo(value, true);
                else useVideoFallback();
                break;
            case 'SPEED':
                if (hasAPI) player.setPlaybackRate(value);
                if (video) video.playbackRate = value;
                break;
        }
    } catch (e) {
        console.warn('[YT Study] Command execution error, falling back:', e);
        useVideoFallback();
    }
}

// Simulate a Space key press on the player to toggle play/pause
function triggerSpaceKey() {
    const moviePlayer = document.getElementById('movie_player');
    const video = document.querySelector('video');
    const target = moviePlayer || video || document.body;

    if (target) {
        const eventParams = {
            bubbles: true,
            cancelable: true,
            view: window,
            key: ' ',
            code: 'Space',
            keyCode: 32,
            which: 32,
            composed: true
        };

        // Dispatch to target and also document as fallback
        target.dispatchEvent(new KeyboardEvent('keydown', eventParams));
        document.dispatchEvent(new KeyboardEvent('keydown', eventParams));

        setTimeout(() => {
            target.dispatchEvent(new KeyboardEvent('keyup', eventParams));
            document.dispatchEvent(new KeyboardEvent('keyup', eventParams));
        }, 10);

        console.log('[YT Study] Triggered Space key event');
    }
}

// Robust toggle that tries multiple methods
function robustToggle() {
    // Method 1: Click the native YouTube Play Button (Highest reliability)
    const nativePlayBtn = document.querySelector('.ytp-play-button');
    if (nativePlayBtn) {
        console.log('[YT Study] Toggling via native button click');
        nativePlayBtn.click();
        return;
    }

    // Method 2: Use API if available
    const player = document.getElementById('movie_player');
    if (player && typeof player.togglePlay === 'function') {
        console.log('[YT Study] Toggling via player.togglePlay()');
        player.togglePlay();
        return;
    }

    // Method 3: Direct video element control fallback
    const videoEl = document.querySelector('video');
    if (videoEl) {
        console.log('[YT Study] Toggling via video element');
        if (videoEl.paused) videoEl.play().catch(() => { });
        else videoEl.pause();
    }

    // Method 4: Space key as backup
    triggerSpaceKey();
}

// Messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Optimized Emergency Detection: Check if video is null or disconnected (detached from DOM)
    if (!video || !video.isConnected) {
        video = document.querySelector('video.html5-main-video') || document.querySelector('video');
        if (video) {
            console.log('[YT Study] Emergency video re-capture successful');
            init(); // Full re-init to ensure listeners are attached
        } else {
            // Video still not found, but some actions (like SCRAPE_PLAYLIST) don't need it
            if (msg.action !== 'SCRAPE_PLAYLIST') {
                sendResponse({ success: false, error: 'Video element not found' });
                return true;
            }
        }
    }

    try {
        switch (msg.action) {
            case 'TOGGLE_PLAYBACK':
                robustToggle();
                sendResponse({ success: true });
                break;
            case 'TOGGLE_PLAY_PAUSE':
                robustToggle();
                sendResponse({ success: true });
                break;
            case 'PLAY_VIDEO':
                executeCommand('PLAY');
                sendResponse({ success: true });
                break;
            case 'PAUSE_VIDEO':
                executeCommand('PAUSE');
                sendResponse({ success: true });
                break;
            case 'PING_VIDEO':
                const target = document.getElementById('movie_player') || video;
                if (target) {
                    const originalOutline = target.style.outline;
                    const originalBoxShadow = target.style.boxShadow;
                    const originalTransition = target.style.transition;

                    target.style.transition = 'all 0.2s';
                    target.style.outline = '8px solid #FFDD00'; // Brand Yellow
                    target.style.boxShadow = '0 0 50px rgba(255, 221, 0, 0.6) inset';
                    target.style.zIndex = '9999';

                    setTimeout(() => {
                        target.style.outline = originalOutline;
                        target.style.boxShadow = originalBoxShadow;
                        target.style.transition = originalTransition;
                    }, 600);
                }
                sendResponse({ success: true });
                break;
            case 'SET_SPEED':
                executeCommand('SPEED', msg.speed);
                sendResponse({ success: true });
                break;
            case 'SEEK_TO':
                executeCommand('SEEK', msg.time);
                sendResponse({ success: true });
                break;
            case 'SEEK_BY':
                if (video) executeCommand('SEEK', video.currentTime + msg.offset);
                sendResponse({ success: true });
                break;
            case 'SEEK_AND_PLAY':
                executeCommand('SEEK', msg.time);
                executeCommand('PLAY');
                sendResponse({ success: true });
                break;
            case 'SET_LOOP_START':
                const startVal = (msg.time !== undefined) ? msg.time : (video ? video.currentTime : 0);
                loopStart = startVal;
                if (loopEnd !== null && loopStart >= loopEnd) {
                    loopEnd = null;
                    loopEnabled = false;
                }
                notifyLoop();
                sendResponse({ success: true });
                break;
            case 'SET_LOOP_END':
                const endVal = (msg.time !== undefined) ? msg.time : (video ? video.currentTime : 0);
                if (loopStart !== null && endVal <= loopStart) {
                    loopEnd = null;
                    loopEnabled = false;
                } else {
                    loopEnd = endVal;
                    if (loopStart !== null) {
                        loopEnabled = true;
                        executeCommand('SEEK', loopStart);
                        executeCommand('PLAY');
                    }
                }
                notifyLoop();
                sendResponse({ success: true });
                break;
            case 'CLEAR_LOOP':
                loopStart = null; loopEnd = null; loopEnabled = false;
                notifyLoop();
                sendResponse({ success: true });
                break;
            case 'JUMP_LOOP_START':
                if (loopStart !== null) {
                    executeCommand('SEEK', loopStart);
                    executeCommand('PLAY');
                }
                sendResponse({ success: true });
                break;
            case 'TOGGLE_LOOP':
                loopEnabled = msg.enabled;
                if (loopEnabled && loopStart !== null) {
                    executeCommand('SEEK', loopStart);
                    executeCommand('PLAY');
                }
                sendResponse({ success: true });
                break;
            case 'ADD_BOOKMARK_REQUEST':
                const curTime = video ? video.currentTime : 0;
                chrome.runtime.sendMessage({
                    action: 'BOOKMARK_ADDED',
                    videoId: getActiveVideoId(),
                    time: curTime
                }).catch(() => { });
                sendResponse({ success: true });
                break;
            case 'SCRAPE_PLAYLIST':
                const info = scrapePlaylistInfo();
                sendResponse({ success: !!info, data: info });
                break;
            case 'GET_STATUS':
                notifyStatus();
                notifyLoop();
                sendResponse({ success: true });
                break;
            case 'RESTART_ACTIVE_MARKER':
                chrome.runtime.sendMessage({ action: 'HOTKEY_RESTART' }).catch(() => { });
                sendResponse({ success: true });
                break;
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (err) {
        console.error('[YT Study] Message handling error:', err);
        sendResponse({ success: false, error: err.message });
    }
    return true; // Keep channel open for async if needed
});

function notifyLoop() {
    chrome.runtime.sendMessage({
        action: 'UPDATE_LOOP_TIMES',
        start: loopStart,
        end: loopEnd,
        enabled: loopEnabled
    }).catch(() => { });
}

init();

// Watch for SPA navigation and Detached elements
setInterval(() => {
    const currentV = getActiveVideoId();

    const isDetached = video && !video.isConnected;
    const isNewVideo = currentV && currentV !== lastInitedVideoId;

    if (isNewVideo || isDetached) {
        console.log(`[YT Study] Re-initializing from interval: isNewVideo=${isNewVideo}, isDetached=${isDetached}`);
        init(isNewVideo);
    } else if (!video && document.querySelector('video')) {
        init();
    }
}, 1000); // Polling as fallback

// Primary SPA Navigation Listeners
document.addEventListener('yt-navigate-finish', () => {
    const currentV = getActiveVideoId();
    if (currentV !== lastInitedVideoId) {
        console.log(`[YT Study] SPA Navigation Detected: ${lastInitedVideoId} -> ${currentV}`);
        init(true);
    }
});

document.addEventListener('yt-page-data-updated', () => {
    // Sometimes title or metadata updates slightly after navigation
    const currentV = getActiveVideoId();
    if (currentV === lastInitedVideoId) {
        notifyStatus();
    }
});
