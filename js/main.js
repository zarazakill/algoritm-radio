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
        
        // Обновляем иконку
        const icon = document.querySelector('.theme-toggle i');
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

    // Обработчики меню
    if (menuToggle && menuOverlay) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            menuOverlay.classList.toggle('active');
        });
    }

    if (menuClose && menuToggle && menuOverlay) {
        menuClose.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            menuOverlay.classList.remove('active');
        });
    }

    // Закрытие меню при клике на пункт
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            if (menuToggle && menuOverlay) {
                menuToggle.classList.remove('active');
                menuOverlay.classList.remove('active');
            }
        });
    });
    
    try {
        console.log('Initializing player...');
        const player = new RadioPlayer();
        
        if (playButton && buttonText && spinner) {
            // Показываем состояние загрузки
            playButton.disabled = true;
            spinner.style.display = 'inline-block';
            buttonText.textContent = 'Загрузка плеера...';
        }
        
        await player.init();
        
        if (playButton && buttonText && spinner) {
            // Активируем кнопку
            playButton.disabled = false;
            spinner.style.display = 'none';
            buttonText.textContent = 'Запустить радио';
        }
        
        // Обработчик клика
        if (playButton && overlay && buttonText && spinner) {
            playButton.addEventListener('click', async () => {
                try {
                    overlay.style.display = 'none';
                    
                    // Показываем состояние загрузки при начале воспроизведения
                    playButton.disabled = true;
                    spinner.style.display = 'inline-block';
                    buttonText.textContent = 'Подготовка потока...';
                    
                    // Проверяем готовность аудио
                    if (player.elements.audio.readyState < 2) {
                        await new Promise(resolve => {
                            player.elements.audio.addEventListener('canplay', resolve, { once: true });
                        });
                    }
                    
                    await player.elements.audio.play();
                    
                    if (player.state.audioContext?.state === 'suspended') {
                        await player.state.audioContext.resume();
                    }
                    
                    // Обновляем состояние плеера
                    player.state.isPlaying = true;
                    
                } catch (error) {
                    console.error("Playback error:", error);
                    player.setStatus(`Ошибка: ${error.message}`, true);
                    overlay.style.display = 'flex';
                    
                    // Возвращаем кнопку в исходное состояние
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
        
        // Обновляем состояние кнопки при ошибке
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
});
