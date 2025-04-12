import RadioPlayerConfig from './config.js';
import { NetworkUtils } from './network-utils.js';
import { UIHelpers } from './ui-helpers.js';
import { AudioController } from './audio-controller.js';

export class RadioPlayer {
constructor() {
    const requiredElements = ['stream-status', 'volume-slider', 'volume-btn'];
    for (const id of requiredElements) {
        if (!document.getElementById(id)) {
            throw new Error(`Не найден элемент #${id}`);
        }
    }

    // Инициализация Web Worker
    this.worker = null;
    try {
        if (window.Worker) {
            this.worker = new Worker(new URL('./data-worker.js', import.meta.url));
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
            this.worker.onerror = this.handleWorkerError.bind(this);
        } else {
            console.warn('Web Workers не поддерживаются в этом браузере');
        }
    } catch (error) {
        console.error('Ошибка инициализации Worker:', error);
    }

    this.audioController = new AudioController(
        document.getElementById('radio-stream'),
        {
            volumeBtn: document.getElementById('volume-btn'),
            volumeSlider: document.getElementById('volume-slider'),
            currentTimeEl: document.getElementById('current-time'),
            progressBar: document.getElementById('progress-bar'),
            statusEl: document.getElementById('stream-status')
        }
    );

handleWorkerMessage(e) {
    if (e.data.error) {
        console.error('Ошибка из Worker:', e.data.error);
        // Используем обычную обработку данных
        this.updateUI(e.data.original || {});
    } else {
        this.updateUI(e.data);
    }
}

handleWorkerError(error) {
    console.error('Worker error:', error);
    // Отключаем Worker при ошибке
    this.worker?.terminate();
    this.worker = null;
}
        
        this.audioController = new AudioController(
            document.getElementById('radio-stream'),
            {
                volumeBtn: document.getElementById('volume-btn'),
                volumeSlider: document.getElementById('volume-slider'),
                currentTimeEl: document.getElementById('current-time'),
                progressBar: document.getElementById('progress-bar'),
                statusEl: document.getElementById('stream-status')
            }
        );

        this.elements = {
            currentTrackEl: document.getElementById('current-track'),
            nextTrackEl: document.getElementById('next-track'),
            historyList: document.getElementById('history-list'),
            listenersCount: document.getElementById('listeners-count'),
            trackTitle: document.getElementById('track-title'),
            trackArtist: document.getElementById('track-artist'),
            duration: document.getElementById('duration')
        };

        this.config = RadioPlayerConfig;
        this.state = {
            diagnosticsIntervalId: null,
            updateIntervalId: null,
            currentStream: null,
            currentApiUrl: null,
            isPlaying: false,
            retryCount: 0,
            networkQuality: 'good',
            lastUpdateTime: 0,
            audioContext: null,
            diagnostics: {
                bufferingEvents: 0,
                connectionErrors: 0,
                qualityChanges: 0,
                lastError: null
            }
        };
    }

async init() {
  try {
    // Основная инициализация
    const initTasks = [
        this.setupThemeToggle(),
        this.setupEventListeners(),
        this.initAudioContext()
    ];
    
    // Параллельная загрузка
    await Promise.all(initTasks);
    
    // Последовательные действия
    await this.connectWithRetry(3);
    await this.initializeData();

                } catch (error) {
        console.error("Ошибка инициализации плеера:", error);
        this.audioController.setStatus("Ошибка инициализации", true);
        throw error;
    }
}

async connectWithRetry(maxAttempts) {
    let attempts = 0;
    while (attempts < maxAttempts) {
        if (await this.connectToStream()) return true;
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
    }
    throw new Error("Не удалось подключиться после нескольких попыток");
}

async initializeData() {
    await Promise.all([
        this.findWorkingApi().then(url => { this.state.currentApiUrl = url; }),
        this.updateTrackInfo(),
        this.preloadNextTracks()
    ]);
    this.startDiagnostics();
}

