// content.js
let video = null;
let loopStart = null;
let loopEnd = null;
let loopEnabled = false;
let initAttempts = 0;

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
    video.removeEventListener('loadedmetadata', notifyStatus);

    // Events
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', () => notifyStatus());
    video.addEventListener('pause', () => notifyStatus());
    video.addEventListener('loadedmetadata', () => notifyStatus());

    console.log('[YT Studio] Video element found, content script ready');
    notifyStatus(); // Initial sync
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

function notifyStatus() {
    if (!video) return;
    try {
        // Send Playback Status
        chrome.runtime.sendMessage({
            action: 'PLAYBACK_STATUS',
            playing: !video.paused
        }).catch(() => { });

        // Send Metadata
        const idSearchParams = new URLSearchParams(window.location.search);
        const videoId = idSearchParams.get('v');
        if (videoId) {
            chrome.runtime.sendMessage({
                action: 'VIDEO_METADATA',
                data: {
                    videoId: videoId,
                    title: document.title.replace(' - YouTube', ''),
                    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                    duration: video.duration || 0,
                    currentTime: video.currentTime || 0
                }
            }).catch(() => { });
        }

    } catch (e) { }
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
    if (now - lastTick > 500) {
        notifyStatus();
        lastTick = now;
    }
}

// Messages
chrome.runtime.onMessage.addListener((msg) => {
    if (!video) init();
    if (!video && msg.action === 'TOGGLE_PLAYBACK') {
        video = document.querySelector('video');
    }
    if (!video) return;

    switch (msg.action) {
        case 'TOGGLE_PLAYBACK':
            video.paused ? video.play() : video.pause();
            break;
        case 'SET_SPEED':
            video.playbackRate = msg.speed;
            break;
        case 'SEEK_TO':
            video.currentTime = msg.time;
            break;
        case 'SEEK_BY':
            video.currentTime += msg.offset;
            break;
        case 'SET_LOOP_START':
            loopStart = (msg.time !== undefined) ? msg.time : video.currentTime;
            notifyLoop();
            break;
        case 'SET_LOOP_END':
            loopEnd = (msg.time !== undefined) ? msg.time : video.currentTime;
            if (loopStart !== null) {
                loopEnabled = true;
                video.currentTime = loopStart;
                video.play();
            }
            notifyLoop();
            break;
        case 'CLEAR_LOOP':
            loopStart = null; loopEnd = null; loopEnabled = false;
            notifyLoop();
            break;
        case 'JUMP_LOOP_START':
            if (loopStart !== null) {
                video.currentTime = loopStart;
                video.play();
            }
            break;
        case 'TOGGLE_LOOP':
            loopEnabled = msg.enabled;
            if (loopEnabled && loopStart !== null) {
                video.currentTime = loopStart;
                video.play();
            }
            break;
        case 'ADD_BOOKMARK_REQUEST':
            chrome.runtime.sendMessage({ action: 'BOOKMARK_ADDED', time: video.currentTime }).catch(() => { });
            break;
        case 'GET_STATUS':
            notifyStatus();
            notifyLoop();
            break;
    }
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
setInterval(init, 2000); // Periodic check for video element changes (navigation)
