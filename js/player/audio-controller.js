import { UIHelpers } from './ui-helpers.js';

export class AudioController {
    constructor(audioElement, { volumeBtn, volumeSlider, currentTimeEl, progressBar }) {
        this.audio = audioElement;
        this.elements = { volumeBtn, volumeSlider, currentTimeEl, progressBar };
        this.abortController = new AbortController();
        
        // Инициализация громкости
        this.audio.volume = 0.7;
        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.value = this.audio.volume;
        }
    }

    // Основные методы управления аудио
    async play() {
        try {
            await this.audio.play();
            return true;
        } catch (error) {
            console.error('Playback failed:', error);
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
    async setSource(url) {
        try {
            this.abortController.abort();
            this.abortController = new AbortController();

            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Audio load timeout')), 10000);

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
                    reject(new Error(`Audio error: ${e.target.error?.message || 'Unknown'}`));
                };

                this.audio.addEventListener('canplay', onCanPlay, { once: true });
                this.audio.addEventListener('error', onError, { once: true });

                this.audio.src = url;
                this.audio.load();
            });

            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Failed to set audio source:', error);
                throw error;
            }
            return false;
        }
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

    // Очистка
    destroy() {
        this.abortController.abort();
        this.audio.src = '';
        this.audio.removeAttribute('src');
    }
}
