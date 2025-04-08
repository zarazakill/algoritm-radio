document.addEventListener('DOMContentLoaded', () => {
    class RadioPlayer {
        constructor() {
            this.elements = {
                audio: document.getElementById('radio-stream'),
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
                          progressBar: document.getElementById('progress-bar'),
                          duration: document.getElementById('duration')
            };
            
            document.getElementById('start-playback').addEventListener('click', () => {
                document.getElementById('audio-overlay').style.display = 'none';
                this.elements.audio.play()
                .then(() => {
                    if (this.state.audioContext) {
                        this.state.audioContext.resume();
                    }
                })
                .catch(console.error);
            });
            
            this.config = {
                streams: [
                    { url: "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio", priority: 1 },
                    { url: "https://wwcat.duckdns.org:8000/radio", priority: 2 },
                ],
                apiEndpoints: [
                    "https://wwcat.duckdns.org:8443/api/nowplaying/1"
                ],
                /* The time between track info updates in milliseconds. */
                updateInterval: 10000,
                /* The delay before attempting to reconnect in milliseconds. */
                reconnectDelay: 3000,
                /* The time between checking the network in milliseconds. */
                networkCheckInterval: 10000,
                bufferLength: 20,
                diagnostics: {
                    /* Enable or disable diagnostic logging. */
                    enabled: true,
                    /* The interval for diagnostic logging in milliseconds. */
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
            this.elements.audio.autoplay = true;
            this.init();
        }
        
        /* @tweakable initial theme: light or dark */
        static DEFAULT_THEME = 'dark';
        
        async init() {
            try {
                // Инициализация базовых компонентов
                this.setupThemeToggle();
                this.setupEventListeners();
                this.initAudioContext();
                
                // Параллельная инициализация потоков и API
                const [streamResult, apiResult] = await Promise.allSettled([
                    this.connectToStream(),
                                                                           this.findWorkingApi()
                ]);
                
                // Обработка результатов
                if (streamResult.status === 'rejected') {
                    console.error('Ошибка подключения к потоку:', streamResult.reason);
                    this.handleConnectionError(streamResult.reason);
                }
                
                if (apiResult.status === 'rejected') {
                    console.error('Ошибка поиска рабочего API:', apiResult.reason);
                } else {
                    this.state.currentApiUrl = apiResult.value;
                }
                
                // Запускаем диагностику и обновление треков
                this.startDiagnostics();
                
                // Обновляем информацию сразу при инициализации
                await this.updateTrackInfo(); 
                
                // Затем запускаем периодическое обновление
                this.state.updateIntervalId = setInterval(
                    () => this.updateTrackInfo(), 
                                                          this.config.updateInterval
                );
                
            } catch (error) {
                console.error('Ошибка инициализации плеера:', error);
                this.cleanup(); // Очищаем ресурсы при ошибке
                throw error; // Пробрасываем ошибку выше
            }
        }
        
        // Добавляем метод для очистки ресурсов
        cleanup() {
            if (this.state.updateIntervalId) {
                clearInterval(this.state.updateIntervalId);
                this.state.updateIntervalId = null;
            }
            // Дополнительная очистка при необходимости
        }
        
        setupThemeToggle() {
            const body = document.body;
            const themeToggleBtn = document.createElement('button');
            themeToggleBtn.classList.add('theme-toggle');
            themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            
            // Set initial theme based on localStorage or default
            const savedTheme = localStorage.getItem('theme') || RadioPlayer.DEFAULT_THEME;
            body.classList.add(savedTheme + '-theme');
            this.updateThemeIcon(themeToggleBtn, savedTheme);
            
            themeToggleBtn.addEventListener('click', () => {
                const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                body.classList.remove(currentTheme + '-theme');
                body.classList.add(newTheme + '-theme');
                localStorage.setItem('theme', newTheme);
                this.updateThemeIcon(themeToggleBtn, newTheme);
            });
            
            document.querySelector('.container').appendChild(themeToggleBtn);
        }
        
        updateThemeIcon(button, theme) {
            button.innerHTML = theme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        }
        
        setupEventListeners() {
            
            const handleFirstInteraction = () => {
                if (this.state.audioContext && this.state.audioContext.state === 'suspended') {
                    this.state.audioContext.resume();
                }
                document.removeEventListener('click', handleFirstInteraction);
            };
            
            document.addEventListener('click', handleFirstInteraction);
            
            this.elements.volumeBtn.addEventListener('click', () => {
                this.elements.audio.muted = !this.elements.audio.muted;
                this.updateVolumeIcon();
            });
            
            this.elements.volumeSlider.addEventListener('input', (e) => {
                this.elements.audio.volume = e.target.value;
                this.updateVolumeIcon();
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
            
            this.elements.audio.addEventListener('timeupdate', () => {
                if (this.elements.currentTime && this.elements.progressBar) {
                    this.elements.currentTime.textContent = this.formatTime(this.elements.audio.currentTime);
                    this.elements.progressBar.value = (this.elements.audio.currentTime / this.elements.audio.duration) * 100 || 0;
                }
            });
            
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.handleBackgroundTab();
                } else {
                    this.handleForegroundTab();
                }
            });
        }
        
        async connectToStream() {
            try {
                this.setStatus("Подключение...");
                this.state.currentStream = await this.findWorkingStream();
                
                if (!this.state.currentStream) {
                    throw new Error("Все потоки недоступны");
                }
                
                // Сброс предыдущего источника
                this.elements.audio.src = '';
                this.elements.audio.src = this.state.currentStream.url;
                this.elements.audio.load();
                
                // Установка флага готовности
                this.elements.audio.oncanplay = () => {
                    this.setStatus("слушаем музыку...");
                };
                
            } catch (error) {
                this.setStatus("Ошибка подключения", true);
                this.handleConnectionError(error);
            }
        }
        
        async findWorkingStream() {
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
            if (!this.state.audioContext) return;
            
            const source = this.state.audioContext.createMediaElementSource(this.elements.audio);
            const analyser = this.state.audioContext.createAnalyser();
            source.connect(analyser);
            analyser.connect(this.state.audioContext.destination);
        }
        
        async togglePlayback() {
            try {
                // Если уже воспроизводится - ставим на паузу
                if (!this.elements.audio.paused) {
                    this.elements.audio.pause();
                    this.state.isPlaying = false;
                    this.setStatus("Пауза");
                    return;
                }
                
                // Проверяем, есть ли текущий поток
                if (!this.state.currentStream) {
                    await this.connectToStream();
                }
                
                // Проверяем autoplay policy браузера
                const playPromise = this.elements.audio.play();
                
                if (playPromise !== undefined) {
                    await playPromise
                    .then(() => {
                        this.state.isPlaying = true;
                        this.setStatus("Слушаем музыку...");
                    })
                    .catch(error => {
                        // Обрабатываем ошибку autoplay
                        if (error.name === 'NotAllowedError') {
                            this.setStatus("Нажмите для запуска", true);
                            document.getElementById('audio-overlay').style.display = 'flex';
                        }
                        console.error("Ошибка воспроизведения:", error);
                        throw error; // Пробрасываем ошибку дальше
                    });
                }
                
                // Обновляем интерфейс
                this.updateVolumeIcon();
                
            } catch (error) {
                this.setStatus("Ошибка: " + (error.message || "Неизвестная ошибка"), true);
                this.handleConnectionError(error);
            }
        }
        
        async updateTrackInfo() {
            if (!this.state.currentApiUrl) {
                this.state.currentApiUrl = await this.findWorkingApi();
                if (!this.state.currentApiUrl) return;
            }
            
            try {
                const response = await this.fetchWithTimeout(this.state.currentApiUrl, 2000);
                const data = await response.json();
                this.updateUI(data);
                this.state.lastUpdateTime = Date.now();
                
                // Форсированное обновление при первом подключении
                if (this.firstUpdate) {
                    this.updateUI(data);
                    this.firstUpdate = false;
                }
            } catch (error) {
                console.error("Ошибка обновления:", error);
                this.state.currentApiUrl = await this.findWorkingApi();
            }
        }
        
        
        updateUI(data) {
            if (!data) {
                console.warn('Получены пустые данные для обновления UI');
                this.showFallbackData();
                return;
            }
            
            try {
                // Основная информация о текущем треке
                if (data.now_playing) {
                    this.updateCurrentTrack(data.now_playing);
                } else {
                    this.showNoTrackPlaying();
                }
                
                // Информация о следующем треке
                if (data.playing_next?.song) {
                    this.updateNextTrack(data.playing_next);
                } else {
                    this.clearNextTrackInfo();
                }
                
                // История проигрывания
                if (Array.isArray(data.song_history)) {
                    this.updateHistory(data.song_history);
                } else if (data.song_history) {
                    console.warn('Некорректный формат истории треков', data.song_history);
                }
                
                // Количество слушателей
                if (data.listeners?.current !== undefined) {
                    this.updateListenersCount(data.listeners.current);
                }
                
            } catch (error) {
                console.error('Ошибка при обновлении UI:', error);
                this.setStatus('Ошибка обновления данных', true);
            }
        }
        
        // Новые вспомогательные методы:
        
        showFallbackData() {
            this.elements.currentTrackEl.innerHTML = `
            <span class="track-name">Нет данных</span>
            <span class="track-artist">Попробуйте обновить позже</span>
            `;
            this.clearNextTrackInfo();
        }
        
        showNoTrackPlaying() {
            this.elements.currentTrackEl.innerHTML = `
            <span class="track-name">Трек не воспроизводится</span>
            <span class="track-artist">Ожидание данных...</span>
            `;
        }
        
        clearNextTrackInfo() {
            if (this.elements.nextTrackEl) {
                this.elements.nextTrackEl.innerHTML = `
                <span class="track-name">Следующий трек неизвестен</span>
                `;
            }
        }
        
        updateCurrentTrack(nowPlaying) {
            const track = nowPlaying.song;
            const html = `
            <span class="track-name">${track.title || 'Неизвестный трек'}</span>
            <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
            <span class="track-progress">${this.formatTime(nowPlaying.elapsed)} / ${this.formatTime(nowPlaying.duration)}</span>
            `;
            
            if (this.elements.currentTrackEl) this.elements.currentTrackEl.innerHTML = html;
            
            // Добавленные строки для обновления заголовка и исполнителя:
            if (this.elements.trackTitle) {
                this.elements.trackTitle.textContent = track.title || 'Неизвестный трек';
            }
            if (this.elements.trackArtist) {
                this.elements.trackArtist.textContent = track.artist || 'Неизвестный исполнитель';
            }
            if (this.elements.duration) {
                this.elements.duration.textContent = this.formatTime(nowPlaying.duration);
                
            }
            if (!nowPlaying) {
                this.elements.trackTitle.textContent = 'Нет данных';
                this.elements.trackArtist.textContent = '';
                return;
            }
        }
        
        updateNextTrack(playingNext) {
            try {
                // Проверяем наличие элемента в DOM
                if (!this.elements.nextTrackEl) {
                    console.warn('Элемент nextTrackEl не найден');
                    return;
                }
                
                // Проверяем входные данные
                if (!playingNext || !playingNext.song) {
                    this.elements.nextTrackEl.innerHTML = `
                    <span class="track-name">Нет данных о следующем треке</span>
                    `;
                    return;
                }
                
                const track = playingNext.song;
                
                // Подготавливаем данные с fallback-значениями
                const trackData = {
                    title: track.title || 'Неизвестный трек',
                    artist: track.artist || 'Неизвестный исполнитель',
                    duration: track.duration ? this.formatTime(track.duration) : null
                };
                
                // Формируем HTML с учетом всех возможных данных
                let html = `
                <span class="track-name">${trackData.title}</span>
                <span class="track-artist">${trackData.artist}</span>
                `;
                
                // Добавляем длительность трека, если доступна
                if (trackData.duration) {
                    html += `<span class="track-duration">${trackData.duration}</span>`;
                }
                
                // Безопасное обновление DOM
                this.elements.nextTrackEl.innerHTML = html;
                
                // Добавляем класс для анимации
                this.elements.nextTrackEl.classList.add('new-track');
                setTimeout(() => {
                    this.elements.nextTrackEl.classList.remove('new-track');
                }, 1000);
                
            } catch (error) {
                console.error('Ошибка при обновлении информации о следующем треке:', error);
                
                // Fallback отображение при ошибке
                if (this.elements.nextTrackEl) {
                    this.elements.nextTrackEl.innerHTML = `
                    <span class="error-message">Ошибка загрузки данных</span>
                    `;
                }
            }
        }
        
        updateTrackUI(data) {
            try {
                this.updateCurrentTrack(data.now_playing);
                
                if (data.playing_next) {
                    this.updateNextTrack(data.playing_next);
                }
                
                if (data.song_history && Array.isArray(data.song_history)) {
                    this.updateHistory(data.song_history);
                }
                
                if (data.listeners && data.listeners.current) {
                    this.updateListenersCount(data.listeners.current);
                }
            } catch (e) {
                console.error("Ошибка обработки данных:", e);
            }
        }
        
        updateHistory(history) {
            if (!this.elements.historyList || !history) return;
            
            this.elements.historyList.innerHTML = '';
            
            const recentTracks = history.slice(0, 5);
            
            recentTracks.forEach((item, index) => {
                const li = document.createElement('li');
                if (index === 0) li.classList.add('new-track');
                
                const song = item.song || {};
                const title = song.title || 'Неизвестный трек';
                const artist = song.artist || 'Неизвестный исполнитель';
                const duration = item.duration ? this.formatTime(item.duration) : '';
                
                li.innerHTML = `
                <span class="track-title">${title}</span>
                <span class="track-artist">${artist}</span>
                ${duration ? `<span class="track-time">${duration}</span>` : ''}
                `;
                
                this.elements.historyList.appendChild(li);
            });
        }
        
        updateListenersCount(count) {
            if (this.elements.listenersCount) {
                this.elements.listenersCount.textContent = `${count} ${this.pluralize(count, ['слушатель', 'слушателя', 'слушателей'])}`;
            }
        }
        
        setStatus(text, isError = false) {
            if (this.elements.statusEl) {
                this.elements.statusEl.textContent = text;
                this.elements.statusEl.className = isError ? 'status-error' : 'status-success';
            }
        }
        
        async findWorkingApi() {
            for (const apiUrl of this.config.apiEndpoints) {
                try {
                    const response = await this.fetchWithTimeout(apiUrl, 3000);
                    if (response.ok) return apiUrl;
                } catch (error) {
                    console.warn(`API недоступен: ${apiUrl}`, error);
                }
            }
            return null;
        }
        
        fetchWithTimeout(url, timeout, options = {}) {
            return Promise.race([
                fetch(url, options),
                                new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Таймаут подключения')), timeout)
                                )
            ]);
        }
        
        formatTime(seconds) {
            if (isNaN(seconds)) return "0:00";
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }
        
        pluralize(number, words) {
            return words[
                (number % 100 > 4 && number % 100 < 20) ? 2
                : [2, 0, 1, 1, 1, 2][(number % 10 < 5) ? Math.abs(number) % 10 : 5]
            ];
        }
        
        updateVolumeIcon() {
            if (!this.elements.volumeBtn) return;
            
            if (this.elements.audio.muted || this.elements.audio.volume === 0) {
                this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            } else if (this.elements.audio.volume < 0.5) {
                this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
            } else {
                this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            }
        }
        
        handleConnectionError(error) {
            console.error("Ошибка подключения:", error);
            this.setStatus(`Ошибка: ${error.message}`, true);
            
            // Автоматический реконнект с экспоненциальной задержкой
            const delay = Math.min(3000 * Math.pow(2, this.state.retryCount), 30000);
            setTimeout(() => {
                this.connectToStream();
                this.state.retryCount++;
            }, delay);
            
            // Показать оверлей при ошибке
            document.getElementById('audio-overlay').style.display = 'flex';
        }
        
        handleNetworkIssue() {
            if (this.state.networkQuality === 'good') {
                this.state.networkQuality = 'degraded';
                this.state.diagnostics.qualityChanges++;
                this.adjustForNetworkQuality();
            }
        }
        
        adjustForNetworkQuality() {
            switch (this.state.networkQuality) {
                case 'degraded':
                    clearInterval(this.state.updateIntervalId);
                    this.state.updateIntervalId = setInterval(
                        () => this.updateTrackInfo(),
                                                              this.config.updateInterval * 2
                    );
                    break;
                case 'good':
                default:
                    clearInterval(this.state.updateIntervalId);
                    this.state.updateIntervalId = setInterval(
                        () => this.updateTrackInfo(),
                                                              this.config.updateInterval
                    );
            }
        }
        
        handleBackgroundTab() {
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
                // Не пытаемся сразу запустить, ждем взаимодействия
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
    }
    
    // Запуск
    new RadioPlayer();
});с
