import { RadioPlayer } from './player/player.js';

// Конфигурация
const CONFIG = {
  themes: {
    dark: 'dark-theme',
    light: 'light-theme'
  },
  icons: {
    dark: 'fas fa-moon',
    light: 'fas fa-sun'
  },
  defaultTheme: 'dark'
};

// DOM элементы
const DOM = {
  get themeToggle() { return document.querySelector('.theme-toggle'); },
  get themeIcon() { return document.querySelector('.theme-toggle i'); },
  get menuToggle() { return document.querySelector('.menu-toggle'); },
  get menuOverlay() { return document.getElementById('menuOverlay'); },
  get playButton() { return document.getElementById('start-playback'); },
  get buttonText() { return this.playButton?.querySelector('.button-text'); },
  get spinner() { return this.playButton?.querySelector('.loading-spinner'); },
  get overlay() { return document.getElementById('audio-overlay'); },
  get statusElement() { return document.getElementById('stream-status'); }
};

// Управление темой
class ThemeManager {
  static init() {
    const savedTheme = localStorage.getItem('theme') || CONFIG.defaultTheme;
    this.applyTheme(savedTheme);
    
    if (DOM.themeToggle) {
      DOM.themeToggle.addEventListener('click', () => this.toggle());
    }
  }

  static toggle() {
    const current = document.body.classList.contains(CONFIG.themes.dark) ? 'dark' : 'light';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  static applyTheme(theme) {
    document.body.classList.remove(CONFIG.themes.dark, CONFIG.themes.light);
    document.body.classList.add(CONFIG.themes[theme]);
    localStorage.setItem('theme', theme);
    
    if (DOM.themeIcon) {
      DOM.themeIcon.className = CONFIG.icons[theme];
    }
  }
}

// Управление меню
class MenuManager {
  static init() {
    if (!DOM.menuToggle || !DOM.menuOverlay) return;

    DOM.menuToggle.addEventListener('click', () => this.toggle());
    DOM.menuOverlay.addEventListener('click', () => this.close());
    
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => this.close());
    });
  }

  static toggle() {
    const isActive = DOM.menuToggle.classList.toggle('active');
    DOM.menuOverlay.classList.toggle('active', isActive);
  }

  static close() {
    DOM.menuToggle.classList.remove('active');
    DOM.menuOverlay.classList.remove('active');
  }
}

// Управление плеером
class PlayerManager {
  static async init() {
    if (!this.validateDOM()) return;

    this.player = new RadioPlayer();
    this.updateButtonState(true, 'Загрузка плеера...');

    try {
      await this.player.init();
      this.setupPlayer();
      this.updateButtonState(false);
    } catch (error) {
      this.handleError(error);
    }
  }

  static validateDOM() {
    return DOM.playButton && DOM.buttonText && DOM.spinner && DOM.overlay;
  }

  static updateButtonState(isLoading, message = 'Запустить радио') {
    DOM.playButton.disabled = isLoading;
    DOM.spinner.style.display = isLoading ? 'inline-block' : 'none';
    DOM.buttonText.textContent = message;
  }

  static setupPlayer() {
    DOM.playButton.addEventListener('click', async () => {
      try {
        DOM.overlay.style.display = 'none';
        this.updateButtonState(true, 'Подготовка потока...');
        
        await this.waitForAudioReady();
        await this.player.elements.audio.play();
        
        if (this.player.state.audioContext?.state === 'suspended') {
          await this.player.state.audioContext.resume();
        }
        
        this.player.state.isPlaying = true;
      } catch (error) {
        this.handlePlaybackError(error);
      }
    });
  }

  static async waitForAudioReady() {
    if (this.player.elements.audio.readyState < 2) {
      await new Promise(resolve => {
        const handler = () => {
          this.player.elements.audio.removeEventListener('canplay', handler);
          resolve();
        };
        this.player.elements.audio.addEventListener('canplay', handler);
      });
    }
  }

  static handlePlaybackError(error) {
    console.error("Playback error:", error);
    this.player.setStatus(`Ошибка: ${error.message}`, true);
    DOM.overlay.style.display = 'flex';
    this.updateButtonState(false, 'Попробовать снова');
  }

  static handleError(error) {
    console.error("Initialization failed:", error);
    this.updateButtonState(false, 'Ошибка загрузки. Попробовать снова');
    DOM.statusElement?.style.setProperty('opacity', '1');
  }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  MenuManager.init();
  PlayerManager.init();
});
