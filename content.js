// content.js
let video = null;
let loopStart = null;
let loopEnd = null;
let loopEnabled = false;
let initAttempts = 0;
let lastInitedVideoId = null;

function init(shouldResetLoop = false) {
    if (shouldResetLoop) {
        console.log('[YT Study] Resetting A-B Loop for new video');
        loopStart = null;
        loopEnd = null;
        loopEnabled = false;
        notifyLoop();
    }
    video = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (!video) {
        initAttempts++;
        // Faster retry for better responsiveness
        const retryDelay = initAttempts < 10 ? 100 : 500;
        setTimeout(init, retryDelay);
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

    console.log('[YT Study] Video element found, content script ready');

    // Track what we inited on
    const params = new URLSearchParams(window.location.search);
    lastInitedVideoId = params.get('v');

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
    if (!video) return;
    const isPlaying = !video.paused;

    // Update session storage immediately (this is FAST, <1ms)
    try {
        chrome.storage.session.set({
            videoPlaying: isPlaying,
            lastStateUpdate: Date.now()
        }).catch(() => { });

        console.log('[YT Study] State broadcast:', isPlaying ? 'PLAYING' : 'PAUSED');
    } catch (err) {
        // Extension context invalidated (extension was reloaded)
        // This is expected, just ignore it
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

let lastMetadataSentTime = 0;
function notifyStatus(isPeriodic = false) {
    if (!video) return;
    try {
        const idSearchParams = new URLSearchParams(window.location.search);
        const videoId = idSearchParams.get('v');

        // 1. Playback Status (Always send)
        chrome.runtime.sendMessage({
            action: 'PLAYBACK_STATUS',
            videoId: videoId,
            playing: !video.paused
        }).catch(() => { });

        // 2. Metadata (Throttle heavily)
        if (videoId) {
            const now = Date.now();
            // Only send full metadata every 5 seconds if periodic, OR if specifically requested
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
                // Low-overhead time update
                chrome.runtime.sendMessage({
                    action: 'TIME_UPDATE',
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

    // Performance Marker
    const startTime = performance.now();

    const useVideoFallback = () => {
        // Validation: If current video ref is stale/detached, try to re-detect
        if (!video || !video.isConnected) {
            video = document.querySelector('video.html5-main-video') || document.querySelector('video');
        }

        if (!video) {
            console.warn(`[YT Study] Cannot execute fallback for ${action}: No video element found.`);
            return;
        }

        console.log(`[YT Study] Using video element fallback for ${action}`);
        if (action === 'PLAY') video.play().catch(() => { });
        else if (action === 'PAUSE') video.pause();
        else if (action === 'SEEK') video.currentTime = value;
        else if (action === 'SPEED') video.playbackRate = value;
    };

    try {
        switch (action) {
            case 'PLAY':
                if (hasAPI) {
                    player.playVideo();
                    // Speculative state update if API is slow
                    if (video && video.paused) setTimeout(() => { if (video && video.paused) useVideoFallback(); }, 50);
                } else useVideoFallback();
                break;
            case 'PAUSE':
                if (hasAPI) {
                    player.pauseVideo();
                    if (video && !video.paused) setTimeout(() => { if (video && !video.paused) useVideoFallback(); }, 50);
                } else useVideoFallback();
                break;
            case 'SEEK':
                if (hasAPI) player.seekTo(value, true);
                else useVideoFallback();
                break;
            case 'SPEED':
                if (hasAPI) {
                    player.setPlaybackRate(value);
                    // Also set on video element for immediate feedback
                    if (video) video.playbackRate = value;
                } else useVideoFallback();
                break;
        }
    } catch (e) {
        console.warn('[YT Study] API execution failed, falling back to video element:', e);
        useVideoFallback();
    }

    const duration = performance.now() - startTime;
    if (duration > 15) {
        console.warn(`[YT Study] Command ${action} took ${duration.toFixed(2)}ms`);
    }
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
            // Video still not found, respond with error immediately
            sendResponse({ success: false, error: 'Video element not found' });
            return true;
        }
    }

    try {
        switch (msg.action) {
            case 'TOGGLE_PLAYBACK':
                if (video) video.paused ? executeCommand('PLAY') : executeCommand('PAUSE');
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
                chrome.runtime.sendMessage({ action: 'BOOKMARK_ADDED', time: curTime }).catch(() => { });
                sendResponse({ success: true });
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
    const params = new URLSearchParams(window.location.search);
    const currentV = params.get('v');

    const isDetached = video && !video.isConnected;
    const isNewVideo = currentV && currentV !== lastInitedVideoId;

    if (isNewVideo || isDetached) {
        console.log(`[YT Study] Re-initializing: isNewVideo=${isNewVideo}, isDetached=${isDetached}`);
        init(isNewVideo);
    } else if (!video && document.querySelector('video')) {
        init();
    }
}, 500); // More frequent check for faster response after navigation
