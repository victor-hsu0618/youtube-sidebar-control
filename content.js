// content.js
let video = null;
let loopStart = null;
let loopEnd = null;
let loopEnabled = false;
let initAttempts = 0;
let lastInitedVideoId = null;

function init() {
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
    video.removeEventListener('ratechange', notifyStatus); // Added
    video.removeEventListener('loadedmetadata', notifyStatus);

    // Events
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', () => notifyStatus());
    video.addEventListener('pause', () => notifyStatus());
    video.addEventListener('ratechange', () => notifyStatus()); // Added
    video.addEventListener('loadedmetadata', () => notifyStatus());

    console.log('[YT Study] Video element found, content script ready');

    // Track what we inited on
    const params = new URLSearchParams(window.location.search);
    lastInitedVideoId = params.get('v');

    notifyStatus(); // Initial sync
    notifyLoop();   // Initial sync
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
        // 1. Playback Status (Always send)
        chrome.runtime.sendMessage({
            action: 'PLAYBACK_STATUS',
            playing: !video.paused
        }).catch(() => { });

        // 2. Metadata (Throttle heavily)
        const idSearchParams = new URLSearchParams(window.location.search);
        const videoId = idSearchParams.get('v');
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

// Helper for robust playback control using YouTube's internal API
function executeCommand(action, value) {
    const player = document.getElementById('movie_player');
    const hasAPI = player && typeof player.playVideo === 'function';

    try {
        switch (action) {
            case 'PLAY':
                if (hasAPI) player.playVideo();
                else if (video) video.play();
                break;
            case 'PAUSE':
                if (hasAPI) player.pauseVideo();
                else if (video) video.pause();
                break;
            case 'SEEK':
                if (hasAPI) player.seekTo(value, true);
                else if (video) video.currentTime = value;
                break;
            case 'SPEED':
                if (hasAPI) player.setPlaybackRate(value);
                else if (video) video.playbackRate = value;
                break;
        }
    } catch (e) {
        console.warn('[YT Study] API execution failed, falling back to video element:', e);
        if (video) {
            if (action === 'PLAY') video.play();
            if (action === 'PAUSE') video.pause();
            if (action === 'SEEK') video.currentTime = value;
            if (action === 'SPEED') video.playbackRate = value;
        }
    }
}

// Messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Emergency Detection: If video element is missing, try to find it IMMEDIATELY
    if (!video) {
        video = document.querySelector('video.html5-main-video') || document.querySelector('video');
        if (video) {
            console.log('[YT Study] Emergency video detection successful');
            init(); // Re-attach listeners
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
                // Logic handled by seeking back to the current "active" time handled in sidebar
                // But for hotkey relay, we might need content script to find the relative active marker
                // Actually, sidebar knows 'activeLi', so relaying through sidebar is easier.
                // However, global hotkey goes and directly calls content script.
                // We'll rely on the sidebar's check in background/sidebar to handle 'RESTART_ACTIVE_MARKER'
                // For now, let's just seek to the start of the current marker if possible?
                // Easier to just send a message back to sidebar: "HEY_USER_PRESSED_RESTART"
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
setInterval(() => {
    const params = new URLSearchParams(window.location.search);
    const currentV = params.get('v');
    // If we are on a watch page and the video ID changed since we last inited
    if (currentV && currentV !== lastInitedVideoId) {
        console.log('[YT Study] SPA Navigation detected, re-initializing');
        init();
    } else if (!video && document.querySelector('video')) {
        // More aggressive retry if element exists but we haven't hooked it
        init();
    }
}, 800); // Slightly more frequent check for navigation
