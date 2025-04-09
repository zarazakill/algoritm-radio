export const RadioConfig = {
    streams: [
        { url: "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio", priority: 1 },
        { url: "https://wwcat.duckdns.org:8000/radio", priority: 2 }
    ],
    apiEndpoints: [
        "https://wwcat.duckdns.org:8443/api/nowplaying/1"
    ],
    updateInterval: 10000
};
