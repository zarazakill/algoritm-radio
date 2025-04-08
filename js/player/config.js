export const RadioConfig = {
    streams: [
        { url: "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio", priority: 1 },
        { url: "https://wwcat.duckdns.org:8000/radio", priority: 2 },
        { url: "http://wwcat.hopto.org:8000/radio", priority: 3 }
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
    }
};
