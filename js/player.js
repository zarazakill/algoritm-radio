document.addEventListener('DOMContentLoaded', function() {
    // Элементы управления
    const audio = document.getElementById('radio-stream');
    const playBtn = document.getElementById('play-btn');
    const statusEl = document.getElementById('stream-status');
    
    // Настройки подключения
    const STREAMS = [
        "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio",
        "https://wwcat.duckdns.org:8000/radio",
    ];

    const API_ENDPOINTS = [
        "https://wwcat.duckdns.org:8443/api/nowplaying/1",
    ];

    // Текущие активные URL
    let currentStreamUrl = null;
    let currentApiUrl = null;

    // Инициализация плеера
    async function initPlayer() {
        setStatus("Подключение...");
        
        // Поиск рабочего потока
        currentStreamUrl = await findWorkingStream();
        
        if (currentStreamUrl) {
            audio.src = currentStreamUrl;
            audio.crossOrigin = "anonymous";
            setStatus("Готов к воспроизведению");
            
            // Поиск рабочего API
            currentApiUrl = await findWorkingApi();
            if (currentApiUrl) {
                updateTrackInfo();
                setInterval(updateTrackInfo, 15000); // Обновление каждые 15 сек
            }
        } else {
            setStatus("Все потоки недоступны", true);
            playBtn.disabled = true;
        }
    }

    // Поиск рабочего аудиопотока
    async function findWorkingStream() {
        for (const streamUrl of STREAMS) {
            try {
                const isAvailable = await testStream(streamUrl);
                if (isAvailable) return streamUrl;
            } catch (e) {
                console.warn(`Поток ${streamUrl} недоступен:`, e.message);
            }
        }
        return null;
    }

    // Поиск рабочего API
    async function findWorkingApi() {
        for (const apiUrl of API_ENDPOINTS) {
            try {
                const response = await fetch(apiUrl, { timeout: 10000 });
                if (response.ok) return apiUrl;
            } catch (e) {
                console.warn(`API ${apiUrl} недоступен:`, e.message);
            }
        }
        return null;
    }

    // Проверка доступности потока
    async function testStream(url) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Таймаут подключения'));
            }, 10000);

            fetch(url, { 
                method: 'HEAD',
                mode: 'no-cors'
            })
            .then(() => {
                clearTimeout(timer);
                resolve(true);
            })
            .catch(() => {
                clearTimeout(timer);
                resolve(false);
            });
        });
    }

    // Обновление информации о треках
    async function updateTrackInfo() {
        if (!currentApiUrl) return;
        
        try {
            const response = await fetch(currentApiUrl, { timeout: 10000 });
            const data = await response.json();
            
            // Обработка данных треков...
            updateTrackUI(data);
            
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
            // Попробуем найти другой API при следующем обновлении
            currentApiUrl = await findWorkingApi();
        }
    }

    // Обработка событий плеера...
    playBtn.addEventListener('click', togglePlayback);
    // ... остальные обработчики событий

    // Запуск
    initPlayer();
});
