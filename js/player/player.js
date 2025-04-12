import RadioPlayerConfig from './config.js';
import { NetworkUtils } from './network-utils.js';
import { UIHelpers } from './ui-helpers.js';
import { AudioController } from './audio-controller.js';

export class RadioPlayer {
    constructor() {
        const requiredElements = ['stream-status', 'volume-slider', 'volume-btn'];
        for (const id of requiredElements) {
            if (!document.getElementById(id)) {
                throw new Error(`Не найден элемент #${id}`);
            }
        }

        this.audioController = new AudioController(
            document.getElementById('radio-stream'),
            {
                volumeBtn: document.getElementById('volume-btn'),
                volumeSlider: document.getElementById('volume-slider'),
                currentTimeEl: document.getElementById('current-time'),
                progressBar: document.getElementById('progress-bar'),
                statusEl: document.getElementById('stream-status')
            }
        );

        this.elements = {
            currentTrackEl: document.getElementById('current-track'),
            nextTrackEl: document.getElementById('next-track'),
            historyList: document.getElementById('history-list'),
            listenersCount: document.getElementById('listeners-count'),
            trackTitle: document.getElementById('track-title'),
            trackArtist: document.getElementById('track-artist'),
            duration: document.getElementById('duration')
        };

        this.config = RadioPlayerConfig;
        this.state = {
            diagnosticsIntervalId: null,
            updateIntervalId: null,
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
    }

    async init() {
        try {
            this.setupThemeToggle();
            this.setupEventListeners();
            this.initAudioContext();
            
            let attempts = 3;
            while (attempts > 0) {
                if (await this.connectToStream()) break;
                attempts--;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            this.state.currentApiUrl = await this.findWorkingApi();
            this.startDiagnostics();
            this.state.updateIntervalId = setInterval(() => this.updateTrackInfo(), this.config.updateInterval);
            this.preloadNextTracks();
            
        } catch (error) {
            console.error("Ошибка инициализации плеера:", error);
            this.audioController.setStatus("Критическая ошибка: " + error.message, true);
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
        const handleFirstInteraction = () => {
            if (this.state.audioContext && this.state.audioContext.state === 'suspended') {
                this.state.audioContext.resume();
            }
            document.removeEventListener('click', handleFirstInteraction);
        };

        document.addEventListener('click', handleFirstInteraction);

        // Обработчики громкости теперь управляются AudioController
        this.audioController.setupProgressUpdates();

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

    if (this.audioController.isMuted() || this.audioController.getVolume() === 0) {
        this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    } else if (this.audioController.getVolume() < 0.5) {
        this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
    } else {
        this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
}

async connectToStream(maxRetries = 3) {
    try {
        this.audioController.setStatus("Подключение...");
        
        // Параллельная загрузка потока и информации о треках
        const [stream, apiUrl] = await Promise.all([
            this.findWorkingStream().catch(() => null),
            this.findWorkingApi().catch(() => null)
        ]);

        if (!stream) throw new Error("Все потоки недоступны");
        
        this.state.currentStream = stream;
        this.state.currentApiUrl = apiUrl;

        // Параллельная загрузка аудио и данных о текущем треке
        await Promise.all([
            this.audioController.setSource(stream.url, 10000),
            this.updateTrackInfo()
        ]);

        this.audioController.setStatus("Соединение установлено");
        return true;
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

            try {
                await this.audioController.setSource(this.state.currentStream.url, 10000);
                this.audioController.setStatus("Соединение установлено");
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
            this.audioController.setStatus(`Ошибка: ${error.message}`, true);
            
            if (error.name !== 'AbortError') {
                this.handleConnectionError(error);
            }
            
            return false;
        }
    }

async preloadNextTracks() {
    if (!this.state.currentApiUrl) return;
    
    try {
        const response = await fetch(`${this.state.currentApiUrl}/next`);
        const data = await response.json();
        // Можно предзагрузить аудио или сохранить данные
    } catch (e) {
        console.log("Не удалось предзагрузить треки", e);
    }
}

    async findWorkingStream() {
        const sortedStreams = [...this.config.streams].sort((a, b) => a.priority - b.priority);
        const streamUrls = sortedStreams.map(s => s.url);
        
        const workingUrl = await NetworkUtils.findWorkingUrl(streamUrls);
        return sortedStreams.find(s => s.url === workingUrl);
    }

    setupAudioBuffer() {
        if (!this.state.audioContext) return;

        const source = this.state.audioContext.createMediaElementSource(this.audioController.audio);
        const analyser = this.state.audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(this.state.audioContext.destination);
    }

    async togglePlayback() {
        await this.connectToStream();
        this.audioController.play().catch(console.error);
    }
   
async updateTrackInfo() {
    if (!this.state.currentApiUrl) return;
    
    try {
        // Кэшируем запросы
        const cacheBuster = Date.now();
        const response = await NetworkUtils.fetchWithTimeout(
            `${this.state.currentApiUrl}?cache=${cacheBuster}`, 
            2000
        );
        const data = await response.json();
        this.updateUI(data);
    } catch (error) {
        console.error("Ошибка обновления:", error);
    }
}

        updateUI(data) {
            // Отложенный рендеринг для тяжелых элементов
            requestAnimationFrame(() => {
                this.updateCurrentTrack(data.now_playing);
        
                setTimeout(() => {
                    if (data.playing_next) this.updateNextTrack(data.playing_next);
                    if (data.song_history) this.updateHistory(data.song_history);
                }, 0);
            });

            // Приоритетные данные загружаем сразу
            if (data.listeners?.current) {
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

        this.elements.historyList.innerHTML = '';
        const recentTracks = history.slice(0, 5);

        recentTracks.forEach((item, index) => {
            const li = UIHelpers.createHistoryItem(item, index);
            this.elements.historyList.appendChild(li);
        });
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
  
    initAudioContext() {
        try {
            this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.error("Ошибка инициализации AudioContext:", error);
        }
    }

    startDiagnostics() {
        if (!this.config.diagnostics.enabled) return;

        this.state.diagnosticsIntervalId = setInterval(() => {
            console.log('Диагностика плеера:', {
                networkQuality: this.state.networkQuality,
                bufferingEvents: this.state.diagnostics.bufferingEvents,
                connectionErrors: this.state.diagnostics.connectionErrors,
                qualityChanges: this.state.diagnostics.qualityChanges,
                lastError: this.state.diagnostics.lastError,
                currentStream: this.state.currentStream?.url,
                isPlaying: this.state.isPlaying,
                volume: this.audioController.getVolume(),
                muted: this.audioController.isMuted()
            });
        }, this.config.diagnostics.logInterval);
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
            this.audioController.play().catch(console.error);
        }
    }

    destroy() {
        if (this.state.diagnosticsIntervalId) {
            clearInterval(this.state.diagnosticsIntervalId);
        }
        if (this.state.updateIntervalId) {
            clearInterval(this.state.updateIntervalId);
        }
        this.audioController.destroy();
    }
}

RadioPlayer.DEFAULT_THEME = 'dark';
