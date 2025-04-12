import { UIHelpers } from './ui-helpers.js';

export class AudioController {
    constructor(audioElement, {
        volumeBtn,
        volumeSlider,
        currentTimeEl,
        progressBar,
        statusEl
    }) {
        this.audio = audioElement;
        this.elements = {
            volumeBtn,
            volumeSlider,
            currentTimeEl,
            progressBar,
            statusEl
        };
        this.abortController = new AbortController();
        
        // Инициализация громкости
        this.audio.volume = 0.7;
        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.value = this.audio.volume;
        }
        
        // Настройка обработчиков событий
        this.setupAudioEventListeners();
    }

    // Основные методы управления аудио
    async play() {
        try {
            await this.audio.play();
            return true;
        } catch (error) {
            console.error('Playback failed:', error);
            this.setStatus(`Ошибка воспроизведения: ${error.message}`, true);
            throw error;
        }
    }

    pause() {
        this.audio.pause();
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }

    // Управление громкостью
    toggleMute() {
        this.audio.muted = !this.audio.muted;
        this.updateVolumeIcon();
    }

    setVolume(volume) {
        this.audio.volume = volume;
        this.audio.muted = false;
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        if (!this.elements.volumeBtn) return;

        if (this.audio.muted || this.audio.volume === 0) {
            this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (this.audio.volume < 0.5) {
            this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }

    // Управление источником аудио
    async setSource(url, timeout = 10000) {
        try {
            this.abortController.abort();
            this.abortController = new AbortController();

            await this.loadAudioWithTimeout(url, timeout);
            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Failed to set audio source:', error);
                throw error;
            }
            return false;
        }
    }

    async loadAudioWithTimeout(url, timeout) {
        return new Promise((resolve, reject) => {
            // Очистка предыдущего источника
            this.audio.src = '';
            this.audio.src = url;
            
            const timer = setTimeout(() => {
                reject(new Error(`Таймаут загрузки аудио (${timeout}ms)`));
            }, timeout);

            const cleanup = () => {
                clearTimeout(timer);
                this.audio.removeEventListener('canplay', onCanPlay);
                this.audio.removeEventListener('error', onError);
            };

            const onCanPlay = () => {
                cleanup();
                resolve();
            };

            const onError = (e) => {
                cleanup();
                reject(new Error(`Ошибка аудио: ${e.target.error?.message || 'Неизвестная ошибка'}`));
            };

            this.audio.addEventListener('canplay', onCanPlay, { once: true });
            this.audio.addEventListener('error', onError, { once: true });
            
            this.audio.load();
        });
    }

    // Прогресс воспроизведения
    setupProgressUpdates() {
        if (!this.elements.currentTimeEl || !this.elements.progressBar) return;

        const updateProgress = () => {
            this.elements.currentTimeEl.textContent = UIHelpers.formatTime(this.audio.currentTime);
            this.elements.progressBar.value = (this.audio.currentTime / this.audio.duration) * 100 || 0;
        };

        this.audio.addEventListener('timeupdate', updateProgress);
        return () => this.audio.removeEventListener('timeupdate', updateProgress);
    }

    // Статус и обработка ошибок
    setStatus(text, isError = false) {
        if (this.elements.statusEl) {
            this.elements.statusEl.textContent = text;
            this.elements.statusEl.className = isError ? 'status-error' : 'status-success';
        }
    }

    setupAudioEventListeners() {
        this.audio.addEventListener('error', () => {
            throw new Error("Audio element error");
        });

        this.audio.addEventListener('stalled', () => {
            throw new Error("Audio stalled");
        });

        this.audio.addEventListener('waiting', () => {
            throw new Error("Audio buffering");
        });
    }

    // Очистка
destroy() {
    if (this.state.diagnosticsIntervalId) {
        clearInterval(this.state.diagnosticsIntervalId);
    }
    if (this.state.updateIntervalId) {
        clearInterval(this.state.updateIntervalId);
    }
    this.audioController.destroy();
}
