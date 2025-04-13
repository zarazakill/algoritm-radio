import { RadioPlayer } from './player/player.js';

// Константы для состояний UI
const UI_STATES = Object.freeze({
    LOADING: {
        text: 'Загрузка плеера...',
        disabled: true,
        showSpinner: true,
        className: 'is-loading'
    },
    READY: {
        text: 'Запустить радио',
        disabled: false,
        showSpinner: false,
        className: 'is-ready'
    },
    PREPARING: {
        text: 'Подготовка потока...',
        disabled: true,
        showSpinner: true,
        className: 'is-preparing'
    },
    ERROR: {
        text: 'Ошибка загрузки. Попробовать снова',
        disabled: false,
        showSpinner: false,
        className: 'is-error'
    },
    RETRY: {
        text: 'Попробовать снова',
        disabled: false,
        showSpinner: false,
        className: 'is-retry'
    },
    PLAYING: {
        text: 'Сейчас играет',
        disabled: true,
        showSpinner: false,
        className: 'is-playing'
    }
});

// Конфигурация таймаутов
const TIMEOUTS = {
    AUDIO_READY: 5000,
    INITIALIZATION: 10000
};

/**
 * Класс для управления состоянием плеера
 */
class PlayerUI {
    constructor() {
        this.playButton = document.getElementById('start-playback');
        this.buttonText = this.playButton.querySelector('.button-text');
        this.spinner = this.playButton.querySelector('.loading-spinner');
        this.overlay = document.getElementById('audio-overlay');
        this.statusEl = document.getElementById('stream-status');
        this.player = null;
        this.initPromise = null;
        
        this._bindEvents();
    }
    
    /**
     * Инициализация плеера
     */
    async init() {
        try {
            this._updateUIState(UI_STATES.LOADING);
            
            // Таймаут для инициализации
            this.initPromise = Promise.race([
                this._initializePlayer(),
                this._createTimeout(TIMEOUTS.INITIALIZATION, 'Таймаут инициализации')
            ]);
            
            await this.initPromise;
            this._updateUIState(UI_STATES.READY);
            
        } catch (error) {
            this._handleError(error, 'INIT_ERROR');
            this._updateUIState(UI_STATES.ERROR);
        }
    }
    
    /**
     * Основная логика инициализации плеера
     */
    async _initializePlayer() {
        this.player = new RadioPlayer();
        await this.player.init();
        
        this.playButton.addEventListener('click', () => this._handlePlayButtonClick());
    }
    
    /**
     * Обработчик клика по кнопке воспроизведения
     */
    async _handlePlayButtonClick() {
        try {
            this.overlay.style.display = 'none';
            this._updateUIState(UI_STATES.PREPARING);
            
            await this._waitForAudioReady();
            await this.player.elements.audio.play();
            
            if (this.player.state.audioContext?.state === 'suspended') {
                await this.player.state.audioContext.resume();
            }
            
            this.player.state.isPlaying = true;
            this._updateUIState(UI_STATES.PLAYING);
            
        } catch (error) {
            this._handleError(error, 'PLAYBACK_ERROR');
            this._updateUIState(UI_STATES.RETRY);
        }
    }
    
    /**
     * Ожидание готовности аудио с таймаутом
     */
    async _waitForAudioReady() {
        if (this.player.elements.audio.readyState < 2) {
            await Promise.race([
                new Promise(resolve => {
                    this.player.elements.audio.addEventListener(
                        'canplay', 
                        resolve, 
                        { once: true }
                    );
                }),
                this._createTimeout(TIMEOUTS.AUDIO_READY, 'Таймаут подготовки аудио')
            ]);
        }
    }
    
    /**
     * Создание таймаута с ошибкой
     */
    _createTimeout(ms, message) {
        return new Promise((_, reject) => 
            setTimeout(() => reject(new Error(message)), ms)
        );
    }
    
    /**
     * Обновление состояния UI
     */
    _updateUIState(state) {
        this.playButton.disabled = state.disabled;
        this.spinner.style.display = state.showSpinner ? 'inline-block' : 'none';
        this.buttonText.textContent = state.text;
        
        // Удаляем все классы состояний
        Object.values(UI_STATES).forEach(s => {
            this.playButton.classList.remove(s.className);
        });
        
        // Добавляем текущий класс состояния
        this.playButton.classList.add(state.className);
    }
    
    /**
     * Обработка ошибок
     */
    _handleError(error, errorType) {
        console.error(`${errorType}:`, error);
        this.player?.setStatus(`Ошибка: ${error.message}`, true);
        this.overlay.style.display = 'flex';
        
        if (this.statusEl) {
            this.statusEl.style.opacity = '1';
        }
        
        if (window.trackError) {
            window.trackError(errorType, error);
        }
    }
    
    /**
     * Привязка событий
     */
    _bindEvents() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            if (window.trackError) {
                window.trackError('UNHANDLED_ERROR', event.error);
            }
        });
    }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    const playerUI = new PlayerUI();
    playerUI.init().catch(error => {
        console.error('Unhandled initialization error:', error);
    });
});
