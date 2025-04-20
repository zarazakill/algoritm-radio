import { RadioPlayer } from './player/player.js';

// Обработчик переключения темы
const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const body = document.body;
        const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.classList.remove(currentTheme + '-theme');
        body.classList.add(newTheme + '-theme');
        localStorage.setItem('theme', newTheme);
        
        // Обновляем иконку только у существующего переключателя
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const playButton = document.getElementById('start-playback');
    const buttonText = playButton?.querySelector('.button-text');
    const spinner = playButton?.querySelector('.loading-spinner');
    const overlay = document.getElementById('audio-overlay');
    const menuToggle = document.querySelector('.menu-toggle');
    const menuOverlay = document.getElementById('menuOverlay');
    const menuClose = document.querySelector('.menu-close');

    // Изначально отключаем бургер-меню
    if (menuToggle) {
        menuToggle.classList.add('disabled');
    }

    try {
        console.log('Initializing player...');
        const player = new RadioPlayer();
        
        if (playButton && buttonText && spinner) {
            playButton.disabled = true;
            spinner.style.display = 'inline-block';
            buttonText.textContent = 'Загрузка плеера...';
        }
        
        await player.init();
        
        if (playButton && buttonText && spinner) {
            playButton.disabled = false;
            spinner.style.display = 'none';
            buttonText.textContent = 'Запустить радио';
        }
        
        // Обработчик клика
        if (playButton && overlay && buttonText && spinner) {
            playButton.addEventListener('click', async () => {
                try {
                    overlay.style.display = 'none';
                    
                    playButton.disabled = true;
                    spinner.style.display = 'inline-block';
                    buttonText.textContent = 'Подготовка потока...';
                    
                    if (player.elements.audio.readyState < 2) {
                        await new Promise(resolve => {
                            player.elements.audio.addEventListener('canplay', resolve, { once: true });
                        });
                    }
                    
                    await player.elements.audio.play();
                    
                    if (player.state.audioContext?.state === 'suspended') {
                        await player.state.audioContext.resume();
                    }
                    
                    player.state.isPlaying = true;
                    
                    // Активируем бургер-меню после успешного запуска
                    if (menuToggle) {
                        menuToggle.classList.remove('disabled');
                    }
                    
                } catch (error) {
                    console.error("Playback error:", error);
                    player.setStatus(`Ошибка: ${error.message}`, true);
                    overlay.style.display = 'flex';
                    
                    if (playButton && buttonText && spinner) {
                        playButton.disabled = false;
                        spinner.style.display = 'none';
                        buttonText.textContent = 'Попробовать снова';
                    }
                }
            });
        }
        
    } catch (error) {
        console.error("Initialization failed:", error);
        
        if (playButton && buttonText && spinner) {
            playButton.disabled = false;
            spinner.style.display = 'none';
            buttonText.textContent = 'Ошибка загрузки. Попробовать снова';
        }
        
        const statusEl = document.getElementById('stream-status');
        if (statusEl) {
            statusEl.style.opacity = '1';
        }
    }

    // Обработчики меню (остаются прежними, но будут работать только после активации)
    if (menuToggle && menuOverlay) {
        menuToggle.addEventListener('click', () => {
            if (!menuToggle.classList.contains('disabled')) {
                menuToggle.classList.toggle('active');
                menuOverlay.classList.toggle('active');
            }
        });
    }
});
