import { RadioConfig } from './config.js';
import { UIHelpers } from './ui-helpers.js';
import { NetworkUtils } from './network-utils.js';
import { AudioController } from './audio-controller.js';

export class RadioPlayer {
    constructor(config = RadioConfig) {
        this.config = config;
        this.elements = this.initElements();
        this.state = this.initState();

        if (!this.elements.audio) {
            console.error('Аудио элемент не найден!');
            return;
        }

        this.init();
    }

    /* Инициализация элементов DOM */
    initElements() {
        return {
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
    }

    /* Инициализация состояния плеера */
    initState() {
        return {
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
            this.state.audioContext = AudioController.initAudioContext();

            const [streamResult, apiResult] = await Promise.allSettled([
                this.connectToStream(),
                                                                       this.findWorkingApi()
            ]);

            if (streamResult.status === 'rejected') {
                this.handleConnectionError(streamResult.reason);
            }

            if (apiResult.status === 'fulfilled') {
                this.state.currentApiUrl = apiResult.value;
            }

            this.startDiagnostics();
            await this.updateTrackInfo();
            this.startUpdateInterval();
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.cleanup();
        }
    }

    /* Основные методы плеера */
    async connectToStream() {
        try {
            this.setStatus("Подключение...");
            this.state.currentStream = await NetworkUtils.findWorkingStream(this.config.streams);

            if (!this.state.currentStream) {
                throw new Error("Все потоки недоступны");
            }

            this.elements.audio.src = this.state.currentStream.url;
            this.elements.audio.load();
            this.setStatus("Готово к воспроизведению");
        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    async togglePlayback() {
        if (!this.elements.audio.paused) {
            this.elements.audio.pause();
            this.state.isPlaying = false;
            this.setStatus("Пауза");
            return;
        }

        try {
            await this.elements.audio.play();
            this.state.isPlaying = true;
            this.setStatus("Слушаем музыку...");
        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    /* Работа с API и обновление данных */
    async updateTrackInfo() {
        if (!this.state.currentApiUrl) return;

        try {
            const response = await NetworkUtils.fetchWithTimeout(
                this.state.currentApiUrl,
                this.config.apiTimeout
            );
            const data = await response.json();
            this.updateUI(data);
        } catch (error) {
            console.error("Ошибка обновления треков:", error);
        }
    }

    updateUI(data) {
        if (!data) {
            UIHelpers.showFallbackData(this.elements);
            return;
        }

        UIHelpers.updateCurrentTrack(data.now_playing, this.elements);
        UIHelpers.updateNextTrack(data.playing_next, this.elements);
        UIHelpers.updateHistory(data.song_history, this.elements);
        UIHelpers.updateListenersCount(data.listeners?.current, this.elements);
    }

    /* Обработчики событий */
    setupEventListeners() {
        this.elements.audio.addEventListener('error', () => {
            this.handleConnectionError(new Error("Ошибка аудио"));
        });

        this.elements.volumeBtn.addEventListener('click', () => {
            this.elements.audio.muted = !this.elements.audio.muted;
            UIHelpers.updateVolumeIcon(this.elements.volumeBtn, this.elements.audio);
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

    setStatus(text, isError = false) {
        if (this.elements.statusEl) {
            this.elements.statusEl.textContent = text;
            this.elements.statusEl.className = isError ? 'status-error' : 'status-success';
        }
    }

    cleanup() {
        clearInterval(this.state.updateIntervalId);
        this.elements.audio.src = '';
    }

    startUpdateInterval() {
        this.state.updateIntervalId = setInterval(
            () => this.updateTrackInfo(),
                                                  this.config.updateInterval
        );
  }
    
    setupThemeToggle() {
        const body = document.body;
        const themeToggleBtn = document.createElement('button');
        themeToggleBtn.classList.add('theme-toggle');
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';

        // Установка начальной темы
        const savedTheme = localStorage.getItem('theme') || 'dark';
        body.classList.add(`${savedTheme}-theme`);
        this.updateThemeIcon(themeToggleBtn, savedTheme);

        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            body.classList.replace(`${currentTheme}-theme`, `${newTheme}-theme`);
            localStorage.setItem('theme', newTheme);
            this.updateThemeIcon(themeToggleBtn, newTheme);
        });

        document.querySelector('.container').appendChild(themeToggleBtn);
    }

    updateThemeIcon(button, theme) {
        button.innerHTML = theme === 'dark' 
            ? '<i class="fas fa-moon"></i>' 
            : '<i class="fas fa-sun"></i>';
    }
}
