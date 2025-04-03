class RadioPlayer {
    constructor() {
        this.elements = {
            audio: document.getElementById('radio-stream'),
            playBtn: document.getElementById('play-btn'),
            statusEl: document.getElementById('stream-status'),
            volumeSlider: document.getElementById('volume-slider'),
            volumeBtn: document.getElementById('volume-btn'),
            currentTrackEl: document.getElementById('current-track'),
            nextTrackEl: document.getElementById('next-track'),
            historyList: document.getElementById('history-list'),
            listenersCount: document.getElementById('listeners-count')
        };

        this.config = {
            streams: [
                { url: "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio", priority: 1 },
                { url: "https://wwcat.duckdns.org:8000/radio", priority: 2 }
            ],
            apiEndpoints: [
                "https://wwcat.duckdns.org:8443/api/nowplaying/1"
            ],
            updateInterval: 15000,
            reconnectDelay: 3000,
            networkCheckInterval: 10000,
            bufferLength: 20,
            diagnostics: {
                enabled: true,
                logInterval: 60000
            }
        };

        this.state = {
            currentStream: null,
            currentApiUrl: null,
            isPlaying: false,
            retryCount: 0,
            networkQuality: 'good',
            lastUpdateTime: 0,
            audioContext: null,
            diagnostics: {
                bufferingEvents: 0,
                connectionErrors: 0,
                qualityChanges: 0,
                lastError: null
            }
        };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initAudioContext();
        await this.connectToStream();
        this.startDiagnostics();
    }

    async connectToStream() {
        try {
            this.setStatus("Подключение...");
            this.state.currentStream = await this.findWorkingStream();
            
            if (this.state.currentStream) {
                this.elements.audio.src = this.state.currentStream.url;
                this.elements.audio.crossOrigin = "anonymous";
                this.setupAudioBuffer();
                
                this.state.currentApiUrl = await this.findWorkingApi();
                if (this.state.currentApiUrl) {
                    await this.updateTrackInfo();
                    this.state.updateIntervalId = setInterval(() => this.updateTrackInfo(), this.config.updateInterval);
                }
                
                this.state.retryCount = 0;
                this.setStatus("Готов к воспроизведению");
            } else {
                throw new Error("Все потоки недоступны");
            }
        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    async findWorkingStream() {
        // Сортируем потоки по приоритету
        const sortedStreams = [...this.config.streams].sort((a, b) => a.priority - b.priority);
        
        for (const stream of sortedStreams) {
            try {
                if (await this.testStream(stream.url)) {
                    return stream;
                }
            } catch (error) {
                console.warn(`Поток недоступен: ${stream.url}`, error);
            }
        }
        return null;
    }

    async testStream(url) {
        try {
            // Используем AbortController для таймаута
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(url, { 
                method: 'HEAD', 
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            return true;
        } catch {
            return false;
        }
    }

    setupAudioBuffer() {
        // Используем Web Audio API для лучшего контроля буферизации
        if (!this.state.audioContext) return;
        
        const source = this.state.audioContext.createMediaElementSource(this.elements.audio);
        const analyser = this.state.audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(this.state.audioContext.destination);
    }

    async updateTrackInfo() {
        if (!this.state.currentApiUrl) return;
        
        try {
            const response = await this.fetchWithTimeout(this.state.currentApiUrl, 3000);
            const data = await response.json();
            this.updateUI(data);
            this.state.lastUpdateTime = Date.now();
        } catch (error) {
            console.error("Ошибка обновления треков:", error);
            this.state.currentApiUrl = await this.findWorkingApi();
        }
    }

    handleConnectionError(error) {
        console.error("Ошибка подключения:", error);
        this.state.diagnostics.connectionErrors++;
        this.state.diagnostics.lastError = error.message;
        
        this.setStatus("Ошибка подключения", true);
        this.elements.playBtn.disabled = true;
        
        // Экспоненциальная задержка для повторного подключения
        const delay = Math.min(this.config.reconnectDelay * (2 ** this.state.retryCount), 30000);
        this.state.retryCount++;
        
        setTimeout(() => {
            this.connectToStream();
        }, delay);
    }

    setupEventListeners() {
        this.elements.playBtn.addEventListener('click', () => this.togglePlayback());
        
        this.elements.volumeSlider.addEventListener('input', () => {
            this.elements.audio.volume = this.elements.volumeSlider.value;
            this.elements.audio.muted = false;
            this.updateVolumeIcon();
        });

        this.elements.volumeBtn.addEventListener('click', () => {
            this.elements.audio.muted = !this.elements.audio.muted;
            this.updateVolumeIcon();
        });

        this.elements.audio.addEventListener('playing', () => {
            this.state.isPlaying = true;
            this.setStatus("Онлайн");
        });

        this.elements.audio.addEventListener('pause', () => {
            this.state.isPlaying = false;
            this.setStatus("Пауза");
        });

        this.elements.audio.addEventListener('error', () => {
            this.handleConnectionError(new Error("Audio element error"));
        });

        this.elements.audio.addEventListener('stalled', () => {
            this.handleNetworkIssue();
        });

        this.elements.audio.addEventListener('waiting', () => {
            this.state.diagnostics.bufferingEvents++;
            this.handleNetworkIssue();
        });

        // Оптимизация для фоновых вкладок
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleBackgroundTab();
            } else {
                this.handleForegroundTab();
            }
        });
    }

    handleNetworkIssue() {
        // Адаптация к качеству сети
        if (this.state.networkQuality === 'good') {
            this.state.networkQuality = 'degraded';
            this.state.diagnostics.qualityChanges++;
            this.adjustForNetworkQuality();
        }
    }

    adjustForNetworkQuality() {
        switch (this.state.networkQuality) {
            case 'degraded':
                // Уменьшаем частоту обновлений в плохой сети
                clearInterval(this.state.updateIntervalId);
                this.state.updateIntervalId = setInterval(
                    () => this.updateTrackInfo(), 
                    this.config.updateInterval * 2
                );
                break;
            case 'good':
            default:
                // Восстанавливаем нормальные настройки
                clearInterval(this.state.updateIntervalId);
                this.state.updateIntervalId = setInterval(
                    () => this.updateTrackInfo(), 
                    this.config.updateInterval
                );
        }
    }

    handleBackgroundTab() {
        // Оптимизации для фоновых вкладок
        if (this.state.audioContext) {
            this.state.audioContext.suspend().catch(console.error);
        }
        
        clearInterval(this.state.updateIntervalId);
        this.state.updateIntervalId = setInterval(
            () => this.updateTrackInfo(), 
            this.config.updateInterval * 3
        );
    }

    handleForegroundTab() {
        // Восстановление нормальной работы
        if (this.state.audioContext) {
            this.state.audioContext.resume().catch(console.error);
        }
        
        clearInterval(this.state.updateIntervalId);
        this.state.updateIntervalId = setInterval(
            () => this.updateTrackInfo(), 
            this.config.updateInterval
        );
        
        if (this.state.isPlaying) {
            this.elements.audio.play().catch(console.error);
        }
    }

    initAudioContext() {
        try {
            this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Восстановление после авто-приостановки браузером
            document.addEventListener('click', () => {
                if (this.state.audioContext.state === 'suspended') {
                    this.state.audioContext.resume();
                }
            }, { once: true });
        } catch (error) {
            console.error("Ошибка инициализации AudioContext:", error);
        }
    }

    startDiagnostics() {
        if (!this.config.diagnostics.enabled) return;
        
        setInterval(() => {
            console.log('Диагностика плеера:', {
                networkQuality: this.state.networkQuality,
                bufferingEvents: this.state.diagnostics.bufferingEvents,
                connectionErrors: this.state.diagnostics.connectionErrors,
                qualityChanges: this.state.diagnostics.qualityChanges,
                lastError: this.state.diagnostics.lastError,
                currentStream: this.state.currentStream?.url,
                isPlaying: this.state.isPlaying,
                volume: this.elements.audio.volume,
                muted: this.elements.audio.muted
            });
        }, this.config.diagnostics.logInterval);
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
        const response = await fetchWithTimeout(url, config.connectionTimeout, { 
            method: 'HEAD', 
            mode: 'no-cors',
            cache: 'no-store'
        });
        return response.ok || response.status === 0; // CORS может вернуть status=0
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
    document.addEventListener('DOMContentLoaded', () => {
    new RadioPlayer();
});
