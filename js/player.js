document.addEventListener('DOMContentLoaded', function() {
    // Основные элементы управления
    const elements = {
        audio: document.getElementById('radio-stream'),
        playBtn: document.getElementById('play-btn'),
        statusEl: document.getElementById('stream-status'),
        volumeSlider: document.getElementById('volume-slider'),
        volumeBtn: document.getElementById('volume-btn'),
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
            // Поиск рабочего потока
            state.currentStreamUrl = await findWorkingStream(config.streams);
            
            if (state.currentStreamUrl) {
                elements.audio.src = state.currentStreamUrl;
                elements.audio.crossOrigin = "anonymous";
                
                // Поиск рабочего API
                state.currentApiUrl = await findWorkingApi(config.apiEndpoints);
                
                if (state.currentApiUrl) {
                    await updateTrackInfo();
                    state.updateIntervalId = setInterval(updateTrackInfo, config.updateInterval);
                    setStatus("Готов к воспроизведению");
                }
            } else {
                throw new Error("Все потоки недоступны");
            }
        } catch (error) {
            console.error("Ошибка инициализации:", error);
            setStatus(error.message, true);
            elements.playBtn.disabled = true;
        }
    }

    // Управление воспроизведением
    async function togglePlayback() {
        try {
            if (elements.audio.paused) {
                await elements.audio.play();
                elements.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                setStatus("Онлайн");
                state.isPlaying = true;
            } else {
                elements.audio.pause();
                elements.playBtn.innerHTML = '<i class="fas fa-play"></i>';
                setStatus("Пауза");
                state.isPlaying = false;
            }
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

    // Обновление интерфейса
    function updateUI(data) {
        // Текущий трек
        updateCurrentTrack(data.now_playing);
        
        // Следующий трек
        if (data.playing_next) {
            updateNextTrack(data.playing_next);
        }
        
        // История треков
        if (data.song_history) {
            updateHistory(data.song_history);
        }
        
        // Количество слушателей
        if (data.listeners && data.listeners.current) {
            updateListenersCount(data.listeners.current);
        }
    }

    // Обновление текущего трека
    function updateCurrentTrack(nowPlaying) {
        const track = nowPlaying.song;
        const html = `
            <span class="track-name">${track.title || 'Неизвестный трек'}</span>
            <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
            <span class="track-progress">${formatTime(nowPlaying.elapsed)} / ${formatTime(nowPlaying.duration)}</span>
        `;
        
        if (elements.currentTrackEl) elements.currentTrackEl.innerHTML = html;
        if (elements.trackTitle) elements.trackTitle.textContent = track.title || 'Неизвестный трек';
        if (elements.trackArtist) elements.trackArtist.textContent = track.artist || 'Неизвестный исполнитель';
        if (elements.duration) elements.duration.textContent = formatTime(nowPlaying.duration);
    }

    // Обновление следующего трека
    function updateNextTrack(playingNext) {
        const track = playingNext.song;
        const html = `
            <span class="track-name">${track.title || 'Неизвестный трек'}</span>
            <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
        `;
        
        if (elements.nextTrackEl) elements.nextTrackEl.innerHTML = html;
    }

    // Обновление истории треков
function updateTrackUI(data) {
    try {
        // Текущий трек
        updateCurrentTrack(data.now_playing);
        
        // Следующий трек
        if (data.playing_next) {
            updateNextTrack(data.playing_next);
        }
        
        // История треков (правильная обработка структуры)
        if (data.song_history && Array.isArray(data.song_history)) {
            updateHistory(data.song_history);
        }
        
        // Количество слушателей
        if (data.listeners && data.listeners.current) {
            updateListenersCount(data.listeners.current);
        }
    } catch (e) {
        console.error("Ошибка обработки данных:", e);
    }
}

// Обновленная функция для истории треков
function updateHistory(history) {
    if (!elements.historyList || !history) return;
    
    elements.historyList.innerHTML = '';
    
    // Берем последние 5 треков (новые сверху)
    const recentTracks = history.slice(0, 5);
    
    recentTracks.forEach((item, index) => {
        const li = document.createElement('li');
        if (index === 0) li.classList.add('new-track');
        
        // Проверяем наличие данных в правильной структуре
        const song = item.song || {};
        const title = song.title || 'Неизвестный трек';
        const artist = song.artist || 'Неизвестный исполнитель';
        const duration = item.duration ? formatTime(item.duration) : '';
        
        li.innerHTML = `
            <span class="track-title">${title}</span>
            <span class="track-artist">${artist}</span>
            ${duration ? `<span class="track-time">${duration}</span>` : ''}
        `;
        
        elements.historyList.appendChild(li);
    });
}

    // Обновление счетчика слушателей
    function updateListenersCount(count) {
        if (elements.listenersCount) {
            elements.listenersCount.textContent = `${count} ${pluralize(count, ['слушатель', 'слушателя', 'слушателей'])}`;
        }
    }

    // Установка статуса
    function setStatus(text, isError = false) {
        if (elements.statusEl) {
            elements.statusEl.textContent = text;
            elements.statusEl.className = isError ? 'status-error' : 'status-success';
        }
    }

    // Вспомогательные функции
    async function findWorkingStream(streams) {
        for (const streamUrl of streams) {
            try {
                if (await testStream(streamUrl)) return streamUrl;
            } catch (error) {
                console.warn(`Поток недоступен: ${streamUrl}`, error);
            }
        }
        return null;
    }

    async function findWorkingApi(apiEndpoints) {
        for (const apiUrl of apiEndpoints) {
            try {
                const response = await fetchWithTimeout(apiUrl, config.connectionTimeout);
                if (response.ok) return apiUrl;
            } catch (error) {
                console.warn(`API недоступен: ${apiUrl}`, error);
            }
        }
        return null;
    }

    async function testStream(url) {
        try {
            await fetchWithTimeout(url, config.connectionTimeout, { method: 'HEAD', mode: 'no-cors' });
            return true;
        } catch {
            return false;
        }
    }

    function fetchWithTimeout(url, timeout, options = {}) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Таймаут подключения')), timeout)
            )
        ]);
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function pluralize(number, words) {
        return words[
            (number % 100 > 4 && number % 100 < 20) ? 2 
            : [2, 0, 1, 1, 1, 2][(number % 10 < 5) ? Math.abs(number) % 10 : 5]
        ];
    }

    function updateVolumeIcon() {
        if (!elements.volumeBtn) return;
        
        if (elements.audio.muted || elements.audio.volume === 0) {
            elements.volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (elements.audio.volume < 0.5) {
            elements.volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            elements.volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }

    // Обработчики событий
    function setupEventListeners() {
        if (elements.playBtn) {
            elements.playBtn.addEventListener('click', togglePlayback);
        }
        
        if (elements.volumeSlider) {
            elements.volumeSlider.addEventListener('input', () => {
                elements.audio.volume = elements.volumeSlider.value;
                elements.audio.muted = false;
                updateVolumeIcon();
            });
        }

        if (elements.volumeBtn) {
            elements.volumeBtn.addEventListener('click', () => {
                elements.audio.muted = !elements.audio.muted;
                updateVolumeIcon();
            });
        }

        elements.audio.addEventListener('timeupdate', () => {
            if (elements.currentTime && elements.progressBar) {
                elements.currentTime.textContent = formatTime(elements.audio.currentTime);
                elements.progressBar.value = (elements.audio.currentTime / elements.audio.duration) * 100 || 0;
            }
        });

        elements.audio.addEventListener('canplay', () => {
            if (elements.playBtn) elements.playBtn.disabled = false;
        });

        elements.audio.addEventListener('error', () => {
            setStatus("Ошибка подключения", true);
            if (state.updateIntervalId) clearInterval(state.updateIntervalId);
        });
    }

    // Инициализация
    function init() {
        if (elements.volumeSlider) {
            elements.audio.volume = elements.volumeSlider.value;
        }
        updateVolumeIcon();
        setupEventListeners();
        initPlayer();
    }

    // Запуск
    init();
});
