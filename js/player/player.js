import RadioPlayerConfig from './config.js';
import { NetworkUtils } from './network-utils.js';
import { UIHelpers } from './ui-helpers.js';

export class RadioPlayer {
    constructor() {
            const requiredElements = ['radio-stream', 'stream-status', 'volume-slider'];
    for (const id of requiredElements) {
        if (!document.getElementById(id)) {
            throw new Error(`Не найден элемент #${id}`);
        }
    }
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

            this.abortController = new AbortController();
        
            this.config = RadioPlayerConfig;
 
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
    }


async init() {
    try {
        // Добавляем проверку готовности DOM
        if (!document.getElementById('radio-stream')) {
            throw new Error("Не найдены необходимые DOM элементы");
        }

        this.setupThemeToggle();
        this.setupEventListeners();
        this.initAudioContext();
        
        // Пробуем подключиться несколько раз при необходимости
        let attempts = 3;
        while (attempts > 0) {
            if (await this.connectToStream()) break;
            attempts--;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        this.state.currentApiUrl = await this.findWorkingApi();
        this.startDiagnostics();
        this.state.updateIntervalId = setInterval(() => this.updateTrackInfo(), this.config.updateInterval);
        
    } catch (error) {
        console.error("Ошибка инициализации плеера:", error);
        this.setStatus("Критическая ошибка: " + error.message, true);
    }
    await this.updateTrackInfo();
        
        // Ускоренное первое обновление
        setTimeout(() => this.updateTrackInfo(), 2000);
        
    } catch (error) {
        console.error("Ошибка инициализации плеера:", error);
        this.setStatus("Критическая ошибка: " + error.message, true);
    }
}

