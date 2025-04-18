import { RadioPlayer } from './player/player.js';

document.querySelector('.theme-toggle').addEventListener('click', () => {
    const body = document.body;
    const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

document.querySelector('.menu-close').addEventListener('click', () => {
    menuToggle.classList.remove('active');
    menuOverlay.classList.remove('active');
});
    
    body.classList.remove(currentTheme + '-theme');
    body.classList.add(newTheme + '-theme');
    localStorage.setItem('theme', newTheme);
    
    // Обновляем иконку
    const icon = document.querySelector('.theme-toggle i');
    icon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
});

document.addEventListener('DOMContentLoaded', async () => {
    const playButton = document.getElementById('start-playback');
    const buttonText = playButton.querySelector('.button-text');
    const spinner = playButton.querySelector('.loading-spinner');
    const overlay = document.getElementById('audio-overlay');
    const menuToggle = document.querySelector('.menu-toggle');
    const menuOverlay = document.getElementById('menuOverlay');

menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    menuOverlay.classList.toggle('active');
});

// Закрытие меню при клике на пункт
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        menuOverlay.classList.remove('active');
    });
});
    
    try {
        console.log('Initializing player...');
        const player = new RadioPlayer();
        
        // Показываем состояние загрузки
        playButton.disabled = true;
        spinner.style.display = 'inline-block';
        buttonText.textContent = 'Загрузка плеера...';
        
        await player.init();
        
        // Активируем кнопку
        playButton.disabled = false;
        spinner.style.display = 'none';
        buttonText.textContent = 'Запустить радио';
        
        // Обработчик клика
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
                playButton.disabled = false;
                spinner.style.display = 'none';
                buttonText.textContent = 'Попробовать снова';
            }
        });
        
    } catch (error) {
        console.error("Initialization failed:", error);
        
        // Обновляем состояние кнопки при ошибке
        playButton.disabled = false;
        spinner.style.display = 'none';
        buttonText.textContent = 'Ошибка загрузки. Попробовать снова';
        
        const statusEl = document.getElementById('stream-status');
        if (statusEl) {
            statusEl.style.opacity = '1';
        }
    }
});
