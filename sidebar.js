// sidebar.js

// --- Debug Utility ---
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

window.onerror = function (message, source, lineno, colno, error) {
    log(`Global Error: ${message} at ${lineno}:${colno}`, 'error');
};

try {
    // State
    let currentTabId = null;

    // DOM Elements
    const speedSlider = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-display');
    const presetButtons = document.querySelectorAll('.preset-btn');

    const loopToggle = document.getElementById('loop-toggle');
    const loopStartInput = document.getElementById('loop-start');
    const loopEndInput = document.getElementById('loop-end');
    const setStartBtn = document.getElementById('set-start');
    const setEndBtn = document.getElementById('set-end');
    // const clearLoopBtn = document.getElementById('clear-loop'); // Moved below

    const bookmarksList = document.getElementById('bookmarks-list');
    const addBookmarkBtn = document.getElementById('add-bookmark');
    const statusIndicator = document.getElementById('connection-status');
    const playPauseBtn = document.getElementById('play-pause');

    // Icons
    const ICON_PLAY = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

    // Helper: Get Active Tab
    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // Helper: Send Message to Content Script
    async function sendMessage(action, payload = {}) {
        try {
            const tab = await getActiveTab();
            if (!tab?.id) return;

            if (!tab.url.includes('youtube.com/watch')) {
                statusIndicator.classList.remove('connected');
                statusIndicator.title = "Not a YouTube Video";
                return;
            }

            await chrome.tabs.sendMessage(tab.id, { action, ...payload });
            statusIndicator.classList.add('connected');
            statusIndicator.title = "Connected";
        } catch (error) {
            statusIndicator.classList.remove('connected');
            statusIndicator.title = "Connection Failed: " + error.message;

            // Attempt re-injection
            try {
                const tab = await getActiveTab();
                if (tab && tab.id && tab.url.includes('youtube.com/watch')) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    // fast retry
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, { action, ...payload }).catch(() => { });
                    }, 500);
                }
            } catch (e) {
                console.error("Re-injection failed", e);
            }
        }
    }

    // --- Play/Pause & Seek Logic ---
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            sendMessage('TOGGLE_PLAYBACK');
        });
    }
    const rwdBtn = document.getElementById('rwd-btn');
    const fwdBtn = document.getElementById('fwd-btn');
    if (rwdBtn) rwdBtn.addEventListener('click', () => sendMessage('SEEK_BY', { offset: -10 }));
    if (fwdBtn) fwdBtn.addEventListener('click', () => sendMessage('SEEK_BY', { offset: 10 }));

    // --- Playback Speed Logic ---
    speedSlider.addEventListener('input', (e) => {
        const speed = parseFloat(e.target.value);
        speedDisplay.textContent = speed + 'x';
        sendMessage('SET_SPEED', { speed });
    });

    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const speed = parseFloat(btn.dataset.speed);
            speedSlider.value = speed;
            speedDisplay.textContent = speed + 'x';
            sendMessage('SET_SPEED', { speed });
        });
    });

    // --- Loop Logic ---
    const clearLoopBtn = document.getElementById('clear-loop');
    const jumpLoopBtn = document.getElementById('jump-loop');

    setStartBtn.addEventListener('click', () => sendMessage('SET_LOOP_START'));
    setEndBtn.addEventListener('click', () => sendMessage('SET_LOOP_END'));

    if (clearLoopBtn) {
        clearLoopBtn.addEventListener('click', () => {
            loopStartInput.value = '';
            loopEndInput.value = '';
            sendMessage('CLEAR_LOOP');
        });
    }

    if (jumpLoopBtn) {
        jumpLoopBtn.addEventListener('click', () => {
            sendMessage('JUMP_LOOP_START');
        });
    }

    loopToggle.addEventListener('change', (e) => {
        sendMessage('TOGGLE_LOOP', { enabled: e.target.checked });
    });

    // --- Bookmarks Logic ---
    addBookmarkBtn.addEventListener('click', async () => {
        sendMessage('ADD_BOOKMARK_REQUEST');
    });

    function renderBookmark(time, niceTime) {
        const li = document.createElement('li');
        li.className = 'bookmark-item';
        li.dataset.seconds = time;

        li.innerHTML = `
        <div class="bookmark-controls">
            <button class="loop-set-btn" title="Set Loop Start">A</button>
            <button class="loop-set-btn" title="Set Loop End">B</button>
        </div>
        <input type="text" class="bookmark-time-input" value="${niceTime}">
        <span class="bookmark-desc" contenteditable="true">Note...</span>
        <button class="delete-btn">×</button>
      `;

        const timeInput = li.querySelector('.bookmark-time-input');
        const startBtn = li.querySelectorAll('.loop-set-btn')[0];
        const endBtn = li.querySelectorAll('.loop-set-btn')[1];
        const deleteBtn = li.querySelector('.delete-btn');

        // 1. Time Input Logic
        timeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') timeInput.blur();
        });
        timeInput.addEventListener('change', () => {
            const seconds = parseTime(timeInput.value);
            if (seconds !== null) {
                li.dataset.seconds = seconds;
                timeInput.value = formatTime(seconds);
                log(`Bookmark time updated to ${seconds}s`);
            } else {
                timeInput.value = formatTime(parseFloat(li.dataset.seconds));
            }
        });

        // 2. Loop Set Buttons
        startBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = parseFloat(li.dataset.seconds);
            log(`Sending SET_LOOP_START: ${s}`);
            sendMessage('SET_LOOP_START', { time: s });
        });

        endBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = parseFloat(li.dataset.seconds);
            log(`Sending SET_LOOP_END: ${s}`);
            sendMessage('SET_LOOP_END', { time: s });
        });

        // 3. Delete
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            li.remove();
        });

        // 4. Seek on row click
        li.addEventListener('click', (e) => {
            if (e.target !== timeInput &&
                e.target.tagName !== 'BUTTON' &&
                !e.target.isContentEditable) {
                const s = parseFloat(li.dataset.seconds);
                sendMessage('SEEK_TO', { time: s });
            }
        });

        bookmarksList.appendChild(li);
    }

    // --- Listen for Messages from Content Script ---
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'UPDATE_LOOP_TIMES') {
            if (message.start !== null) loopStartInput.value = formatTime(message.start);
            if (message.end !== null) loopEndInput.value = formatTime(message.end);

            if (typeof message.enabled === 'boolean') {
                loopToggle.checked = message.enabled;
            }

        } else if (message.action === 'BOOKMARK_ADDED') {
            renderBookmark(message.time, formatTime(message.time));
        } else if (message.action === 'PLAYBACK_STATUS') {
            if (playPauseBtn) {
                playPauseBtn.innerHTML = message.playing ? ICON_PAUSE : ICON_PLAY;
            }
        }
    });

    // Utility
    function formatTime(seconds) {
        if (typeof seconds !== 'number' || isNaN(seconds)) return "00:00";
        const date = new Date(0);
        date.setSeconds(seconds);
        const timeString = date.toISOString().substr(11, 8);
        return timeString.startsWith('00:') ? timeString.substr(3) : timeString;
    }

    function parseTime(timeStr) {
        if (!timeStr) return null;
        const parts = timeStr.split(':').map(Number);
        if (parts.some(isNaN)) return null;

        if (parts.length === 1) return parts[0];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return null;
    }

    // Initial Check
    getActiveTab().then(tab => {
        if (tab && tab.url.includes('youtube.com')) {
            chrome.sidePanel.setOptions({
                tabId: tab.id,
                path: 'sidebar.html',
                enabled: true
            });
            sendMessage('GET_STATUS');
        }
    });

} catch (err) {
    log("FATAL: " + err.message, 'error');
}
