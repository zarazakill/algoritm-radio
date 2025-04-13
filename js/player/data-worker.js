// Константы для сообщений об ошибках
const ERROR_MESSAGES = {
    INVALID_DATA: 'Invalid data structure received',
    INVALID_TRACK: 'Invalid track data format',
    PROCESSING_ERROR: 'Data processing error'
};

// Кеш для форматированных значений времени
const timeFormatCache = new Map();

/**
 * Форматирование времени с кешированием результатов
 * @param {number} seconds - время в секундах
 * @returns {string} - отформатированная строка mm:ss
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    
    const totalSeconds = Math.floor(seconds);
    if (timeFormatCache.has(totalSeconds)) {
        return timeFormatCache.get(totalSeconds);
    }

    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    
    timeFormatCache.set(totalSeconds, formatted);
    return formatted;
}

/**
 * Валидация структуры трека
 * @param {object} track - объект трека
 * @returns {boolean} - валидность данных
 */
function isValidTrack(track) {
    return track && typeof track === 'object' && 
          (track.song || track.duration !== undefined);
}

/**
 * Обработка данных трека
 * @param {object} track - объект трека
 * @returns {object|null} - обработанные данные или null
 */
function processTrack(track) {
    try {
        if (!isValidTrack(track)) {
            console.warn(ERROR_MESSAGES.INVALID_TRACK, track);
            return null;
        }

        return {
            id: track.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
            title: track.song?.title?.trim() || 'Неизвестный трек',
            artist: track.song?.artist?.trim() || 'Неизвестный исполнитель',
            duration: track.duration ? formatTime(track.duration) : '',
            timestamp: track.timestamp || Date.now(),
            raw: track // Сохраняем оригинальные данные
        };
    } catch (error) {
        console.error(ERROR_MESSAGES.PROCESSING_ERROR, error);
        return null;
    }
}

/**
 * Валидация входящих данных
 * @param {object} data - входные данные
 * @returns {boolean} - валидность данных
 */
function validateInput(data) {
    return data && typeof data === 'object' && 
          (data.now_playing || Array.isArray(data.song_history));
}

// Обработчик сообщений
self.onmessage = function(e) {
    try {
        const data = e.data;
        
        if (!validateInput(data)) {
            throw new Error(ERROR_MESSAGES.INVALID_DATA);
        }

        const processed = {
            nowPlaying: processTrack(data.now_playing),
            history: Array.isArray(data.song_history) ? 
                data.song_history
                    .map(processTrack)
                    .filter(Boolean)
                    .sort((a, b) => b.timestamp - a.timestamp) : 
                [],
            meta: {
                processedAt: Date.now(),
                workerVersion: '1.1.0'
            }
        };

        postMessage({
            status: 'success',
            data: processed
        });
        
    } catch (error) {
        console.error('Worker error:', error);
        postMessage({
            status: 'error',
            error: {
                message: error.message,
                stack: error.stack,
                type: error.name
            }
        });
    }
};

// Обработчик ошибок
self.onerror = function(error) {
    console.error('Worker global error:', error);
    postMessage({
        status: 'fatal',
        error: {
            message: 'Worker fatal error',
            type: 'FatalError'
        }
    });
    return true; // Предотвращаем стандартную обработку ошибки
};
