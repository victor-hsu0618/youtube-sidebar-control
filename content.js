// content.js
console.log("YT Studio Content Script Loaded");

let video = null;
let loopStart = null;
let loopEnd = null;
let loopEnabled = false;

// Initialize: Find the video element
function init() {
    // YouTube uses class 'html5-main-video' for the actual content player
    // Fallback to 'video' if not found (though on YT specific class is safer)
    video = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (!video) {
        // Retry if video not found yet
        // console.log("Waiting for video element...");
        setTimeout(init, 1000);
        return;
    }

    console.log("Video element found:", video);

    // Attach loop enforcement
    video.addEventListener('timeupdate', handleTimeUpdate);

    // Listen for play/pause to sync UI
    video.addEventListener('play', () => notifyPlaybackStatus(true));
    video.addEventListener('pause', () => notifyPlaybackStatus(false));

    // Initial status check
    notifyPlaybackStatus(!video.paused);
}

// Loop Logic
function handleTimeUpdate() {
    if (!loopEnabled || loopStart === null || loopEnd === null) return;

    if (video.currentTime >= loopEnd) {
        video.currentTime = loopStart;
        video.play(); // Ensure it plays
    }
}

function notifyPlaybackStatus(playing) {
    chrome.runtime.sendMessage({
        action: 'PLAYBACK_STATUS',
        playing: playing
    }).catch(() => { }); // Ignore errors if sidebar closed
}

function notifySidebarLoopUpdate() {
    chrome.runtime.sendMessage({
        action: 'UPDATE_LOOP_TIMES',
        start: loopStart,
        end: loopEnd,
        enabled: loopEnabled
    }).catch(() => { });
}

// Message Handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!video) init();
    if (!video) {
        if (message.action === 'TOGGLE_PLAYBACK') {
            // Try one last desperate search
            video = document.querySelector('video');
        }
    }

    if (!video) return;

    // console.log("Received message:", message);

    switch (message.action) {
        case 'SET_SPEED':
            video.playbackRate = message.speed;
            break;

        case 'SEEK_TO':
            video.currentTime = message.time;
            break;

        case 'SET_LOOP_START':
            loopStart = (message.time !== undefined) ? message.time : video.currentTime;
            console.log("Loop Start set to:", loopStart);
            notifySidebarLoopUpdate();
            break;

        case 'SET_LOOP_END':
            loopEnd = (message.time !== undefined) ? message.time : video.currentTime;
            console.log("Loop End set to:", loopEnd);
            if (loopStart !== null && loopEnd !== null) {
                loopEnabled = true;
            }
            notifySidebarLoopUpdate();
            break;

        case 'CLEAR_LOOP':
            loopStart = null;
            loopEnd = null;
            loopEnabled = false;
            notifySidebarLoopUpdate();
            break;

        case 'TOGGLE_LOOP':
            loopEnabled = message.enabled;
            break;

        case 'JUMP_LOOP_START':
            if (loopStart !== null) {
                video.currentTime = loopStart;
                video.play(); // Auto-play on jump
            }
            break;

        case 'ADD_BOOKMARK_REQUEST':
            chrome.runtime.sendMessage({
                action: 'BOOKMARK_ADDED',
                time: video.currentTime
            });
            break;

        case 'SEEK_BY':
            video.currentTime += message.offset;
            break;

        case 'TOGGLE_PLAYBACK':
            if (video.paused) video.play();
            else video.pause();
            break;

        case 'GET_STATUS':
            notifyPlaybackStatus(!video.paused);
            notifySidebarLoopUpdate();
            break;
    }
});

// Start looking for video
init();
