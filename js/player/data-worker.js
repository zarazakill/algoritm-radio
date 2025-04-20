// Константы для типов сообщений
const MESSAGE_TYPES = {
    PROCESS: 'process',
    SUCCESS: 'success',
    ERROR: 'error'
};

// Оптимизированная функция форматирования времени
function formatTime(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Более надежная обработка трека
function processTrack(track) {
    if (!track || typeof track !== 'object') {
        return {
            title: 'Неизвестный трек',
            artist: 'Неизвестный исполнитель',
            duration: '0:00'
        };
    }

    const song = track.song || {};
    return {
        title: song.title || 'Неизвестный трек',
        artist: song.artist || 'Неизвестный исполнитель',
        duration: track.duration ? formatTime(track.duration) : '0:00'
    };
}

// Обработчик сообщений
self.onmessage = function(e) {
    try {
        if (!e.data || e.data.type !== MESSAGE_TYPES.PROCESS) {
            throw new Error('Invalid message format');
        }

        const { now_playing, song_history } = e.data.payload || {};
        
        const processed = {
            now_playing: processTrack(now_playing),
            history: Array.isArray(song_history) 
                ? song_history.map(processTrack)
                : []
        };

        postMessage({
            type: MESSAGE_TYPES.SUCCESS,
            payload: processed
        });

    } catch (error) {
        postMessage({
            type: MESSAGE_TYPES.ERROR,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
};
