import RadioPlayerConfig from './config.js';
import { NetworkUtils } from './network-utils.js';
import { UIHelpers } from './ui-helpers.js';
import { AudioController } from './audio-controller.js';

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
            streamDuration: document.getElementById('stream-duration'),
            currentTime: document.getElementById('current-time'),
            progressBar: document.getElementById('progress-bar'),
            duration: document.getElementById('duration'),
            loader: document.getElementById('loader'),
            loadingStatus: document.getElementById('loadingStatus'),
            networkQuality: document.getElementById('network-quality'),
            retryCount: document.getElementById('retry-count'),
            uptime: document.getElementById('uptime'),
            statusMessage: document.getElementById('status-message'),
            connectionProgress: document.getElementById('connection-progress')
        };

        this.abortController = new AbortController();
        this.config = RadioPlayerConfig;
 
        this.state = {
            timeUpdateInterval: null,
            currentStream: null,
            currentApiUrl: null,
            isPlaying: false,
            retryCount: 0,
            networkQuality: 'good',
            lastUpdateTime: 0,
            audioContext: null,
            startTime: null,
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
            
            // Показываем индикаторы загрузки
            if (this.elements.loader) {
                this.elements.loader.style.display = 'block';
            }
            if (this.elements.loadingStatus) {
                this.elements.loadingStatus.style.display = 'block';
                this.elements.loadingStatus.textContent = 'Подключение к серверу...';
            }
            
            // Устанавливаем начальный статус
            this.setStatus("Подключение к серверу...");
            this.updateStatusMessage("Подключение к серверу...");

            // Сначала находим рабочий поток
            this.state.currentStream = await this.findWorkingStream();
            
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
            this.startUptimeCounter();
            
            // Первое обновление информации
            await this.updateTrackInfo();
            
            // Скрываем индикаторы загрузки
            if (this.elements.loader) {
                this.elements.loader.style.display = 'none';
            }
            if (this.elements.loadingStatus) {
                this.elements.loadingStatus.style.display = 'none';
            }
            
            // Устанавливаем интервал для регулярных обновлений
            this.state.updateIntervalId = setInterval(
                () => this.updateTrackInfo(), 
                this.config.updateInterval
            );
            
        } catch (error) {
            console.error("Ошибка инициализации плеера:", error);
            this.setStatus("Ошибка: " + error.message, true);
            this.updateStatusMessage("Ошибка: " + error.message, true);
            
            if (this.elements.loader) {
                this.elements.loader.style.display = 'none';
            }
            if (this.elements.loadingStatus) {
                this.elements.loadingStatus.style.display = 'block';
                this.elements.loadingStatus.textContent = `Ошибка: ${error.message}`;
            }
            
            throw error;
        }
    }

