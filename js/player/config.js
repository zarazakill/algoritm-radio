// Конфигурация радио-плеера
const RadioPlayerConfig = {
    streams: [
        { url: "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio", priority: 1 },
        { url: "https://wwcat.duckdns.org:8000/radio", priority: 2 },
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
        logInterval: 60000
    },
    history: {
        maxItems: 5,          // Максимальное количество отображаемых треков
        cacheSize: 20,        // Сколько треков хранить в кеше
        animationDelay: 100    // Задержка анимации между элементами (мс)
    }
};

// Экспорт конфигурации
export default RadioPlayerConfig;
