import { RadioPlayer } from './player/player.js';

// Константы для классов и элементов
const THEME_CLASSES = {
  dark: 'dark-theme',
  light: 'light-theme'
};

const ICON_CLASSES = {
  dark: 'fas fa-moon',
  light: 'fas fa-sun'
};

// Утилитарные функции
const toggleTheme = () => {
  const body = document.body;
  const currentTheme = body.classList.contains(THEME_CLASSES.dark) ? 'dark' : 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Переключение темы
  body.classList.replace(THEME_CLASSES[currentTheme], THEME_CLASSES[newTheme]);
  localStorage.setItem('theme', newTheme);

  // Обновление иконки
  const icon = document.querySelector('.theme-toggle i');
  if (icon) {
    icon.className = ICON_CLASSES[newTheme];
  }
};

const setupMenuHandlers = () => {
  const menuToggle = document.querySelector('.menu-toggle');
  const menuOverlay = document.getElementById('menuOverlay');

  if (!menuToggle || !menuOverlay) return;

  // Открытие/закрытие меню
  const toggleMenu = (state) => {
    menuToggle.classList.toggle('active', state);
    menuOverlay.classList.toggle('active', state);
  };

  menuToggle.addEventListener('click', () => {
    const isActive = menuToggle.classList.contains('active');
    toggleMenu(!isActive);
  });

  menuOverlay.addEventListener('click', () => toggleMenu(false));

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => toggleMenu(false));
  });
};

const initPlayer = async () => {
  const playButton = document.getElementById('start-playback');
  const buttonText = playButton?.querySelector('.button-text');
  const spinner = playButton?.querySelector('.loading-spinner');
  const overlay = document.getElementById('audio-overlay');

  if (!playButton || !buttonText || !spinner || !overlay) return;

  const updateButtonState = (isLoading, message) => {
    playButton.disabled = isLoading;
    spinner.style.display = isLoading ? 'inline-block' : 'none';
    buttonText.textContent = message || 'Запустить радио';
  };

  try {
    console.log('Initializing player...');
    const player = new RadioPlayer();

    // Начальное состояние кнопки
    updateButtonState(true, 'Загрузка плеера...');
    await player.init();

    // Готовое состояние кнопки
    updateButtonState(false);

    // Обработчик воспроизведения
    playButton.addEventListener('click', async () => {
      try {
        overlay.style.display = 'none';
        updateButtonState(true, 'Подготовка потока...');

        if (player.elements.audio.readyState < 2) {
          await new Promise(resolve => {
            const canPlayHandler = () => {
              player.elements.audio.removeEventListener('canplay', canPlayHandler);
              resolve();
            };
            player.elements.audio.addEventListener('canplay', canPlayHandler);
          });
        }

        await player.elements.audio.play();

        if (player.state.audioContext?.state === 'suspended') {
          await player.state.audioContext.resume();
        }

        player.state.isPlaying = true;
      } catch (error) {
        console.error("Playback error:", error);
        player.setStatus(`Ошибка: ${error.message}`, true);
        overlay.style.display = 'flex';
        updateButtonState(false, 'Попробовать снова');
      }
    });

  } catch (error) {
    console.error("Initialization failed:", error);
    updateButtonState(false, 'Ошибка загрузки. Попробовать снова');
    document.getElementById('stream-status')?.style.setProperty('opacity', '1');
  }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  // Восстановление темы из localStorage
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.body.classList.add(THEME_CLASSES[savedTheme]);
  document.querySelector('.theme-toggle i')?.classList.add(ICON_CLASSES[savedTheme]);

  // Обработчики событий
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  setupMenuHandlers();
  initPlayer();
});
