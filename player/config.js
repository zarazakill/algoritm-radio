// Конфигурация радио-плеера
const RadioPlayerConfig = {
    // Основные потоки
    streams: [
        { url: "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio", priority: 1 },
        { url: "https://wwcat.duckdns.org:8000/radio", priority: 2 },
    ],
    
    // API endpoints
   apiEndpoints: {
        primary: "https://wwcat.duckdns.org:8443/api/nowplaying/1",
        fallback: "https://wwcat.duckdns.org:8000/api/nowplaying/1",
        nowPlaying: "https://wwcat.duckdns.org:8443/api/nowplaying/1",
        requests: "https://wwcat.duckdns.org:8443/api/station/1/requests",
        requestSong: "https://wwcat.duckdns.org:8443/api/station/1/request/:id"
    },

    apiUrls: [
        "https://wwcat.duckdns.org:8443/api/nowplaying/1"
    ],
    
    // Настройки AzuraCast
    azuraCast: {
        baseUrl: "https://wwcat.duckdns.org:8443",
        artworkBaseUrl: "https://wwcat.duckdns.org:8443",
        enableSongRequests: true // Включить запросы песен
    },
    
    // Настройки обновления
    updateInterval: 10000,          // Интервал обновления информации (мс)
    reconnectDelay: 3000,           // Задержка переподключения (мс)
    networkCheckInterval: 10000,    // Интервал проверки сети (мс)
    
    // Настройки буфера
    bufferLength: 20,               // Длина аудиобуфера (сек)
    
    // Диагностика
    diagnostics: {
        enabled: true,              // Включить диагностику
        logInterval: 60000          // Интервал логирования (мс)
    },
    
    // История прослушивания
    history: {
        maxItems: 5,                // Максимальное количество отображаемых треков
        cacheSize: 20,              // Сколько треков хранить в кеше
        animationDelay: 100         // Задержка анимации между элементами (мс)
    },
    
    // Настройки обложек альбомов
    artwork: {
        defaultUrl: "img/album-art/default.jpg", // Обложка по умолчанию
        size: 500,                               // Размер обложки (px)
        useProxy: false,                         // Использовать прокси для обложек
        proxyUrl: ""                             // URL прокси (если используется)
    },

    // Настройки эквалайзера
    equalizer: {
        gradients: [
            { start: '#fd79a8', mid: '#bfb8f5', end: '#00ffff' },
            { start: '#ff6e7f', mid: '#bfe9ff', end: '#ffda77' },
            { start: '#76b2fe', mid: '#b69efe', end: '#d387fe' },
            { start: '#42e695', mid: '#3bb2b8', end: '#2472d4' },
            { start: '#ffcd70', mid: '#ffb259', end: '#fd79a8' },
            { start: '#a8ff78', mid: '#78ffd6', end: '#a29bfe' }
        ]
    },
    
    // Тема по умолчанию
    DEFAULT_THEME: 'dark'
};

// Экспорт конфигурации
export default RadioPlayerConfig;