setupEventListeners() {
    const self = this;

 const handleFirstInteraction = async () => {
    if (self.state.audioContext) {
        try {
            if (self.state.audioContext.state === 'suspended') {
                await self.state.audioContext.resume();
                console.log('AudioContext resumed after user interaction');
                
                // Если аудио должно играть, запускаем его после разрешения контекста
                if (self.state.isPlaying && self.elements.audio.paused) {
                    await self.elements.audio.play();
                }
            }
        } catch (error) {
            console.error('Error resuming AudioContext:', error);
        }
    }
    document.removeEventListener('click', handleFirstInteraction);
};

    document.addEventListener('click', handleFirstInteraction);

        // Используем стрелочные функции для сохранения контекста
        this.elements.volumeBtn.addEventListener('click', () => {
            self.elements.audio.muted = !self.elements.audio.muted;
            self.updateVolumeIcon();
        });

        this.elements.volumeSlider.addEventListener('input', (e) => {
            self.elements.audio.volume = e.target.value;
            self.updateVolumeIcon();
            // Сохраняем значение громкости в localStorage
            localStorage.setItem('radioVolume', e.target.value);
        });

        // Загружаем сохраненную громкость
        const savedVolume = localStorage.getItem('radioVolume');
        if (savedVolume !== null) {
            this.elements.audio.volume = parseFloat(savedVolume);
            this.elements.volumeSlider.value = parseFloat(savedVolume);
            this.updateVolumeIcon();
        }

        this.elements.audio.addEventListener('error', (e) => {
        console.error("Audio error:", e);
        if (!this.state.currentStream?.url) {
            this.handleConnectionError(new Error("URL потока не установлен"));
            } else {
            this.handleConnectionError(new Error("Ошибка аудио: " + (e.target.error?.message || "Неизвестная ошибка")));
        }
        });

        this.elements.audio.addEventListener('stalled', () => {
            this.handleNetworkIssue();
            this.updateStatusMessage("Буферизация...");
        });

        this.elements.audio.addEventListener('waiting', () => {
            this.state.diagnostics.bufferingEvents++;
            this.handleNetworkIssue();
            this.updateStatusMessage("Буферизация...");
            
            if (this.elements.loader) {
                this.elements.loader.style.display = 'block';
            }
        });
        
this.elements.audio.addEventListener('playing', () => {
    this.updateStatusMessage("Воспроизведение");
    
    if (this.elements.loader) {
        this.elements.loader.style.display = 'none';
    }
    
    // Устанавливаем время начала воспроизведения только если оно еще не установлено
    if (!this.state.startTime) {
        this.state.startTime = Date.now();
        // Запускаем обновление времени стрима
        this.state.streamTimeInterval = setInterval(() => {
            if (this.state.startTime && this.elements.streamDuration) {
                const streamTime = Math.floor((Date.now() - this.state.startTime) / 1000);
                this.elements.streamDuration.textContent = this.formatStreamTime(streamTime);
            }
        }, 1000);
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

formatStreamTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
    
    async connectToStream(maxRetries = 3) {
        try {
            // 1. Проверка элементов DOM
            if (!this.elements.audio || !this.elements.statusEl) {
                throw new Error("Не найдены необходимые DOM элементы");
            }

            if (!this.state.currentStream?.url) {
                throw new Error("URL потока не установлен");
            }

            this.setStatus("Подключение...");
            this.updateStatusMessage("Подключение к потоку...");
            this.updateConnectionProgress(20);
            
            // 2. Поиск рабочего потока с улучшенной обработкой ошибок
            try {
                this.state.currentStream = await Promise.race([
                    this.findWorkingStream(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Таймаут поиска потока")), 5000)
                    )
                ]);
                this.updateConnectionProgress(50);
            } catch (streamError) {
                if (maxRetries > 0) {
                    console.warn(`Повторная попытка подключения (осталось ${maxRetries} попыток)`);
                    this.updateStatusMessage(`Повторная попытка подключения...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return this.connectToStream(maxRetries - 1);
                }
                throw streamError;
            }

            if (!this.state.currentStream) {
                throw new Error("Все потоки недоступны");
            }

            // 3. Управление прерываниями
            this.abortController?.abort();
            this.abortController = new AbortController();

            // 4. Загрузка аудио с улучшенной обработкой
            try {
                this.updateStatusMessage("Загрузка аудио...");
                this.updateConnectionProgress(75);
                await this.loadAudioWithTimeout(this.state.currentStream.url, 10000);
                this.setStatus("Соединение установлено");
                this.updateStatusMessage("Соединение установлено");
                this.updateConnectionProgress(100);
                return true;
            } catch (loadError) {
                console.error("Ошибка загрузки аудио:", loadError);
                if (maxRetries > 0) {
                    return this.connectToStream(maxRetries - 1);
                }
                throw loadError;
            }

        } catch (error) {
            console.error("Ошибка подключения:", error);
            this.setStatus(`Ошибка: ${error.message}`, true);
            this.updateStatusMessage(`Ошибка: ${error.message}`, true);
            this.updateConnectionProgress(0);
            
            if (error.name !== 'AbortError') {
                this.handleConnectionError(error);
            }
            
            return false;
        }
    }

async loadAudioWithTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
        // Устанавливаем CORS атрибуты
        this.elements.audio.crossOrigin = 'anonymous';
        this.elements.audio.preload = 'auto';
        
        // Очистка предыдущего источника
        this.elements.audio.pause();
        this.elements.audio.src = '';
        this.elements.audio.load();

        const timer = setTimeout(() => {
            reject(new Error(`Таймаут загрузки аудио (${timeout}ms)`));
            this.elements.audio.removeEventListener('canplay', onCanPlay);
            this.elements.audio.removeEventListener('error', onError);
        }, timeout);

        const onCanPlay = () => {
            clearTimeout(timer);
            resolve();
        };

        const onError = (e) => {
            clearTimeout(timer);
            reject(new Error(`Ошибка аудио: ${e.target.error?.message || 'Неизвестная ошибка'}`));
        };

        this.elements.audio.addEventListener('canplay', onCanPlay, { once: true });
        this.elements.audio.addEventListener('error', onError, { once: true });
        
        // Устанавливаем новый источник после добавления обработчиков
        this.elements.audio.src = url;
        this.elements.audio.load();
    });
}
    
async findWorkingStream() {
    const sortedStreams = [...this.config.streams].sort((a, b) => a.priority - b.priority);

    for (const stream of sortedStreams) {
        try {
            // Проверяем доступность с CORS
            const response = await fetch(stream.url, {
                method: 'HEAD',
                mode: 'cors'
            });
            
            if (response.ok) {
                return stream;
            }
        } catch (error) {
            console.warn(`Stream ${stream.url} is not available:`, error);
        }
    }

    throw new Error("Все потоки недоступны");
}

async togglePlayback() {
    if (this.state.isPlaying) {
        this.elements.audio.pause();
        this.state.isPlaying = false;
        this.updateStatusMessage("Пауза");
        
        // Приостанавливаем AudioContext при паузе
        if (this.state.audioContext) {
            await this.state.audioContext.suspend().catch(console.error);
        }
    } else {
        try {
            await this.connectToStream();
            
            // Возобновляем AudioContext перед воспроизведением
            if (this.state.audioContext && this.state.audioContext.state === 'suspended') {
                await this.state.audioContext.resume();
            }
            
            await this.elements.audio.play();
            this.state.isPlaying = true;
            this.updateStatusMessage("Воспроизведение");
        } catch (err) {
            console.error("Ошибка воспроизведения:", err);
            this.updateStatusMessage("Ошибка воспроизведения", true);
            
            // Если ошибка связана с политиками, предлагаем пользователю взаимодействие
            if (err.name === 'NotAllowedError') {
                showToast('Нажмите на страницу, чтобы разрешить воспроизведение', 'warning');
            }
        }
    }
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
                this.updateStatusMessage("API недоступно", true);
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
            5000
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Проверяем, изменился ли трек
        if (this.isTrackChanged(data.now_playing, this.state.lastTrackData?.now_playing)) {
            // Очищаем предыдущий интервал
            if (this.state.timeUpdateInterval) {
                clearInterval(this.state.timeUpdateInterval);
                this.state.timeUpdateInterval = null;
            }

            this.state.lastTrackData = data;
            this.state.lastUpdateTime = Date.now();
            this.updateUI(data);
        
            // Сбрасываем таймер обновления времени при смене трека
            if (this.state.timeUpdateInterval) {
                clearInterval(this.state.timeUpdateInterval);
            }
            
            // Запускаем новый интервал для обновления времени
            this.state.timeUpdateInterval = setInterval(
                () => this.updateCurrentTime(), 
                1000
            );
        }
        
        // Сбрасываем статус сети на хороший, если API доступен
        if (this.state.networkQuality !== 'good') {
            this.state.networkQuality = 'good';
            this.adjustForNetworkQuality();
            
            if (this.elements.networkQuality) {
                this.elements.networkQuality.textContent = 'Отличное';
            }
        }
    } catch (error) {
        console.error("Ошибка обновления:", error);
        
        // Используем кэшированные данные, если есть
        if (this.state.lastTrackData) {
            this.updateUI(this.state.lastTrackData);
        }
        
        // Обновляем статус сети на деградированный
        this.state.networkQuality = 'degraded';
        this.adjustForNetworkQuality();
        
        if (this.elements.networkQuality) {
            this.elements.networkQuality.textContent = 'Плохое';
        }
        
        // Пробуем найти новый рабочий API URL
        this.state.currentApiUrl = await this.findWorkingApi();
        this.setStatus("Проблемы с соединением, пытаемся восстановить...", true);
        this.updateStatusMessage("Проблемы с соединении, пытаемся восстановить...", true);
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

    // Запускаем обновление времени, если его еще нет
    if (!this.state.timeUpdateInterval && data.now_playing) {
        this.state.timeUpdateInterval = setInterval(
            () => this.updateCurrentTime(), 
            1000
        );
    }
}

updateCurrentTrack(nowPlaying) {
    const track = nowPlaying.song;
    const html = `
    <span class="track-name">${track.title || 'Неизвестный трек'}</span>
    <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
    <span class="track-progress">${UIHelpers.formatTime(nowPlaying.elapsed)} / ${UIHelpers.formatTime(nowPlaying.duration)}</span>
    `;

    if (this.elements.currentTrackEl) {
        this.elements.currentTrackEl.innerHTML = html;
    }

    if (this.elements.trackTitle) {
        this.elements.trackTitle.textContent = track.title || 'Неизвестный трек';
    }
    if (this.elements.trackArtist) {
        this.elements.trackArtist.textContent = track.artist || 'Неизвестный исполнитель';
    }
    if (this.elements.duration) {
        this.elements.duration.textContent = UIHelpers.formatTime(nowPlaying.duration);
    }

    // Обновляем заголовок страницы
    document.title = `${track.title} - ${track.artist} | АлгоРитм-StreAM`;

    // Обновляем обложку альбома
    this.updateAlbumArtFromAzuraCast(nowPlaying);

    // Очищаем предыдущий интервал, если он есть
    if (this.state.timeUpdateInterval) {
        clearInterval(this.state.timeUpdateInterval);
    }

    // Сбрасываем elapsed при смене трека
    nowPlaying.elapsed = 0;

    // Запускаем новый интервал
    this.state.timeUpdateInterval = setInterval(() => {
        nowPlaying.elapsed += 1;
        
        // Обновляем UI
        const progressElement = this.elements.currentTrackEl?.querySelector('.track-progress');
        if (progressElement) {
            progressElement.textContent = `${UIHelpers.formatTime(nowPlaying.elapsed)} / ${UIHelpers.formatTime(nowPlaying.duration)}`;
        }

        // Обновляем основной плеер
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = UIHelpers.formatTime(nowPlaying.elapsed);
        }
        if (this.elements.progressBar) {
            this.elements.progressBar.value = (nowPlaying.elapsed / nowPlaying.duration) * 100 || 0;
        }

        // Если трек закончился
        if (nowPlaying.elapsed >= nowPlaying.duration) {
            clearInterval(this.state.timeUpdateInterval);
            this.state.timeUpdateInterval = null;
        }
    }, 1000);
}

updateCurrentTime() {
    if (!this.state.lastTrackData?.now_playing) return;

    const nowPlaying = this.state.lastTrackData.now_playing;
    const elapsed = nowPlaying.elapsed + 1; // Увеличиваем на 1 секунду
    nowPlaying.elapsed = elapsed;

    // Обновляем время текущего трека
    if (this.elements.currentTime) {
        this.elements.currentTime.textContent = UIHelpers.formatTime(elapsed);
    }

    // Обновляем прогресс-бар
    if (this.elements.progressBar) {
        const progress = (elapsed / nowPlaying.duration) * 100;
        this.elements.progressBar.value = progress || 0;
    }

    // Обновляем время стрима (общее время воспроизведения)
    if (this.state.startTime && this.elements.streamDuration) {
        const streamTime = Math.floor((Date.now() - this.state.startTime) / 1000);
        this.elements.streamDuration.textContent = this.formatStreamTime(streamTime);
    }

    // Если трек закончился, сбрасываем время
    if (elapsed >= nowPlaying.duration) {
        nowPlaying.elapsed = 0;
    }
}
    
    updateAlbumArtFromAzuraCast(nowPlaying) {
        // Получаем URL обложки по умолчанию из конфига
        let artworkUrl = this.config.artwork.defaultUrl;
        
        // Проверяем возможные места, где AzuraCast может хранить обложку
        if (nowPlaying.song.art) {
            artworkUrl = nowPlaying.song.art;
        } else if (nowPlaying.song.image) {
            artworkUrl = nowPlaying.song.image;
        } else if (nowPlaying.song.album && nowPlaying.song.album.artwork_url) {
            artworkUrl = nowPlaying.song.album.artwork_url;
        }
        
        // Обрабатываем относительные URL
        if (artworkUrl && !artworkUrl.startsWith('http') && !artworkUrl.startsWith('/')) {
            artworkUrl = `${this.config.azuraCast.baseUrl}${artworkUrl}`;
        }
        
        // Добавляем параметр размера если это URL AzuraCast
        if (artworkUrl.includes(this.config.azuraCast.baseUrl)) {
            const separator = artworkUrl.includes('?') ? '&' : '?';
            artworkUrl = `${artworkUrl}${separator}size=${this.config.artwork.size}`;
        }
        
        // Используем прокси если настроено
        if (this.config.artwork.useProxy && this.config.artwork.proxyUrl) {
            artworkUrl = `${this.config.artwork.proxyUrl}?url=${encodeURIComponent(artworkUrl)}`;
        }
        
        this.updateAlbumArt(artworkUrl);
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
        }, 300);
    }
    
    updateNextTrack(playingNext) {
        const track = playingNext.song;
        const html = `
        <span class="track-title">${track.title || 'Неизвестный трек'}</span>
        <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
        <span class="track-time">${UIHelpers.formatTime(playingNext.duration || 0)}</span>
        `;

        if (this.elements.nextTrackEl) this.elements.nextTrackEl.innerHTML = html;
    }

    updateHistory(history) {
        if (!this.elements.historyList || !history) return;

        const fragment = document.createDocumentFragment();
        const recentTracks = history.slice(0, this.config.history.maxItems); // Ограничиваем количество треков

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
    
    updateStatusMessage(message, isError = false) {
        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = message;
            this.elements.statusMessage.className = isError ? 'status-message error' : 'status-message';
        }
    }
    
    updateConnectionProgress(percentage) {
        if (this.elements.connectionProgress) {
            this.elements.connectionProgress.style.width = `${percentage}%`;
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

isTrackChanged(newTrack, oldTrack) {
    if (!oldTrack) return true;
    return (
        newTrack.song?.title !== oldTrack.song?.title ||
        newTrack.song?.artist !== oldTrack.song?.artist
    );
}
    
handleConnectionError(error) {
    console.error("Ошибка подключения:", error);
    this.setStatus(`Ошибка: ${error.message}`, true);
    this.updateStatusMessage(`Ошибка: ${error.message}`, true);

    // Сбрасываем состояние аудио
    this.elements.audio.src = '';
    this.elements.audio.load();
    this.state.isPlaying = false;
    this.state.currentStream = null; // Сбрасываем текущий поток

    // Увеличиваем счетчик попыток переподключения
    this.state.retryCount++;
    if (this.elements.retryCount) {
        this.elements.retryCount.textContent = this.state.retryCount;
    }

    // Экспоненциальная задержка с максимальным ограничением
    const delay = Math.min(3000 * Math.pow(2, this.state.retryCount), 30000);
    
    setTimeout(async () => {
        try {
            // Сначала находим новый рабочий поток
            this.state.currentStream = await this.findWorkingStream();
            // Затем пробуем подключиться
            await this.connectToStream();
        } catch (err) {
            console.error("Ошибка при повторном подключении:", err);
        }
    }, delay);

    document.getElementById('audio-overlay').style.display = 'flex';
}

    handleNetworkIssue() {
        if (this.state.networkQuality === 'good') {
            this.state.networkQuality = 'degraded';
            this.state.diagnostics.qualityChanges++;
            this.adjustForNetworkQuality();
            
            if (this.elements.networkQuality) {
                this.elements.networkQuality.textContent = 'Плохое';
            }
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
                    1000 // Проверяем каждую секунду, но обновляем только при изменении трека
                );
        }
    }

handleBackgroundTab() {
    // Не приостанавливаем AudioContext - оставляем воспроизведение
    // Только уменьшаем частоту обновлений информации
    clearInterval(this.state.updateIntervalId);
    this.state.updateIntervalId = setInterval(
        () => this.updateTrackInfo(),
        this.config.updateInterval * 3 // Реже обновляем в фоне
    );
    
    console.log('Приложение перешло в фоновый режим (воспроизведение продолжается)');
}

handleForegroundTab() {
    // Восстанавливаем частоту обновлений
    clearInterval(this.state.updateIntervalId);
    this.state.updateIntervalId = setInterval(
        () => this.updateTrackInfo(),
        this.config.updateInterval
    );

    // Проверяем состояние воспроизведения
    if (this.state.isPlaying) {
        // Пробуем возобновить, если было прервано
        this.elements.audio.play().catch(err => {
            console.warn('Автовоспроизведение в foreground:', err);
            // Показываем кнопку "Продолжить", если нужно действие пользователя
            if (err.name === 'NotAllowedError') {
                this.showResumeButton();
            }
        });
    }
    
    console.log('Приложение вернулось на передний план');
}

    initAudioContext() {
        try {
            this.state.audioContext = AudioController.initAudioContext();
            if (this.state.audioContext) {
                this.setupAudioBuffer();
            }
        } catch (error) {
            console.error("Ошибка инициализации AudioContext:", error);
        }
    }

setupAudioBuffer() {
    if (!this.state.audioContext) return;

    // Отключаем предыдущий анализатор, если есть
    if (this.state.analyser) {
        this.state.analyser.disconnect();
    }

    const analyser = AudioController.createAnalyser(
        this.state.audioContext,
        this.elements.audio
    );

    if (analyser) {
        this.state.analyser = analyser;
    }
}
    
    startUptimeCounter() {
        this.state.startTime = Date.now();
        
        setInterval(() => {
            if (!this.state.startTime || !this.elements.uptime) return;
            
            const uptime = Math.floor((Date.now() - this.state.startTime) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            this.elements.uptime.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
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



    destroy() {
        if (this.state.updateIntervalId) {
            clearInterval(this.state.updateIntervalId);
        }
        if (this.state.timeUpdateInterval) {
            clearInterval(this.state.timeUpdateInterval);
        }
        if (this.state.streamTimeInterval) {
            clearInterval(this.state.streamTimeInterval);
        }
        if (this.bufferMonitorInterval) {
            clearInterval(this.bufferMonitorInterval);
        }
    }
}
