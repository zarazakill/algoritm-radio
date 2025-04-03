document.addEventListener('DOMContentLoaded', function() {
    // Основные элементы управления
    const elements = {
        audio: document.getElementById('radio-stream'),
        playBtn: document.getElementById('play-btn'),
        statusEl: document.getElementById('stream-status'),
        volumeSlider: document.getElementById('volume-slider'),
        currentTrackEl: document.getElementById('current-track'),
        nextTrackEl: document.getElementById('next-track'),
        historyList: document.getElementById('history-list'),
        listenersCount: document.getElementById('listeners-count'),
        trackTitle: document.getElementById('track-title'),
        trackArtist: document.getElementById('track-artist'),
        currentTime: document.getElementById('current-time'),
        duration: document.getElementById('duration'),
        progressBar: document.getElementById('progress-bar')
    };

    // Конфигурация потоков и API
    const config = {
        streams: [
            "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio",
            "https://wwcat.duckdns.org:8000/radio",
            "http://wwcat.hopto.org:8000/radio"
        ],
        apiEndpoints: [
            "https://wwcat.duckdns.org:8443/api/nowplaying/1"
        ],
        updateInterval: 15000,
        connectionTimeout: 5000
    };

    // Состояние плеера
    const state = {
        currentStreamUrl: null,
        currentApiUrl: null,
        updateIntervalId: null,
        isPlaying: false
    };

    // Инициализация плеера
    async function initPlayer() {
        setStatus("Подключение...");
        
        try {
            state.currentStreamUrl = await findWorkingStream(config.streams);
            if (!state.currentStreamUrl) throw new Error("Все потоки недоступны");

            elements.audio.src = state.currentStreamUrl;
            elements.audio.crossOrigin = "anonymous";
            
            state.currentApiUrl = await findWorkingApi(config.apiEndpoints);
            await updateTrackInfo();
            state.updateIntervalId = setInterval(updateTrackInfo, config.updateInterval);
            setStatus("Готов к воспроизведению");
        } catch (error) {
            console.error("Ошибка инициализации:", error);
            setStatus(error.message, true);
            elements.playBtn.disabled = true;
        }
    }

    // Управление воспроизведением
    async function togglePlayback() {
        try {
            if (state.isPlaying) {
                elements.audio.pause();
                elements.playBtn.innerHTML = '<i class="fas fa-play"></i>';
                                setStatus("Пауза");
            } else {
                await elements.audio.play();
                elements.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                setStatus("Онлайн");
            }
            state.isPlaying = !state.isPlaying;
        } catch (error) {
            console.error("Ошибка воспроизведения:", error);
            setStatus("Нажмите разрешить", true);
        }
    }

    // Обновление информации о треках
    async function updateTrackInfo() {
        if (!state.currentApiUrl) return;

        try {
            const response = await fetchWithTimeout(state.currentApiUrl, config.connectionTimeout);
            const data = await response.json();
            updateUI(data);
        } catch (error) {
            console.error("Ошибка обновления треков:", error);
            state.currentApiUrl = await findWorkingApi(config.apiEndpoints);
        }
    }

    // Установка статуса
    function setStatus(message, isError = false) {
        elements.statusEl.textContent = message;
        if (isError) {
            elements.statusEl.classList.add('error');
        } else {
            elements.statusEl.classList.remove('error');
        }
    }

    // Добавьте обработчики событий для кнопок
    elements.playBtn.addEventListener('click', togglePlayback);
    
    // Инициализируйте плеер
    initPlayer();

    // Функции для нахождения рабочего потока и API
    async function findWorkingStream(streams) {
        for (const stream of streams) {
            try {
                const response = await fetch(stream, { method: 'HEAD', mode: 'no-cors' });
                if (response.ok || response.type === 'opaque') {
                    return stream; // Возвращаем первый доступный поток
                }
            } catch (error) {
                console.error(Ошибка доступа к потоку ${stream}:, error);
            }
        }
        return null; // Если ни один поток не доступен
    }

    async function findWorkingApi(apiEndpoints) {
        for (const api of apiEndpoints) {
            try {
                const response = await fetch(api);
                if (response.ok) {
                    return api; // Возвращаем первый доступный API
                }
            } catch (error) {
                console.error(Ошибка доступа к API ${api}:, error);
            }
        }
        return null; // Если ни один API не доступен
    }
});
