import RadioPlayerConfig from './config.js';
import { NetworkUtils } from './network-utils.js';
import { UIHelpers } from './ui-helpers.js';
import { AudioOptimizer } from './audio-optimizer.js';

export class RadioPlayer {
    constructor() {
            const requiredElements = ['radio-stream', 'stream-status', 'volume-slider'];
    for (const id of requiredElements) {
        if (!document.getElementById(id)) {
            throw new Error(`Не найден элемент #${id}`);
        }
    }
        this.elements = {
            audio: document.getElementById('radio-stream'),
            statusEl: document.getElementById('stream-status'),
            volumeSlider: document.getElementById('volume-slider'),
            volumeBtn: document.getElementById('volume-btn'),
            currentTrackEl: document.getElementById('current-track'),
            nextTrackEl: document.getElementById('next-track'),
            historyList: document.getElementById('history-list'),
            listenersCount: document.getElementById('listeners-count'),
            trackTitle: document.getElementById('track-title'),
            trackArtist: document.getElementById('track-artist'),
            currentTime: document.getElementById('current-time'),
            progressBar: document.getElementById('progress-bar'),
            duration: document.getElementById('duration')
        };

            this.updateTimeDisplay = this.updateTimeDisplay.bind(this);
        
            this.animationFrameId = null;
        
            this.abortController = new AbortController();
        
            this.config = RadioPlayerConfig;
        
            this.optimizer = new AudioOptimizer(this.elements.audio, this.config);
        
            this.state = {
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
        this.elements.audio.autoplay = true;
    }

async init() {
    try {
        // Проверяем наличие необходимых элементов DOM
        if (!document.getElementById('radio-stream')) {
            throw new Error("Не найдены необходимые DOM элементы");
        }

        this.setupEventListeners();
        this.initAudioContext();
        
        // Устанавливаем начальный статус
        this.setStatus("Подключение к серверу...");
        
        // Пробуем подключиться несколько раз при необходимости
        let attempts = 3;
        while (attempts > 0) {
            if (await this.connectToStream()) break;
            attempts--;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Инициализируем API URL
        this.state.currentApiUrl = await this.findWorkingApi();
        if (!this.state.currentApiUrl) {
            throw new Error("Не удалось найти рабочий API endpoint");
        }
        
        this.startDiagnostics();
        
        // Первое обновление информации
        await this.updateTrackInfo();

        await this.optimizer.optimize();
        
        // Устанавливаем интервал для регулярных обновлений
        this.state.updateIntervalId = setInterval(
            () => this.updateTrackInfo(), 
            this.config.updateInterval
        );
        
    } catch (error) {
        console.error("Ошибка инициализации плеера:", error);
        this.setStatus("Ошибка: " + error.message, true);
        throw error;
    }
}
   
updateTimeDisplay() {
    if (this.elements.currentTime && !this.elements.audio.paused) {
        this.elements.currentTime.textContent = 
            (Math.floor(this.elements.audio.currentTime));
    }
    this.animationFrameId = requestAnimationFrame(this.updateTimeDisplay);
}
    
setupEventListeners() {
    const self = this;

    const handleFirstInteraction = () => {
        if (self.state.audioContext && self.state.audioContext.state === 'suspended') {
            self.state.audioContext.resume();
        }
        document.removeEventListener('click', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);

    this.elements.volumeBtn.addEventListener('click', () => {
        self.elements.audio.muted = !self.elements.audio.muted;
        self.updateVolumeIcon();
    });

    this.elements.volumeSlider.addEventListener('input', (e) => {
        self.elements.audio.volume = e.target.value;
        self.updateVolumeIcon();
    });

    this.elements.audio.addEventListener('error', () => {
        this.handleConnectionError(new Error("Audio element error"));
    });

    this.elements.audio.addEventListener('stalled', () => {
        this.handleNetworkIssue();
    });

    this.elements.audio.addEventListener('waiting', () => {
        this.state.diagnostics.bufferingEvents++;
        this.handleNetworkIssue();
    });

    this.elements.audio.addEventListener('timeupdate', () => {
        if (this.elements.currentTime && this.elements.progressBar) {
            const currentTime = Math.floor(this.elements.audio.currentTime);
            this.elements.currentTime.textContent = (currentTime);
            this.elements.progressBar.value = 
                (this.elements.audio.currentTime / this.elements.audio.duration) * 100 || 0;
        }
    });

    this.elements.audio.addEventListener('play', () => {
        this.updateTimeDisplay(); // Fixed line
    });

    this.elements.audio.addEventListener('pause', () => {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            this.handleBackgroundTab();
        } else {
            this.handleForegroundTab();
        }
    });
}

destroy() {
    if (this.state.timeUpdateInterval) {
        clearInterval(this.state.timeUpdateInterval);
    }
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
    }
}
    
    updateVolumeIcon() {
    if (!this.elements.volumeBtn) return;

    if (this.elements.audio.muted || this.elements.audio.volume === 0) {
        this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    } else if (this.elements.audio.volume < 0.5) {
        this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
    } else {
        this.elements.volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
}

async connectToStream(maxRetries = 3) {
    try {
        this.setStatus("Подключение...");
        
        // Используем Web Audio API для лучшего контроля буферизации
        if (!this.state.audioContext) {
            this.state.audioContext = AudioController.initAudioContext();
        }
        
        // Предварительная проверка сети
        const isOnline = await NetworkUtils.testUrl(this.config.apiEndpoints.primary, 2000);
        if (!isOnline) {
            throw new Error("Нет интернет-соединения");
        }
        
        // Выбираем поток с наименьшей задержкой
        this.state.currentStream = await this.findOptimalStream();
        
        if (!this.state.currentStream) {
            throw new Error("Все потоки недоступны");
        }
        
        // Настройка аудио элемента
        this.elements.audio.preload = "auto";
        this.elements.audio.crossOrigin = "anonymous";
        
        // Загрузка с прогрессом
        await this.loadAudioWithProgress(this.state.currentStream.url);
        
        this.setStatus("Соединение установлено");
        return true;
    } catch (error) {
        // Обработка ошибок...
    }
}

async findOptimalStream() {
    const streamTests = this.config.streams.map(async stream => {
        const startTime = performance.now();
        try {
            await NetworkUtils.testUrl(stream.url, 3000);
            const latency = performance.now() - startTime;
            return { ...stream, latency };
        } catch {
            return null;
        }
    });
    
    const results = await Promise.all(streamTests);
    const validStreams = results.filter(Boolean);
    
    if (validStreams.length === 0) return null;
    
    // Выбираем поток с наименьшей задержкой
    return validStreams.reduce((best, current) => 
        current.latency < best.latency ? current : best
    );
}

async loadAudioWithProgress(url) {
    return new Promise((resolve, reject) => {
        this.elements.audio.src = url;
        
        const onCanPlay = () => {
            cleanup();
            this.setBufferStatus(100);
            resolve();
        };
        
        const onError = (e) => {
            cleanup();
            reject(new Error(`Ошибка аудио: ${e.target.error?.message || 'Неизвестная ошибка'}`));
        };
        
        const onProgress = () => {
            const buffered = this.elements.audio.buffered;
            if (buffered.length > 0) {
                const progress = (buffered.end(buffered.length - 1) / this.elements.audio.duration) * 100;
                this.setBufferStatus(progress);
            }
        };
        
        const cleanup = () => {
            this.elements.audio.removeEventListener('canplay', onCanPlay);
            this.elements.audio.removeEventListener('error', onError);
            this.elements.audio.removeEventListener('progress', onProgress);
        };
        
        this.elements.audio.addEventListener('canplay', onCanPlay, { once: true });
        this.elements.audio.addEventListener('error', onError, { once: true });
        this.elements.audio.addEventListener('progress', onProgress);
        
        this.elements.audio.load();
    });
}

setBufferStatus(percent) {

    console.log(`Буферизация: ${percent}%`);
}

async loadAudioWithTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
        // Очистка предыдущего источника
        this.elements.audio.src = '';
        this.elements.audio.src = url;
        
        const timer = setTimeout(() => {
            reject(new Error(`Таймаут загрузки аудио (${timeout}ms)`));
        }, timeout);

        const cleanup = () => {
            clearTimeout(timer);
            this.elements.audio.removeEventListener('canplay', onCanPlay);
            this.elements.audio.removeEventListener('error', onError);
        };

        const onCanPlay = () => {
            cleanup();
            resolve();
        };

        const onError = (e) => {
            cleanup();
            reject(new Error(`Ошибка аудио: ${e.target.error?.message || 'Неизвестная ошибка'}`));
        };

        this.elements.audio.addEventListener('canplay', onCanPlay, { once: true });
        this.elements.audio.addEventListener('error', onError, { once: true });
        
        this.elements.audio.load();
    });
}
    async findWorkingStream() {
        const sortedStreams = [...this.config.streams].sort((a, b) => a.priority - b.priority);
        const streamUrls = sortedStreams.map(s => s.url);
        
        const workingUrl = await NetworkUtils.findWorkingUrl(streamUrls);
        return sortedStreams.find(s => s.url === workingUrl);
    }

    setupAudioBuffer() {
        if (!this.state.audioContext) return;

        const source = this.state.audioContext.createMediaElementSource(this.elements.audio);
        const analyser = this.state.audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(this.state.audioContext.destination);
    }

    async togglePlayback() {
        await this.connectToStream();
        this.elements.audio.play().catch(console.error);
    }

    async loadAudioSource(url) {
        this.elements.audio.src = '';
        await new Promise(resolve => setTimeout(resolve, 50)); // Даем время на разгрузку
        this.elements.audio.src = url;
        this.elements.audio.load();
    }
    
