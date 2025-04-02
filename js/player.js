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
    const listenersCountEl = document.getElementById('listeners-count');

    // Настройки подключения
    const STREAMS = [
        "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio",
        "https://wwcat.duckdns.org:8000/radio"
    ];

    const API_ENDPOINTS = [
        "https://wwcat.duckdns.org:8443/api/nowplaying/1"
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

    // Форматирование времени (mm:ss)
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Обновление информации о слушателях
    function updateListenersCount(count) {
        if (!listenersCountEl) return;
        listenersCountEl.textContent = `${count} ${pluralize(count, ['слушатель', 'слушателя', 'слушателей'])}`;
    }

    // Склонение числительных
    function pluralize(number, words) {
        return words[
            (number % 100 > 4 && number % 100 < 20) ? 2 
            : [2, 0, 1, 1, 1, 2][(number % 10 < 5) ? Math.abs(number) % 10 : 5]
        ];
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
                await updateTrackInfo();
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
            
            // Обновляем количество слушателей
            if (data.listeners && data.listeners.current) {
                updateListenersCount(data.listeners.current);
            }
            
            return true;
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
            currentApiUrl = null;
            return false;
        }
    }

    // Обновление интерфейса с информацией о треках
    function updateTrackUI(data) {
        try {
            // Текущий трек
            const current = data.now_playing.song;
            const currentHtml = `
                <strong>${current.title || 'Неизвестный трек'}</strong> - ${current.artist || 'Неизвестный исполнитель'}
                <span class="progress">${formatTime(data.now_playing.elapsed)} / ${formatTime(data.now_playing.duration)}</span>
            `;
            
            if (currentTrackEl) {
                currentTrackEl.innerHTML = currentHtml;
            }
            
            // Следующий трек
            if (data.playing_next) {
                const nextHtml = `
                    Далее: <strong>${data.playing_next.song.title || 'Неизвестный трек'}</strong> - ${data.playing_next.song.artist || 'Неизвестный исполнитель'}
                `;
                
                if (nextTrackEl) {
                    nextTrackEl.innerHTML = nextHtml;
                }
            }
            
            // История треков
            if (data.song_history && historyList) {
                historyList.innerHTML = '';
                
                data.song_history.slice(0, 5).forEach((track, index) => {
                    const li = document.createElement('li');
                    if (index === 0) li.classList.add('new-track');
                    
                    li.innerHTML = `
                        <span>${track.title || 'Неизвестный трек'} - ${track.artist || 'Неизвестный исполнитель'}</span>
                        <span class="track-time">${formatTime(track.duration)}</span>
                    `;
                    historyList.appendChild(li);
                });
            }
        } catch (e) {
            console.error("Ошибка обработки данных:", e);
            throw e;
        }
    }

    // Обновление иконки громкости
    function updateVolumeIcon() {
        if (!volumeBtn) return;
        
        if (audio.muted || audio.volume === 0) {
            volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (audio.volume < 0.5) {
            volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }

    // Обработчики событий
    if (playBtn) {
        playBtn.addEventListener('click', togglePlayback);
    }
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', function() {
            audio.volume = this.value;
            audio.muted = false;
            updateVolumeIcon();
        });
    }

    if (volumeBtn) {
        volumeBtn.addEventListener('click', function() {
            audio.muted = !audio.muted;
            updateVolumeIcon();
        });
    }

    audio.addEventListener('canplay', () => {
        if (playBtn) playBtn.disabled = false;
    });

    audio.addEventListener('error', () => {
        setStatus("Ошибка подключения", true);
        if (updateInterval) clearInterval(updateInterval);
    });

    // Инициализация
    if (volumeSlider) audio.volume = volumeSlider.value;
    updateVolumeIcon();
    initPlayer();
});
