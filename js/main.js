import { RadioPlayer } from './player/player.js';

// Константы для состояний UI
const UI_STATES = {
    LOADING: {
        text: 'Загрузка плеера...',
        disabled: true,
        showSpinner: true
    },
    READY: {
        text: 'Запустить радио',
        disabled: false,
        showSpinner: false
    },
    PREPARING: {
        text: 'Подготовка потока...',
        disabled: true,
        showSpinner: true
    },
    ERROR: {
        text: 'Ошибка загрузки. Попробовать снова',
        disabled: false,
        showSpinner: false
    },
    RETRY: {
        text: 'Попробовать снова',
        disabled: false,
        showSpinner: false
    }
};

/**
 * Обновляет состояние UI кнопки
 * @param {HTMLElement} button - Элемент кнопки
 * @param {HTMLElement} buttonText - Элемент текста кнопки
 * @param {HTMLElement} spinner - Элемент спиннера
 * @param {Object} state - Состояние UI из UI_STATES
 */
function updateButtonState(button, buttonText, spinner, state) {
    button.disabled = state.disabled;
    spinner.style.display = state.showSpinner ? 'inline-block' : 'none';
    buttonText.textContent = state.text;
}

/**
 * Инициализирует и управляет радио плеером
 */
async function initializePlayer() {
    const playButton = document.getElementById('start-playback');
    const buttonText = playButton.querySelector('.button-text');
    const spinner = playButton.querySelector('.loading-spinner');
    const overlay = document.getElementById('audio-overlay');
    const statusEl = document.getElementById('stream-status');

    try {
        console.log('Initializing player...');
        updateButtonState(playButton, buttonText, spinner, UI_STATES.LOADING);
        
        const player = new RadioPlayer();
        await player.init();
        
        updateButtonState(playButton, buttonText, spinner, UI_STATES.READY);
        
        // Обработчик клика с улучшенной обработкой состояний
        playButton.addEventListener('click', async () => {
            try {
                overlay.style.display = 'none';
                updateButtonState(playButton, buttonText, spinner, UI_STATES.PREPARING);
                
                // Ожидание готовности аудио с таймаутом
                const audioReady = Promise.race([
                    new Promise(resolve => {
                        player.elements.audio.addEventListener('canplay', resolve, { once: true });
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Таймаут подготовки аудио')), 5000)
                ]);
                
                if (player.elements.audio.readyState < 2) {
                    await audioReady;
                }
                
                await player.elements.audio.play();
                
                // Возобновление AudioContext если нужно
                if (player.state.audioContext?.state === 'suspended') {
                    await player.state.audioContext.resume();
                }
                
                player.state.isPlaying = true;
                updateButtonState(playButton, buttonText, spinner, UI_STATES.READY);
                
            } catch (error) {
                console.error("Playback error:", error);
                player.setStatus(`Ошибка: ${error.message}`, true);
                overlay.style.display = 'flex';
                updateButtonState(playButton, buttonText, spinner, UI_STATES.RETRY);
                
                // Отправка ошибки в аналитику, если есть
                if (window.trackError) {
                    window.trackError('PLAYBACK_ERROR', error);
                }
            }
        });
        
    } catch (error) {
        console.error("Initialization failed:", error);
        updateButtonState(playButton, buttonText, spinner, UI_STATES.ERROR);
        
        if (statusEl) {
            statusEl.style.opacity = '1';
        }
        
        // Отправка ошибки инициализации в аналитику
        if (window.trackError) {
            window.trackError('INIT_ERROR', error);
        }
    }
}

// Запуск инициализации после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем обработчик для перехвата глобальных ошибок
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        if (window.trackError) {
            window.trackError('UNHANDLED_ERROR', event.error);
        }
    });
    
    initializePlayer().catch(error => {
        console.error('Unhandled initialization error:', error);
    });
});
