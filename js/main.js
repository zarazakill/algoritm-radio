import { RadioPlayer } from './player/player.js';

// Загружаем тему из localStorage
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.remove('dark-theme', 'light-theme');
    document.body.classList.add(`${savedTheme}-theme`);
    
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
    
    // Инициализация модального окна сочетаний клавиш
    const keyboardShortcuts = document.querySelector('.keyboard-shortcuts');
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const closeShortcuts = document.getElementById('close-shortcuts');
    
    if (keyboardShortcuts && shortcutsModal) {
        keyboardShortcuts.addEventListener('click', () => {
            shortcutsModal.classList.add('active');
        });
        
        if (closeShortcuts) {
            closeShortcuts.addEventListener('click', () => {
                shortcutsModal.classList.remove('active');
            });
        }
        
        // Закрытие по клику вне содержимого
        shortcutsModal.addEventListener('click', (e) => {
            if (e.target === shortcutsModal) {
                shortcutsModal.classList.remove('active');
            }
        });
    }
});

// Показать всплывающее сообщение
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'info-circle';
    if (type === 'success') iconClass = 'check-circle';
    if (type === 'error') iconClass = 'exclamation-circle';
    if (type === 'warning') iconClass = 'exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas fa-${iconClass} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Анимация появления
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Добавляем обработчик для закрытия
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        });
    }
    
    // Автоматическое скрытие
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

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
        
        showToast(`Тема переключена на ${newTheme === 'dark' ? 'тёмную' : 'светлую'}`, 'success');
    });
}

// Прогресс загрузки с тултипом
function setupProgressTooltip() {
    const progressBar = document.getElementById('progress-bar');
    const tooltip = document.getElementById('progress-tooltip');
    
    if (progressBar && tooltip) {
        progressBar.addEventListener('mousemove', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const position = ((e.clientX - rect.left) / rect.width) * 100;
            tooltip.style.left = `${position}%`;
            
            // Преобразуем позицию в секунды и форматируем
            const audio = document.getElementById('radio-stream');
            if (audio) {
                const seconds = (position / 100) * audio.duration;
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                tooltip.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }
            
            tooltip.style.opacity = '1';
        });
        
        progressBar.addEventListener('mouseout', () => {
            tooltip.style.opacity = '0';
        });
    }
}

// Обновление процента громкости
function updateVolumePercentage() {
    const volumeSlider = document.getElementById('volume-slider');
    const volumePercentage = document.getElementById('volume-percentage');
    
    if (volumeSlider && volumePercentage) {
        volumePercentage.textContent = `${Math.round(volumeSlider.value * 100)}%`;
        
        volumeSlider.addEventListener('input', () => {
            volumePercentage.textContent = `${Math.round(volumeSlider.value * 100)}%`;
        });
    }
}

// Горячие клавиши
function setupKeyboardShortcuts(player) {
    document.addEventListener('keydown', (e) => {
        // Пропускаем, если фокус в элементе ввода
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const audio = document.getElementById('radio-stream');
        if (!audio) return;
        
        switch (e.key) {
            case ' ': // Пробел: пауза/воспр.
                e.preventDefault();
                player.togglePlayback();
                break;
                
            case 'm': // M: отключение звука
            case 'м': // Русская М
                audio.muted = !audio.muted;
                player.updateVolumeIcon();
                showToast(`Звук ${audio.muted ? 'выключен' : 'включен'}`, 'info');
                break;
                
            case 'ArrowUp': // Стрелка вверх: увеличить громкость
                e.preventDefault();
                const newVolumeUp = Math.min(1, audio.volume + 0.05);
                audio.volume = newVolumeUp;
                const volumeSlider = document.getElementById('volume-slider');
                if (volumeSlider) volumeSlider.value = newVolumeUp;
                player.updateVolumeIcon();
                showToast(`Громкость: ${Math.round(newVolumeUp * 100)}%`, 'info');
                updateVolumePercentage();
                break;
                
            case 'ArrowDown': // Стрелка вниз: уменьшить громкость
                e.preventDefault();
                const newVolumeDown = Math.max(0, audio.volume - 0.05);
                audio.volume = newVolumeDown;
                const volumeSliderDown = document.getElementById('volume-slider');
                if (volumeSliderDown) volumeSliderDown.value = newVolumeDown;
                player.updateVolumeIcon();
                showToast(`Громкость: ${Math.round(newVolumeDown * 100)}%`, 'info');
                updateVolumePercentage();
                break;
                
            case 't': // T: переключение темы
            case 'е': // Русская Е
                document.querySelector('.theme-toggle')?.click();
                break;
                
            case 'Escape': // Esc: закрыть все модальные окна
                document.getElementById('shortcuts-modal')?.classList.remove('active');
                break;
        }
    });
}

