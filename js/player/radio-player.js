import { RadioConfig } from './config.js';
import { UIHelpers } from './ui-helpers.js';
import { NetworkUtils } from './network-utils.js';
import { AudioController } from './audio-controller.js';

export class RadioPlayer {
    constructor(config = RadioConfig) {
        this.config = config;
        this.elements = this.initElements();
        this.state = this.initState();
        
        if (!this.elements.audio) {
            console.error('Аудио элемент не найден!');
            return;
        }

        this.init();
    }

    initElements() {
        return {
            audio: document.getElementById('radio-stream'),
            statusEl: document.getElementById('stream-status'),
            volumeBtn: document.getElementById('volume-btn'),
            currentTrackEl: document.getElementById('current-track')
        };
    }

    initState() {
        return {
            currentStream: null,
            isPlaying: false,
            audioContext: null
        };
    }

    async init() {
        try {
            this.setupEventListeners();
            this.state.audioContext = AudioController.initAudioContext();
            await this.connectToStream();
            this.setStatus("Готов к воспроизведению");
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.setStatus("Ошибка инициализации", true);
        }
    }

    setupEventListeners() {
        this.elements.audio.addEventListener('play', () => {
            this.state.isPlaying = true;
            this.setStatus("Играет");
        });

        this.elements.audio.addEventListener('pause', () => {
            this.state.isPlaying = false;
            this.setStatus("Пауза");
        });

        this.elements.audio.addEventListener('error', () => {
            this.setStatus("Ошибка воспроизведения", true);
        });
    }

    async connectToStream() {
        try {
            this.setStatus("Подключение...");
            this.state.currentStream = await NetworkUtils.findWorkingStream(this.config.streams);
            
            if (!this.state.currentStream) {
                throw new Error("Все потоки недоступны");
            }

            this.elements.audio.src = this.state.currentStream.url;
            await this.elements.audio.play();
        } catch (error) {
            console.error('Ошибка подключения:', error);
            this.setStatus("Ошибка подключения", true);
            throw error;
        }
    }

    setStatus(text, isError = false) {
        if (this.elements.statusEl) {
            this.elements.statusEl.textContent = text;
            this.elements.statusEl.className = isError ? 'error' : 'success';
        }
    }
}