    setupThemeToggle() {
        const body = document.body;
        const themeToggleBtn = document.createElement('button');
        themeToggleBtn.classList.add('theme-toggle');
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';

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
    // Сохраняем контекст this для обработчиков событий
    const self = this;

    const handleFirstInteraction = () => {
        if (self.state.audioContext && self.state.audioContext.state === 'suspended') {
            self.state.audioContext.resume();
        }
        document.removeEventListener('click', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);

    // Используем стрелочные функции для сохранения контекста
    this.elements.volumeBtn.addEventListener('click', () => {
        self.elements.audio.muted = !self.elements.audio.muted;
        self.updateVolumeIcon();
    });

    this.elements.volumeSlider.addEventListener('input', (e) => {
        self.elements.audio.volume = e.target.value;
        self.updateVolumeIcon();
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
                this.elements.currentTime.textContent = UIHelpers.formatTime(this.elements.audio.currentTime);
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

async connectToStream(maxRetries = 3) {
    try {
        // 1. Проверка элементов DOM
        if (!this.elements.audio || !this.elements.statusEl) {
            throw new Error("Не найдены необходимые DOM элементы");
        }

        this.setStatus("Подключение...");
        
        // 2. Поиск рабочего потока с улучшенной обработкой ошибок
        try {
            this.state.currentStream = await Promise.race([
                this.findWorkingStream(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Таймаут поиска потока")), 5000)
                            )
            ]);
        } catch (streamError) {
            if (maxRetries > 0) {
                console.warn(`Повторная попытка подключения (осталось ${maxRetries} попыток)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.connectToStream(maxRetries - 1);
            }
            throw streamError;
        }

        if (!this.state.currentStream) {
            throw new Error("Все потоки недоступны");
        }

        // 3. Управление прерываниями
        this.abortController?.abort();
        this.abortController = new AbortController();

        // 4. Загрузка аудио с улучшенной обработкой
        try {
            await this.loadAudioWithTimeout(this.state.currentStream.url, 10000);
            this.setStatus("Соединение установлено");
            return true;
        } catch (loadError) {
            console.error("Ошибка загрузки аудио:", loadError);
            if (maxRetries > 0) {
                return this.connectToStream(maxRetries - 1);
            }
            throw loadError;
        }

    } catch (error) {
        console.error("Ошибка подключения:", error);
        this.setStatus(`Ошибка: ${error.message}`, true);
        
        if (error.name !== 'AbortError') {
            this.handleConnectionError(error);
        }
        
        return false;
    }
}

async loadAudioWithTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
        // Очистка предыдущего источника
        this.elements.audio.src = '';
        this.elements.audio.src = url;
        
        const timer = setTimeout(() => {
            reject(new Error(`Таймаут загрузки аудио (${timeout}ms)`));
        }, timeout);

        const cleanup = () => {
            clearTimeout(timer);
            this.elements.audio.removeEventListener('canplay', onCanPlay);
            this.elements.audio.removeEventListener('error', onError);
        };

        const onCanPlay = () => {
            cleanup();
            resolve();
        };

        const onError = (e) => {
            cleanup();
            reject(new Error(`Ошибка аудио: ${e.target.error?.message || 'Неизвестная ошибка'}`));
        };

        this.elements.audio.addEventListener('canplay', onCanPlay, { once: true });
        this.elements.audio.addEventListener('error', onError, { once: true });
        
        this.elements.audio.load();
    });
}
    async findWorkingStream() {
        const sortedStreams = [...this.config.streams].sort((a, b) => a.priority - b.priority);
        const streamUrls = sortedStreams.map(s => s.url);
        
        const workingUrl = await NetworkUtils.findWorkingUrl(streamUrls);
        return sortedStreams.find(s => s.url === workingUrl);
    }

    setupAudioBuffer() {
        if (!this.state.audioContext) return;

        const source = this.state.audioContext.createMediaElementSource(this.elements.audio);
        const analyser = this.state.audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(this.state.audioContext.destination);
    }

    async togglePlayback() {
        await this.connectToStream();
        this.elements.audio.play().catch(console.error);
    }

    async loadAudioSource(url) {
        this.elements.audio.src = '';
        await new Promise(resolve => setTimeout(resolve, 50)); // Даем время на разгрузку
        this.elements.audio.src = url;
        this.elements.audio.load();
    }
    
async updateTrackInfo() {
    if (!this.state.currentApiUrl) {
        this.state.currentApiUrl = await this.findWorkingApi();
        if (!this.state.currentApiUrl) return;
    }

    // Проверяем, когда было последнее обновление
    const now = Date.now();
    if (now - this.state.lastUpdateTime < this.config.updateInterval / 2) {
        return; // Пропускаем если обновлялись недавно
    }

    try {
        const response = await NetworkUtils.fetchWithTimeout(
            this.state.currentApiUrl, 
            2000
        );
        const data = await response.json();
        
        // Кэшируем данные и время последнего обновления
        this.state.lastTrackData = data;
        this.state.lastUpdateTime = now;
        
        this.updateUI(data);
    } catch (error) {
        console.error("Ошибка обновления:", error);
        // Используем кэшированные данные, если есть
        if (this.state.lastTrackData) {
            this.updateUI(this.state.lastTrackData);
        }
        this.state.currentApiUrl = await this.findWorkingApi();
    }
}

        updateUI(data) {
            this.updateCurrentTrack(data.now_playing);

            if (data.playing_next) {
                this.updateNextTrack(data.playing_next);
            }

            if (data.song_history) {
                this.updateHistory(data.song_history);
            }

            if (data.listeners && data.listeners.current) {
                this.updateListenersCount(data.listeners.current);
            }
        }


    updateCurrentTrack(nowPlaying) {
        const track = nowPlaying.song;
        const html = `
        <span class="track-name">${track.title || 'Неизвестный трек'}</span>
        <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
        <span class="track-progress">${UIHelpers.formatTime(nowPlaying.elapsed)} / ${UIHelpers.formatTime(nowPlaying.duration)}</span>
        `;

        if (this.elements.currentTrackEl) this.elements.currentTrackEl.innerHTML = html;

        if (this.elements.trackTitle) {
            this.elements.trackTitle.textContent = track.title || 'Неизвестный трек';
        }
        if (this.elements.trackArtist) {
            this.elements.trackArtist.textContent = track.artist || 'Неизвестный исполнитель';
        }
        if (this.elements.duration) {
            this.elements.duration.textContent = UIHelpers.formatTime(nowPlaying.duration);
        }
    }

    updateNextTrack(playingNext) {
        const track = playingNext.song;
        const html = `
        <span class="track-name">${track.title || 'Неизвестный трек'}</span>
        <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
        `;

        if (this.elements.nextTrackEl) this.elements.nextTrackEl.innerHTML = html;
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

    const fragment = document.createDocumentFragment();
    const recentTracks = history.slice(0, 5); // Ограничиваем количество треков

    recentTracks.forEach((item, index) => {
        const li = UIHelpers.createHistoryItem(item, index);
        fragment.appendChild(li);
    });

    // Очищаем и обновляем список за одну операцию
    this.elements.historyList.innerHTML = '';
    this.elements.historyList.appendChild(fragment);
}

    updateListenersCount(count) {
        if (this.elements.listenersCount) {
            this.elements.listenersCount.textContent = 
                `${count} ${UIHelpers.pluralize(count, ['слушатель', 'слушателя', 'слушателей'])}`;
        }
    }

    setStatus(text, isError = false) {
        if (this.elements.statusEl) {
            this.elements.statusEl.textContent = text;
            this.elements.statusEl.className = isError ? 'status-error' : 'status-success';
        }
    }

    async findWorkingApi() {
        return NetworkUtils.findWorkingUrl(this.config.apiEndpoints);
    }

    handleConnectionError(error) {
        console.error("Ошибка подключения:", error);
        this.setStatus(`Ошибка: ${error.message}`, true);

        const delay = Math.min(3000 * Math.pow(2, this.state.retryCount), 30000);
        setTimeout(() => {
            this.connectToStream();
            this.state.retryCount++;
        }, delay);

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
