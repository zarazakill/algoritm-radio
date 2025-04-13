/**
 * Конфигурация радио-плеера
 * @typedef {Object} RadioPlayerConfig
 * @property {StreamConfig[]} streams - Доступные аудиопотоки
 * @property {string[]} apiEndpoints - API endpoints для получения информации о треках
 * @property {number} updateInterval - Интервал обновления информации (мс)
 * @property {number} reconnectDelay - Задержка перед повторным подключением (мс)
 * @property {number} networkCheckInterval - Интервал проверки сети (мс)
 * @property {number} bufferLength - Длина буфера аудио (секунды)
 * @property {DiagnosticsConfig} diagnostics - Настройки диагностики
 * @property {HistoryConfig} history - Настройки истории треков
 * @property {string} DEFAULT_THEME - Тема по умолчанию
 */

/**
 * Конфигурация аудиопотока
 * @typedef {Object} StreamConfig
 * @property {string} url - URL потока
 * @property {number} priority - Приоритет потока (1 - высший)
 * @property {string} [codec='audio/mpeg'] - Кодек потока
 * @property {boolean} [isBackup=false] - Является ли резервным потоком
 */

/**
 * Конфигурация диагностики
 * @typedef {Object} DiagnosticsConfig
 * @property {boolean} enabled - Включена ли диагностика
 * @property {number} logInterval - Интервал логирования (мс)
 * @property {string[]} [ignoredErrors] - Игнорируемые ошибки
 */

/**
 * Конфигурация истории треков
 * @typedef {Object} HistoryConfig
 * @property {number} maxItems - Максимальное количество отображаемых треков
 * @property {number} cacheSize - Сколько треков хранить в кеше
 * @property {number} animationDelay - Задержка анимации между элементами (мс)
 */

const RadioPlayerConfig = {
    streams: [
        { 
            url: "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio", 
            priority: 1,
            codec: 'audio/mpeg',
            isBackup: false
        },
        { 
            url: "https://wwcat.duckdns.org:8000/radio", 
            priority: 2,
            codec: 'audio/mpeg',
            isBackup: true
        },
    ],
    apiEndpoints: [
        "https://wwcat.duckdns.org:8443/api/nowplaying/1"
    ],
    updateInterval: 10000,
    reconnectDelay: 3000,
    networkCheckInterval: 10000,
    bufferLength: 20,
    diagnostics: {
        enabled: true,
        logInterval: 60000,
        ignoredErrors: [
            'NetworkError',
            'TimeoutError'
        ]
    },
    history: {
        maxItems: 5,
        cacheSize: 20,
        animationDelay: 100,
        persist: false
    },
    themes: {
        default: 'dark',
        available: ['dark', 'light', 'system']
    },
    fallback: {
        maxRetries: 3,
        fallbackImage: '/images/cover-fallback.png',
        fallbackTitle: 'Радио Алгоритм',
        fallbackArtist: 'Неизвестный исполнитель'
    },
    version: '1.0.0'
};

/**
 * Валидация конфигурации (только в development режиме)
 */
function validateConfig(config) {
    // Проверяем наличие глобальной переменной для определения режима
    const isDevelopment = window.__DEBUG_MODE__ || 
                        (typeof APP_ENV !== 'undefined' && APP_ENV === 'development');
    
    if (!isDevelopment) return;

    const requiredFields = [
        'streams', 'apiEndpoints', 'updateInterval',
        'reconnectDelay', 'bufferLength'
    ];

    requiredFields.forEach(field => {
        if (!(field in config)) {
            console.error(`Missing required config field: ${field}`);
        }
    });

    if (!config.streams.some(s => s.priority === 1)) {
        console.warn('No primary stream (priority 1) configured');
    }
}

// Выполняем валидацию
validateConfig(RadioPlayerConfig);

export default RadioPlayerConfig;