    setupThemeToggle() {
        const body = document.body;
        const themeToggleBtn = document.createElement('button');
        themeToggleBtn.classList.add('theme-toggle');
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';

        const savedTheme = localStorage.getItem('theme') || RadioPlayer.DEFAULT_THEME;
        body.classList.add(savedTheme + '-theme');
        this.updateThemeIcon(themeToggleBtn, savedTheme);

        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            body.classList.remove(currentTheme + '-theme');
            body.classList.add(newTheme + '-theme');
            localStorage.setItem('theme', newTheme);
            this.updateThemeIcon(themeToggleBtn, newTheme);
        });

        document.querySelector('.container').appendChild(themeToggleBtn);
    }

    updateThemeIcon(button, theme) {
        button.innerHTML = theme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    }

setupEventListeners() {
    const handleFirstInteraction = () => {
        if (this.state.audioContext && this.state.audioContext.state === 'suspended') {
            this.state.audioContext.resume();
        }
        document.removeEventListener('click', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);

    // Добавьте обработчики для кнопки mute и слайдера громкости
    document.getElementById('volume-btn').addEventListener('click', () => {
        this.audioController.toggleMute();
    });

    document.getElementById('volume-slider').addEventListener('input', (e) => {
        this.audioController.setVolume(parseFloat(e.target.value));
    });

    this.audioController.setupProgressUpdates();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            this.handleBackgroundTab();
        } else {
            this.handleForegroundTab();
        }
    });
}

    updateVolumeIcon() {
    if (!this.elements.volumeBtn) return;

    if (this.audioController.isMuted() || this.audioController.getVolume() === 0) {
        this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    } else if (this.audioController.getVolume() < 0.5) {
        this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
    } else {
        this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
}

async connectToStream(maxRetries = 3) {
    try {
        this.audioController.setStatus("Подключение...");
        
        // Параллельная загрузка потока и информации о треках
        const [stream, apiUrl] = await Promise.all([
            this.findWorkingStream().catch(() => null),
            this.findWorkingApi().catch(() => null)
        ]);

        if (!stream) throw new Error("Все потоки недоступны");
        
        this.state.currentStream = stream;
        this.state.currentApiUrl = apiUrl;

        // Параллельная загрузка аудио и данных о текущем треке
        await Promise.all([
            this.audioController.setSource(stream.url, 10000),
            this.updateTrackInfo()
        ]);

        this.audioController.setStatus("Соединение установлено");
        return true;
    } catch (error) {
        console.error("Ошибка подключения:", error);
        this.audioController.setStatus(`Ошибка: ${error.message}`, true);
        
        if (error.name !== 'AbortError') {
            this.handleConnectionError(error);
        }
        
        return false;
    }
}

async preloadNextTracks() {
    if (!this.state.currentApiUrl) return;
    
    try {
        const response = await fetch(this.state.currentApiUrl, {
            headers: {
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        this.state.nextTracks = data.playing_next;
    } catch (e) {
        console.log("Не удалось загрузить данные о следующих треках", e);
    }
}

async findWorkingStream() {
    const sortedStreams = [...this.config.streams].sort((a, b) => a.priority - b.priority);
    const streamUrls = sortedStreams.map(s => s.url);
    
    const workingUrl = await NetworkUtils.findWorkingUrl(streamUrls);
    return sortedStreams.find(s => s.url === workingUrl);
}

    setupAudioBuffer() {
        if (!this.state.audioContext) return;

        const source = this.state.audioContext.createMediaElementSource(this.audioController.audio);
        const analyser = this.state.audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(this.state.audioContext.destination);
    }

    async togglePlayback() {
        await this.connectToStream();
        this.audioController.play().catch(console.error);
    }
   
async updateTrackInfo() {
    if (!this.state.currentApiUrl) return;
    
    const cacheKey = `trackInfo_${this.state.currentStream?.url}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
        this.updateUI(JSON.parse(cached));
    }
    
    try {
        const response = await NetworkUtils.fetchWithTimeout(
            this.state.currentApiUrl, 
            2000,
            { headers: { 'Accept': 'application/json' } }
        );
        const data = await response.json();
        
        // Кэшируем данные
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}_timestamp`, Date.now());
        
        // Отправляем данные в Worker или обрабатываем напрямую
        if (this.worker) {
            this.worker.postMessage(data);
        } else {
            this.updateUI(data);
        }
    } catch (error) {
        console.error("Ошибка обновления:", error);
        if (cached) this.updateUI(JSON.parse(cached));
    }
}

async initWorker() {
    try {
        // Проверяем доступность файла worker
        const response = await fetch(new URL('./data-worker.js', import.meta.url));
        if (response.ok) {
            this.worker = new Worker(new URL('./data-worker.js', import.meta.url));
            // ... настройка обработчиков ...
        }
    } catch (error) {
        console.error('Worker file not found:', error);
    }
}

updateUI(data) {
    // Отложенный рендеринг для тяжелых элементов
    requestAnimationFrame(() => {
        this.updateCurrentTrack(data.now_playing);

        setTimeout(() => {
            if (data.playing_next) this.updateNextTrack(data.playing_next);
            if (data.song_history) this.updateHistory(data.song_history);
        }, 0);
    });

    // Приоритетные данные загружаем сразу
    if (data.listeners?.current) {
        this.updateListenersCount(data.listeners.current);
    }

    // Fallback если Worker не доступен
    if (!this.worker) {
        const processed = {
            now_playing: this.processTrack(data.now_playing),
            history: Array.isArray(data.song_history) ? 
                data.song_history.map(this.processTrack) : 
                []
        };
        this.renderUI(processed);
    }
}

    renderUI(data) {
    this.updateCurrentTrack(data.now_playing);
    if (data.history) {
        this.updateHistory(data.history);
    }
}

processTrack(track) {
    if (!track) return null;
    return {
        title: track.song?.title || 'Неизвестный трек',
        artist: track.song?.artist || 'Неизвестный исполнитель',
        duration: track.duration ? UIHelpers.formatTime(track.duration) : ''
    };
}
    updateCurrentTrack(nowPlaying) {
        const track = nowPlaying.song;
        const html = `
        <span class="track-name">${track.title || 'Неизвестный трек'}</span>
        <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
        <span class="track-progress">${UIHelpers.formatTime(nowPlaying.elapsed)} / ${UIHelpers.formatTime(nowPlaying.duration)}</span>
        `;

        if (this.elements.currentTrackEl) this.elements.currentTrackEl.innerHTML = html;

        if (this.elements.trackTitle) {
            this.elements.trackTitle.textContent = track.title || 'Неизвестный трек';
        }
        if (this.elements.trackArtist) {
            this.elements.trackArtist.textContent = track.artist || 'Неизвестный исполнитель';
        }
        if (this.elements.duration) {
            this.elements.duration.textContent = UIHelpers.formatTime(nowPlaying.duration);
        }
    }

    updateNextTrack(playingNext) {
        const track = playingNext.song;
        const html = `
        <span class="track-name">${track.title || 'Неизвестный трек'}</span>
        <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
        `;

        if (this.elements.nextTrackEl) this.elements.nextTrackEl.innerHTML = html;
    }

    updateTrackUI(data) {
        try {
            this.updateCurrentTrack(data.now_playing);

            if (data.playing_next) {
                this.updateNextTrack(data.playing_next);
            }

            if (data.song_history && Array.isArray(data.song_history)) {
                this.updateHistory(data.song_history);
            }

            if (data.listeners && data.listeners.current) {
                this.updateListenersCount(data.listeners.current);
            }
        } catch (e) {
            console.error("Ошибка обработки данных:", e);
        }
    }

updateHistory(history) {
    if (!this.elements.historyList) return;
    
    // Виртуализация списка - рендерим только видимые элементы
    const fragment = document.createDocumentFragment();
    history.slice(0, 10).forEach((item, index) => {
        const li = UIHelpers.createHistoryItem(item, index);
        fragment.appendChild(li);
    });
    
    this.elements.historyList.innerHTML = '';
    this.elements.historyList.appendChild(fragment);
}

    updateListenersCount(count) {
        if (this.elements.listenersCount) {
            this.elements.listenersCount.textContent = 
                `${count} ${UIHelpers.pluralize(count, ['слушатель', 'слушателя', 'слушателей'])}`;
        }
    }

    setStatus(text, isError = false) {
        if (this.elements.statusEl) {
            this.elements.statusEl.textContent = text;
            this.elements.statusEl.className = isError ? 'status-error' : 'status-success';
        }
    }

async findWorkingApi() {
    try {
        // Сначала пробуем с CORS
        const workingApi = await NetworkUtils.findWorkingUrl(this.config.apiEndpoints);
        if (workingApi) return workingApi.url;
        
        // Если не работает, пробуем без CORS
        const noCorsEndpoints = this.config.apiEndpoints.map(ep => ({
            ...ep,
            corsOptions: { mode: 'no-cors' }
        }));
        const fallbackApi = await NetworkUtils.findWorkingUrl(noCorsEndpoints);
        return fallbackApi?.url || null;
    } catch (error) {
        console.error('Error finding working API:', error);
        return null;
    }
}

    handleConnectionError(error) {
        console.error("Ошибка подключения:", error);
        this.setStatus(`Ошибка: ${error.message}`, true);

        const delay = Math.min(3000 * Math.pow(2, this.state.retryCount), 30000);
        setTimeout(() => {
            this.connectToStream();
            this.state.retryCount++;
        }, delay);

        document.getElementById('audio-overlay').style.display = 'flex';
    }

    handleNetworkIssue() {
        if (this.state.networkQuality === 'good') {
            this.state.networkQuality = 'degraded';
            this.state.diagnostics.qualityChanges++;
            this.adjustForNetworkQuality();
        }
    }

    adjustForNetworkQuality() {
        switch (this.state.networkQuality) {
            case 'degraded':
                clearInterval(this.state.updateIntervalId);
                this.state.updateIntervalId = setInterval(
                    () => this.updateTrackInfo(),
                    this.config.updateInterval * 2
                );
                break;
            case 'good':
            default:
                clearInterval(this.state.updateIntervalId);
                this.state.updateIntervalId = setInterval(
                    () => this.updateTrackInfo(),
                    this.config.updateInterval
                );
        }
    }

    handleBackgroundTab() {
        if (this.state.audioContext) {
            this.state.audioContext.suspend().catch(console.error);
        }

        clearInterval(this.state.updateIntervalId);
        this.state.updateIntervalId = setInterval(
            () => this.updateTrackInfo(),
            this.config.updateInterval * 3
        );
    }
  
    initAudioContext() {
        try {
            this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.error("Ошибка инициализации AudioContext:", error);
        }
    }

    startDiagnostics() {
        if (!this.config.diagnostics.enabled) return;

        this.state.diagnosticsIntervalId = setInterval(() => {
            console.log('Диагностика плеера:', {
                networkQuality: this.state.networkQuality,
                bufferingEvents: this.state.diagnostics.bufferingEvents,
                connectionErrors: this.state.diagnostics.connectionErrors,
                qualityChanges: this.state.diagnostics.qualityChanges,
                lastError: this.state.diagnostics.lastError,
                currentStream: this.state.currentStream?.url,
                isPlaying: this.state.isPlaying,
                volume: this.audioController.getVolume(),
                muted: this.audioController.isMuted()
            });
        }, this.config.diagnostics.logInterval);
    }

    handleForegroundTab() {
        if (this.state.audioContext) {
            this.state.audioContext.resume().catch(console.error);
        }

        clearInterval(this.state.updateIntervalId);
        this.state.updateIntervalId = setInterval(
            () => this.updateTrackInfo(),
            this.config.updateInterval
        );

        if (this.state.isPlaying) {
            this.audioController.play().catch(console.error);
        }
    }

    destroy() {
        if (this.state.diagnosticsIntervalId) {
            clearInterval(this.state.diagnosticsIntervalId);
        }
        if (this.state.updateIntervalId) {
            clearInterval(this.state.updateIntervalId);
        }
        this.audioController.destroy();
    }
}

RadioPlayer.DEFAULT_THEME = 'dark';
