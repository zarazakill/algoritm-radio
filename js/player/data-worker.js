function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function processTrack(track) {
    if (!track) return null;
    
    return {
        title: track.song?.title || 'Неизвестный трек',
        artist: track.song?.artist || 'Неизвестный исполнитель',
        duration: track.duration ? formatTime(track.duration) : ''
    };
}

self.onmessage = function(e) {
    try {
        const data = e.data;
        const processed = {
            now_playing: processTrack(data.now_playing),
            history: Array.isArray(data.song_history) ? 
                data.song_history.map(processTrack).filter(Boolean) : 
                []
        };
        postMessage(processed);
    } catch (error) {
        console.error('Worker error:', error);
        postMessage({ error: error.message });
    }
};
