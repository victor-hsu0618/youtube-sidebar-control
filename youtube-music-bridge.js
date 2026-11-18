// Runs in the YouTube Music page's MAIN world so its player API and globals
// are visible. Mirrors CueRack's current track ID and media element lookup.
(() => {
    const SOURCE = 'yt-study-music-bridge';
    if (window.__ytStudyMusicBridgeInstalled) return;
    window.__ytStudyMusicBridgeInstalled = true;

    function getMoviePlayer() {
        return document.getElementById('movie_player') || window.movie_player || null;
    }

    function videoIdFromURL(value) {
        if (!value) return '';
        try {
            return new URL(value, window.location.href).searchParams.get('v') || '';
        } catch (_) {
            return '';
        }
    }

    function getCurrentVideoId(playerBar, player) {
        try {
            const id = player?.getVideoData?.()?.video_id;
            if (id) return String(id);
        } catch (_) { }

        try {
            const id = window.ytInitialPlayerResponse?.videoDetails?.videoId;
            if (id) return String(id);
        } catch (_) { }

        for (const attribute of ['video-id', 'videoid', 'data-video-id', 'playback-data-id']) {
            const id = playerBar?.getAttribute(attribute);
            if (id) return id;
        }

        const link = playerBar?.querySelector('a[href*="watch?v="], a[href*="youtu.be/"]');
        if (link) {
            const id = videoIdFromURL(link.href || link.getAttribute('href'));
            if (id) return id;
            try {
                const parsed = new URL(link.href, window.location.href);
                const shortId = parsed.hostname.includes('youtu.be')
                    ? parsed.pathname.split('/').filter(Boolean)[0]
                    : '';
                if (shortId) return shortId;
            } catch (_) { }
        }
        return new URLSearchParams(window.location.search).get('v') || '';
    }

    function selectMedia(playerBar) {
        const selectors = [
            'ytmusic-player-page video',
            'ytmusic-player-bar video',
            'ytmusic-app video',
            'video.html5-main-video',
            'video',
            'audio'
        ];
        const candidates = [];
        for (const selector of selectors) {
            document.querySelectorAll(selector).forEach(media => {
                if (!candidates.includes(media)) candidates.push(media);
            });
        }

        const usable = candidates.filter(media => {
            const duration = Number(media.duration || 0);
            const isAd = media.closest('.ad-showing, .ytp-ad-player-overlay, .video-ads');
            return !isAd && (
                !media.paused || Number(media.currentTime || 0) > 0 ||
                (Number.isFinite(duration) && duration > 0) ||
                Boolean(media.currentSrc || media.src)
            );
        });
        usable.sort((a, b) => {
            const score = media => (!media.paused ? 1000 : 0)
                + Number(media.currentTime || 0)
                + (Number(media.duration || 0) > 0 ? 100 : 0);
            return score(b) - score(a);
        });
        return usable[0] || candidates[0] || playerBar?.querySelector('audio, video') || null;
    }

    function readState() {
        const playerBar = document.querySelector('ytmusic-player-bar');
        const player = getMoviePlayer();
        const media = selectMedia(playerBar);
        let playerData = {};
        try {
            playerData = player?.getVideoData?.() || {};
        } catch (_) { }

        const videoId = getCurrentVideoId(playerBar, player);
        if (!videoId) return;

        let isPlaying = Boolean(media && !media.paused && !media.ended);
        try {
            const state = Number(player?.getPlayerState?.());
            if (state === 1 || state === 3) isPlaying = true;
            else if (state === 0 || state === 2 || state === 5) isPlaying = false;
        } catch (_) { }

        const title = String(playerData.title ||
            playerBar?.querySelector('.title')?.textContent ||
            playerBar?.querySelector('yt-formatted-string.title')?.textContent ||
            playerBar?.querySelector('[data-title]')?.getAttribute('data-title') || '').trim();

        window.postMessage({
            source: SOURCE,
            videoId,
            title,
            currentTime: Number(media?.currentTime || 0),
            duration: Number(media?.duration || 0),
            isPlaying,
            playbackRate: Number(media?.playbackRate || 1)
        }, window.location.origin);
    }

    readState();
    window.setInterval(readState, 750);
    document.addEventListener('yt-navigate-finish', readState);
    document.addEventListener('yt-page-data-updated', readState);
})();
