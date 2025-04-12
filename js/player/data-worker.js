self.onmessage = function(e) {
    const data = e.data;
    // Обработка данных в воркере
    const processed = {
        now_playing: processTrack(data.now_playing),
        history: data.song_history.map(processTrack)
    };
    postMessage(processed);
};

function processTrack(track) {
    return {
        title: track.song.title,
        artist: track.song.artist,
        duration: formatTime(track.duration)
    };
}
