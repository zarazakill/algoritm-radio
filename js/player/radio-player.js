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

    /* Добавляем все недостающие методы */

    setStatus(text, isError = false) {
        if (this.elements.statusEl) {
            this.elements.statusEl.textContent = text;
            this.elements.statusEl.className = isError ? 'status-error' : 'status-success';
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

    handleNetworkIssue() {
        if (this.state.networkQuality === 'good') {
            this.state.networkQuality = 'degraded';
            this.state.diagnostics.qualityChanges++;
            this.adjustForNetworkQuality();
        }
    }

    adjustForNetworkQuality() {
        clearInterval(this.state.updateIntervalId);
        const interval = this.state.networkQuality === 'degraded' 
            ? this.config.updateInterval * 2 
            : this.config.updateInterval;
        this.state.updateIntervalId = setInterval(
            () => this.updateTrackInfo(),
            interval
        );
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

    startUpdateInterval() {
        this.state.updateIntervalId = setInterval(
            () => this.updateTrackInfo(),
            this.config.updateInterval
        );
    }

    async findWorkingApi() {
        for (const apiUrl of this.config.apiEndpoints) {
            try {
                const response = await NetworkUtils.fetchWithTimeout(apiUrl, 3000);
                if (response.ok) return apiUrl;
            } catch (error) {
                console.warn(`API недоступен: ${apiUrl}`, error);
            }
        }
        return null;
    }

    handleConnectionError(error) {
        console.error("Ошибка подключения:", error);
        this.setStatus(`Ошибка: ${error.message}`, true);

        const delay = Math.min(3000 * Math.pow(2, this.state.retryCount), 30000);
        setTimeout(() => {
            this.connectToStream();
            this.state.retryCount++;
        }, delay);

        const overlay = document.getElementById('audio-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    async init() {
        try {
            this.setupThemeToggle();
            this.setupEventListeners(); // Этот метод теперь существует
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
            this.cleanup(); // Этот метод теперь существует
        }
    }

     setupEventListeners() {
        // Обработчик ошибок аудио
        this.elements.audio.addEventListener('error', () => {
            this.handleConnectionError(new Error("Ошибка аудио элемента"));
        });

        // Кнопка громкости
        this.elements.volumeBtn.addEventListener('click', () => {
            this.elements.audio.muted = !this.elements.audio.muted;
            this.updateVolumeIcon();
        });

        // Слайдер громкости
        this.elements.volumeSlider.addEventListener('input', (e) => {
            this.elements.audio.volume = e.target.value;
            this.updateVolumeIcon();
        });

        // Обработчики состояния сети
        this.elements.audio.addEventListener('stalled', () => {
            this.handleNetworkIssue();
        });

        this.elements.audio.addEventListener('waiting', () => {
            this.state.diagnostics.bufferingEvents++;
            this.handleNetworkIssue();
        });

        // Обновление времени воспроизведения
        this.elements.audio.addEventListener('timeupdate', () => {
            if (this.elements.currentTime && this.elements.progressBar) {
                this.elements.currentTime.textContent = this.formatTime(this.elements.audio.currentTime);
                this.elements.progressBar.value = (this.elements.audio.currentTime / this.elements.audio.duration) * 100 || 0;
            }
        });

        // Поведение при сворачивании вкладки
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleBackgroundTab();
            } else {
                this.handleForegroundTab();
            }
        });
    }

    cleanup() {
        // Очистка интервалов
        if (this.state.updateIntervalId) {
            clearInterval(this.state.updateIntervalId);
        }
        
        // Остановка аудио
        if (this.elements.audio) {
            this.elements.audio.pause();
            this.elements.audio.src = '';
        }
        
        // Закрытие AudioContext
        if (this.state.audioContext) {
            this.state.audioContext.close();
        }
    }

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

    setupThemeToggle() {
        const body = document.body;
        const themeToggleBtn = document.createElement('button');
        themeToggleBtn.classList.add('theme-toggle');
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';

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