async updateTrackInfo() {
    if (!this.state.currentApiUrl) {
        try {
            this.state.currentApiUrl = await this.findWorkingApi();
            if (!this.state.currentApiUrl) {
                this.setStatus("API недоступно", true);
                return;
            }
        } catch (error) {
            console.error("Error finding API:", error);
            return;
        }
    }

    try {
        const response = await NetworkUtils.fetchWithTimeout(
            this.state.currentApiUrl, 
            5000 // Увеличили таймаут
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Кэшируем данные и время последнего обновления
        this.state.lastTrackData = data;
        this.state.lastUpdateTime = Date.now();
        
        this.updateUI(data);
    } catch (error) {
        console.error("Ошибка обновления:", error);
        
        // Используем кэшированные данные, если есть
        if (this.state.lastTrackData) {
            this.updateUI(this.state.lastTrackData);
        }
        
        // Пробуем найти новый рабочий API URL
        this.state.currentApiUrl = await this.findWorkingApi();
        this.setStatus("Проблемы с соединением, пытаемся восстановить...", true);
    }
}

        updateUI(data) {
            this.updateCurrentTrack(data.now_playing);

            if (data.playing_next) {
                this.updateNextTrack(data.playing_next);
            }

            if (data.song_history) {
                this.updateHistory(data.song_history);
            }

            if (data.listeners && data.listeners.current) {
                this.updateListenersCount(data.listeners.current);
            }
        }


updateCurrentTrack(nowPlaying) {
    this.updateAlbumArtFromAzuraCast(nowPlaying);
    const track = nowPlaying.song;
    const html = `
    <span class="track-name">${track.title || 'Неизвестный трек'}</span>
    <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
    <span class="track-progress">${(nowPlaying.elapsed)} / ${(nowPlaying.duration)}</span>
    `;

    if (this.elements.currentTrackEl) this.elements.currentTrackEl.innerHTML = html;

    if (this.elements.trackTitle) {
        this.elements.trackTitle.textContent = track.title || 'Неизвестный трек';
    }
    if (this.elements.trackArtist) {
        this.elements.trackArtist.textContent = track.artist || 'Неизвестный исполнитель';
    }
    if (this.elements.duration) {
        this.elements.duration.textContent = (nowPlaying.duration);
    }

    // Обновляем обложку альбома из AzuraCast
    this.updateAlbumArtFromAzuraCast(nowPlaying);
}

updateAlbumArtFromAzuraCast(nowPlaying) {
    const artworkUrl = this.getArtworkUrl(nowPlaying);
    this.updateAlbumArt(artworkUrl);
}

getArtworkUrl(nowPlaying) {
    let artworkUrl = this.config.artwork.defaultUrl;
    
    // Проверяем возможные источники обложки
    const sources = [
        nowPlaying.song?.art,
        nowPlaying.song?.image,
        nowPlaying.song?.album?.artwork_url,
        `${this.config.azuraCast.baseUrl}/api/station/1/art/${nowPlaying.song?.id}`
    ];
    
    for (const source of sources) {
        if (source) {
            artworkUrl = source;
            break;
        }
    }
    
    // Обработка относительных URL
    if (artworkUrl && !artworkUrl.startsWith('http') && !artworkUrl.startsWith('/')) {
        artworkUrl = `${this.config.azuraCast.baseUrl}${artworkUrl}`;
    }
    
    // Добавляем параметры для AzuraCast
    if (artworkUrl.includes(this.config.azuraCast.baseUrl)) {
        const separator = artworkUrl.includes('?') ? '&' : '?';
        artworkUrl = `${artworkUrl}${separator}size=${this.config.artwork.size}`;
    }
    
    return artworkUrl;
}
    
updateAlbumArt(imageUrl) {
    const albumCover = document.querySelector('.album-cover');
    if (!albumCover) return;

    // Проверяем URL на валидность
    if (!imageUrl || typeof imageUrl !== 'string') {
        imageUrl = this.config.artwork.defaultUrl;
    }

    // Добавляем cache buster
    const cacheBusterUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;

    albumCover.classList.add('fading');
    
    setTimeout(() => {
        const img = new Image();
        img.src = cacheBusterUrl;
        
        img.onload = () => {
            albumCover.src = cacheBusterUrl;
            albumCover.classList.remove('fading');
        };
        
        img.onerror = () => {
            console.warn('Failed to load album art, using default');
            albumCover.src = this.config.artwork.defaultUrl;
            albumCover.classList.remove('fading');
        };
    }, 200);
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
    if (!this.elements.historyList || !history) return;

    const fragment = document.createDocumentFragment();
    const recentTracks = history.slice(0, 5); // Ограничиваем количество треков

    recentTracks.forEach((item, index) => {
        const li = UIHelpers.createHistoryItem(item, index);
        fragment.appendChild(li);
    });

    // Очищаем и обновляем список за одну операцию
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
    const statusEl = this.elements.statusEl;
    if (!statusEl) return;

    // Добавляем класс show для отображения
    statusEl.classList.add('show');

    if (isError) {
        statusEl.className = 'status-error show'; // Сохраняем класс show
        statusEl.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span class="status-text">${text}</span>
        `;
    } else {
        statusEl.className = 'status-success show'; // Сохраняем класс show
        statusEl.innerHTML = `
            <span class="wave-animation">
                <span class="wave-dot"></span>
                <span class="wave-dot"></span>
                <span class="wave-dot"></span>
            </span>
            <span class="status-text">${text}</span>
        `;
    }
}
   
async findWorkingApi() {
    try {
        // Проверяем наличие apiUrls в конфиге
        if (!this.config.apiUrls || !Array.isArray(this.config.apiUrls)) {
            console.warn('apiUrls not configured, using primary endpoint');
            return this.config.apiEndpoints.primary || this.config.apiEndpoints.nowPlaying;
        }
        
        // Ищем рабочий URL среди apiUrls
        const workingUrl = await NetworkUtils.findWorkingUrl(this.config.apiUrls);
        
        if (workingUrl) {
            return workingUrl;
        }
        
        // Если ничего не найдено, пробуем основные endpoint'ы
        console.warn('No working API URL found, trying fallback endpoints');
        return this.config.apiEndpoints.primary || 
               this.config.apiEndpoints.nowPlaying || 
               this.config.apiUrls[0];
    } catch (error) {
        console.error('Error finding working API:', error);
        return this.config.apiEndpoints.primary || 
               this.config.apiEndpoints.nowPlaying || 
               (this.config.apiUrls && this.config.apiUrls[0]);
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
            this.elements.audio.play().catch(console.error);
        }
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

        setInterval(() => {
            console.log('Диагностика плеера:', {
                networkQuality: this.state.networkQuality,
                bufferingEvents: this.state.diagnostics.bufferingEvents,
                connectionErrors: this.state.diagnostics.connectionErrors,
                qualityChanges: this.state.diagnostics.qualityChanges,
                lastError: this.state.diagnostics.lastError,
                currentStream: this.state.currentStream?.url,
                isPlaying: this.state.isPlaying,
                volume: this.elements.audio.volume,
                muted: this.elements.audio.muted
            });
        }, this.config.diagnostics.logInterval);
    }
}
