document.addEventListener('DOMContentLoaded', function() {
    // Элементы управления
    const audio = document.getElementById('radio-stream');
    const playBtn = document.getElementById('play-btn');
    const statusEl = document.getElementById('stream-status');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeBtn = document.getElementById('volume-btn');
    const currentTrackEl = document.getElementById('current-track');
    const nextTrackEl = document.getElementById('next-track');
    const historyList = document.getElementById('history-list');

    // Настройки подключения
    const STREAMS = [
        "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio",
        "https://wwcat.duckdns.org:8000/radio"
    ];

    const API_ENDPOINTS = [
        "https://wwcat.duckdns.org:8443/api/nowplaying/1",
    ];

    // Текущие активные URL
    let currentStreamUrl = null;
    let currentApiUrl = null;
    let updateInterval = null;

    // Функция переключения воспроизведения
    async function togglePlayback() {
        if (audio.paused) {
            try {
                await audio.play();
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                setStatus("Онлайн");
            } catch (e) {
                setStatus("Нажмите разрешить", true);
                console.error("Ошибка воспроизведения:", e);
            }
        } else {
            audio.pause();
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            setStatus("Пауза");
        }
    }

    // Установка статуса
    function setStatus(text, isError = false) {
        statusEl.textContent = text;
        statusEl.className = isError ? 'status-error' : 'status-success';
    }

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
                updateInterval = setInterval(updateTrackInfo, 15000);
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
                const response = await fetchWithTimeout(apiUrl, 3000);
                if (response.ok) return apiUrl;
            } catch (e) {
                console.warn(`API ${apiUrl} недоступен:`, e.message);
            }
        }
        return null;
    }

    // Проверка доступности потока с таймаутом
    async function testStream(url) {
        try {
            await fetchWithTimeout(url, 5000, { method: 'HEAD', mode: 'no-cors' });
            return true;
        } catch {
            return false;
        }
    }

    // Обертка для fetch с таймаутом
    function fetchWithTimeout(url, timeout, options = {}) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Таймаут')), timeout)
            )
        ]);
    }

    // Обновление информации о треках
    async function updateTrackInfo() {
        if (!currentApiUrl) {
            currentApiUrl = await findWorkingApi();
            if (!currentApiUrl) return;
        }
        
        try {
            const response = await fetchWithTimeout(currentApiUrl, 3000);
            const data = await response.json();
            updateTrackUI(data);
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
            currentApiUrl = null; // Попробуем другой API в следующий раз
        }
    }

    // Обновление интерфейса с информацией о треках
    function updateTrackUI(data) {
        try {
            // Текущий трек
            const current = data.now_playing.song;
            currentTrackEl.innerHTML = `
                <strong>${current.title}</strong> - ${current.artist}
                <span class="progress">${formatTime(data.now_playing.elapsed)} / ${formatTime(data.now_playing.duration)}</span>
            `;
            
            // Следующий трек
            if (data.playing_next) {
                nextTrackEl.innerHTML = `
                    Далее: <strong>${data.playing_next.song.title}</strong> - ${data.playing_next.song.artist}
                `;
            }
            
            // История треков
    if (data.song_history) {
        const historyContainer = document.getElementById('history-list');
        historyContainer.innerHTML = '';
        
        data.song_history.slice(0, 5).forEach((track, index) => {
            const li = document.createElement('li');
            if (index === 0) li.classList.add('new-track');
            
            li.innerHTML = `
                <span>${track.title || 'Пока пусто'} - ${track.artist || 'слушаем дальше'}</span>
                <span class="track-time">${formatTime(track.duration || 0)}</span>
            `;
            historyContainer.appendChild(li);
        
        }

        } catch (e) {
            console.error("Ошибка обработки данных:", e);
        }
    }

    // Форматирование времени (mm:ss)
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Обновление иконки громкости
    function updateVolumeIcon() {
        if (audio.muted || audio.volume === 0) {
            volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (audio.volume < 0.5) {
            volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }

    // Обработчики событий
    playBtn.addEventListener('click', togglePlayback);
    
    volumeSlider.addEventListener('input', function() {
        audio.volume = this.value;
        audio.muted = false;
        updateVolumeIcon();
    });

    volumeBtn.addEventListener('click', function() {
        audio.muted = !audio.muted;
        updateVolumeIcon();
    });

    audio.addEventListener('canplay', () => {
        playBtn.disabled = false;
    });

    audio.addEventListener('error', () => {
        setStatus("Ошибка подключения", true);
        if (updateInterval) clearInterval(updateInterval);
    });

    // Инициализация
    audio.volume = volumeSlider.value;
    updateVolumeIcon();
    initPlayer();
});
