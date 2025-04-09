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
        // 1. Проверка элементов DOM
        if (!this.elements.audio || !this.elements.statusEl) {
            throw new Error("Не найдены необходимые DOM элементы");
        }

        this.setStatus("Подключение...");
        
        // 2. Поиск рабочего потока с таймаутом
        this.state.currentStream = await Promise.race([
            this.findWorkingStream(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Таймаут поиска потока")), 5000)
        ]);

        if (!this.state.currentStream) {
            throw new Error("Все потоки недоступны");
        }

        // 3. Сброс и установка нового источника
        this.elements.audio.src = '';
        this.elements.audio.src = this.state.currentStream.url;
        
        // 4. Ожидание готовности аудио
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error("Таймаут загрузки аудио"));
            }, 10000);

            this.elements.audio.oncanplay = () => {
                clearTimeout(timer);
                resolve();
            };
            
            this.elements.audio.onerror = (e) => {
                clearTimeout(timer);
                reject(new Error(`Аудио ошибка: ${e.target.error.message}`));
            };
            
            this.elements.audio.load();
        });

        this.setStatus("Соединение установлено");
        return true;
        
    } catch (error) {
        console.error("Ошибка подключения:", error);
        this.setStatus(`Ошибка: ${error.message}`, true);
        this.handleConnectionError(error);
        return false;
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

        const source = this.state.audioContext.createMediaElementSource(this.elements.audio);
        const analyser = this.state.audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(this.state.audioContext.destination);
    }

    async togglePlayback() {
        await this.connectToStream();
        this.elements.audio.play().catch(console.error);
    }

    async updateTrackInfo() {
        if (!this.state.currentApiUrl) {
            this.state.currentApiUrl = await this.findWorkingApi();
            if (!this.state.currentApiUrl) return;
        }

        try {
            const response = await NetworkUtils.fetchWithTimeout(
                this.state.currentApiUrl, 
                2000
            );
            const data = await response.json();
            this.updateUI(data);
            // ... остальной код ...
        } catch (error) {
            console.error("Ошибка обновления:", error);
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