// Эквалайзер-анимация
function animateEqualizer(isPlaying) {
    const container = document.getElementById('equalizer-container');
    if (!container) return;
    
    if (isPlaying) {
        container.classList.add('active');
        const bars = container.querySelectorAll('.equalizer-bar');
        bars.forEach(bar => {
            // Рандомизируем анимацию
            const duration = 0.5 + Math.random();
            const delay = Math.random() * 0.5;
            bar.style.animation = `equalizerBar ${duration}s ease-in-out ${delay}s infinite alternate`;
        });
    } else {
        container.classList.remove('active');
        const bars = container.querySelectorAll('.equalizer-bar');
        bars.forEach(bar => {
            bar.style.animation = 'none';
            bar.style.height = '2px';
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const playButton = document.getElementById('start-playback');
    const buttonText = playButton?.querySelector('.button-text');
    const spinner = playButton?.querySelector('.loading-spinner');
    const overlay = document.getElementById('audio-overlay');
    const menuToggle = document.querySelector('.menu-toggle');
    const menuOverlay = document.getElementById('menuOverlay');
    
    // Инициализация дополнительных UI элементов
    setupProgressTooltip();
    updateVolumePercentage();
    
    // Функция для обновления времени в статусе
    function updateStatusTime() {
        const statusTime = document.getElementById('status-time');
        if (statusTime) {
            const now = new Date();
            statusTime.textContent = now.toLocaleTimeString();
        }
    }
    
    // Обновляем время каждую секунду
    setInterval(updateStatusTime, 1000);
    updateStatusTime(); // Вызываем сразу же

    // Обработчики меню
    if (menuToggle && menuOverlay) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            menuOverlay.classList.toggle('active');
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
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', (e) => {
        if (menuOverlay && menuOverlay.classList.contains('active') && 
            !e.target.closest('.menu-content') && !e.target.closest('.menu-toggle')) {
            menuToggle.classList.remove('active');
            menuOverlay.classList.remove('active');
        }
    });
    
    try {
        console.log('Initializing player...');
        const player = new RadioPlayer();
        
        // Настройка клавиатурных сокращений
        setupKeyboardShortcuts(player);
        
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
        
        // Слушаем события состояния для эквалайзера
        const audio = document.getElementById('radio-stream');
        if (audio) {
            audio.addEventListener('playing', () => {
                animateEqualizer(true);
            });
            
            audio.addEventListener('pause', () => {
                animateEqualizer(false);
            });
            
            audio.addEventListener('waiting', () => {
                animateEqualizer(false);
            });
            
            audio.addEventListener('ended', () => {
                animateEqualizer(false);
            });
        }
        
        // Обработчик клика
        if (playButton && overlay && buttonText && spinner) {
playButton.addEventListener('click', async () => {
    try {
        // Показываем состояние загрузки
        playButton.disabled = true;
        spinner.style.display = 'inline-block';
        buttonText.textContent = 'Подготовка потока...';
        
        // 1. Инициализируем AudioContext при первом клике
        if (!player.state.audioContext) {
            player.initAudioContext();
        }
        // 2. Возобновляем AudioContext если он приостановлен
        else if (player.state.audioContext.state === 'suspended') {
            await player.state.audioContext.resume();
        }
        
        // 3. Запускаем воспроизведение
        await player.elements.audio.play();
        
        // Обновляем UI
        player.state.isPlaying = true;
        animateEqualizer(true);
        overlay.style.display = 'none';
        showToast('Радио запущено', 'success');
        
    } catch (error) {
        console.error("Playback error:", error);
        
        // Особенная обработка для iOS
        if (error.name === 'NotAllowedError') {
            showToast('Нажмите на кнопку воспроизведения ещё раз', 'warning');
        } else {
            showToast(`Ошибка воспроизведения: ${error.message}`, 'error');
        }
        
        // Возвращаем кнопку в исходное состояние
        playButton.disabled = false;
        spinner.style.display = 'none';
        buttonText.textContent = 'Попробовать снова';
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
        
        showToast(`Ошибка инициализации: ${error.message}`, 'error');
    }
});

