import RadioPlayerConfig from './config.js';
import { NetworkUtils } from './network-utils.js';
import { UIHelpers } from './ui-helpers.js';
import { AudioController } from './audio-controller.js';

export class RadioPlayer {
    constructor() {
        const requiredElements = ['radio-stream', 'stream-status', 'volume-slider', 'audio-overlay', 'start-playback', 'track-title', 'track-artist', 'duration', 'current-time', 'progress-bar', 'loader', 'loadingStatus', 'network-quality', 'retry-count', 'uptime', 'status-message', 'connection-progress', 'current-track', 'next-track', 'history-list', 'listeners-count', 'volume-btn'];
        for (const id of requiredElements) {
            if (!document.getElementById(id)) {
                console.error(`Не найден необходимый элемент DOM: #${id}`);
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
            duration: document.getElementById('duration'),
            loader: document.getElementById('loader'),
            loadingStatus: document.getElementById('loadingStatus'),
            networkQuality: document.getElementById('network-quality'),
            retryCount: document.getElementById('retry-count'),
            uptime: document.getElementById('uptime'),
            statusMessage: document.getElementById('status-message'),
            connectionProgress: document.getElementById('connection-progress'),
            audioOverlay: document.getElementById('audio-overlay'),
            startPlaybackBtn: document.getElementById('start-playback'),
            startPlaybackBtnText: document.getElementById('start-playback')?.querySelector('.button-text'),
            startPlaybackBtnSpinner: document.getElementById('start-playback')?.querySelector('.loading-spinner')
        };

        if (!this.elements.audio || !this.elements.statusEl || !this.elements.volumeSlider || !this.elements.audioOverlay || !this.elements.startPlaybackBtn) {
            console.error("Не удалось получить все необходимые DOM элементы. Инициализация плеера будет ограничена.");
            if(this.elements.loadingStatus) this.elements.loadingStatus.textContent = 'Критическая ошибка DOM. Плеер не загружен.';
            if(this.elements.startPlaybackBtnText) this.elements.startPlaybackBtnText.textContent = 'Ошибка';
            if(this.elements.startPlaybackBtn) this.elements.startPlaybackBtn.disabled = true;
            return;
        }

        this.abortController = new AbortController();
        this.config = RadioPlayerConfig;

        this.state = {
            currentStream: null,
            currentApiUrl: null,
            currentTrackStartTime: 0, // Время начала текущего трека (timestamp)
            currentTrackDuration: 0,   // Длительность текущего трека в секундах
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
            },
            isInitialized: false
        };

        this.elements.audio.autoplay = false;
    }

    async init() {
        if (this.state.isInitialized) {
            console.warn("Player already initialized.");
            return;
        }

        try {
            this.setOverlayLoadingState("Инициализация плеера...");
            this.setStatus("Инициализация...", false);
            this.updateStatusMessage("Инициализация плеера...");
            this.updateConnectionProgress(10);

            this.setupEventListeners();
            this.initAudioContext();
            this.updateVolumePercentage();

            this.updateConnectionProgress(30);

            await this.updateTrackInfo();

            this.startTrackTimeUpdater();

            try {
                this.state.currentStream = await this.findWorkingStream();
                if (!this.state.currentStream) {
                    throw new Error("Не удалось найти рабочий поток");
                }
                this.updateConnectionProgress(60);
            } catch (streamError) {
                console.error("Failed to find a working stream:", streamError);
                throw new Error("Потоки недоступны");
            }

            try {
                this.state.currentApiUrl = await this.findWorkingApi();
                if (!this.state.currentApiUrl) {
                    console.warn("Не удалось найти рабочий API endpoint. Функционал может быть ограничен.");
                }
                this.updateConnectionProgress(80);
            } catch (apiError) {
                console.warn("Failed to find a working API:", apiError);
            }

            this.startUptimeCounter();
            this.startDiagnostics();

            if (this.state.currentApiUrl) {
                await this.updateTrackInfo().catch(e => console.warn("Initial track info fetch failed:", e));
            } else {
                this.updateUI({
                    now_playing: { song: { title: 'Радио', artist: 'Offline Mode' }, elapsed: 0, duration: 0 },
                    playing_next: null,
                    song_history: [],
                    listeners: { current: 0 }
                });
            }

            if (this.state.currentApiUrl) {
                this.state.updateIntervalId = setInterval(
                    () => this.updateTrackInfo(),
                                                          this.config.updateInterval
                );
            }

            this.state.isInitialized = true;

            this.setOverlayReadyState();

            this.setStatus("Готов к воспроизведению");
            this.updateStatusMessage("Готов к воспроизведению");
            this.updateConnectionProgress(100);

            console.log('Player initialized successfully.');

            if (this.config.useSongChangeDetection) {
                this.setupSongChangeDetection();
            }

        } catch (error) {
            console.error("Ошибка инициализации плеера:", error);
            this.state.isInitialized = false;
            this.setOverlayErrorState(error.message);
            this.setStatus("Ошибка: " + error.message, true);
            this.updateStatusMessage("Ошибка: " + error.message, true);
            this.updateConnectionProgress(0);
        }
    }

    setupSongChangeDetection() {
        // Проверяем изменения каждую секунду (можно настроить)
        this.state.songCheckInterval = setInterval(() => {
            const audio = this.elements.audio;
            if (!audio) return;

            // Если трек закончился или произошло значительное изменение времени
            if (audio.currentTime >= audio.duration - 1 ||
                Math.abs(audio.currentTime - this.state.lastAudioTime) > 5) {
                this.updateTrackInfo();
                }

                this.state.lastAudioTime = audio.currentTime;
        }, 1000);
    }


    setupEventListeners() {
        const self = this;

        if (this.elements.volumeBtn) {
            this.elements.volumeBtn.addEventListener('click', () => {
                if (self.elements.audio) {
                    self.elements.audio.muted = !self.elements.audio.muted;
                    self.updateVolumeIcon();
                    localStorage.setItem('radioMuted', self.elements.audio.muted ? 'true' : 'false');
                }
            });
        }

        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.addEventListener('input', (e) => {
                if (self.elements.audio) {
                    self.elements.audio.volume = e.target.value;
                    if (self.elements.audio.muted && e.target.value > 0) {
                        self.elements.audio.muted = false;
                    }
                    self.updateVolumeIcon();
                    self.updateVolumePercentage();
                    localStorage.setItem('radioVolume', e.target.value);
                    localStorage.setItem('radioMuted', self.elements.audio.muted ? 'true' : 'false');
                }
            });
        }

        if (this.elements.audio && this.elements.volumeSlider) {
            const savedVolume = localStorage.getItem('radioVolume');
            if (savedVolume !== null) {
                const volume = parseFloat(savedVolume);
                this.elements.audio.volume = volume;
                this.elements.volumeSlider.value = volume;
            }
            const savedMuted = localStorage.getItem('radioMuted');
            if (savedMuted !== null) {
                this.elements.audio.muted = savedMuted === 'true';
                if (this.elements.audio.muted && this.elements.audio.volume > 0) {
                    // ok
                } else if (savedMuted === 'false' && this.elements.audio.volume === 0) {
                    this.elements.audio.muted = true;
                }
            }
            this.updateVolumeIcon();
            this.updateVolumePercentage();
        }

        if (this.elements.audio) {
            this.elements.audio.addEventListener('error', (e) => {
                console.error("Audio error:", e);
                const error = e.target.error;
                let errorMessage = "Неизвестная ошибка аудио";
                switch (error.code) {
                    case MediaError.MEDIA_ERR_ABORTED:
                        errorMessage = "Воспроизведение прервано пользователем.";
                        break;
                    case MediaError.MEDIA_ERR_NETWORK:
                        errorMessage = "Сетевая ошибка.";
                        this.handleConnectionError(new Error(errorMessage));
                        return;
                    case MediaError.MEDIA_ERR_DECODE:
                        errorMessage = "Ошибка декодирования аудио.";
                        this.handleConnectionError(new Error(errorMessage));
                        return;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = "Источник аудио не поддерживается.";
                        break;
                    default:
                        errorMessage = `Ошибка аудио (${error.code}).`;
                }

                this.setStatus(`Ошибка: ${errorMessage}`, true);
                this.updateStatusMessage(`Ошибка: ${errorMessage}`, true);
                this.state.diagnostics.connectionErrors++;
                this.state.diagnostics.lastError = new Error(errorMessage);
            });

            this.elements.audio.addEventListener('stalled', () => {
                console.warn("Audio stalled.");
                this.handleNetworkIssue();
                this.updateStatusMessage("Буферизация...");
                if (this.elements.loader) this.elements.loader.style.display = 'block';
            });

                this.elements.audio.addEventListener('waiting', () => {
                    console.warn("Audio waiting.");
                    this.state.diagnostics.bufferingEvents++;
                    this.handleNetworkIssue();
                    this.updateStatusMessage("Буферизация...");
                    if (this.elements.loader) this.elements.loader.style.display = 'block';
                });

                    this.elements.audio.addEventListener('playing', () => {
                        console.log("Audio playing.");
                        this.updateStatusMessage("Воспроизведение");
                        if (this.elements.loader) this.elements.loader.style.display = 'none';

                        if (!this.state.startTime || !this.state.isPlaying) {
                            this.state.startTime = Date.now();
                        }
                        this.state.isPlaying = true;
                        if(this.elements.audioOverlay && this.elements.audioOverlay.style.display !== 'none') {
                            this.elements.audioOverlay.style.display = 'none';
                        }
                    });

                    this.elements.audio.addEventListener('pause', () => {
                        console.log("Audio paused.");
                        this.updateStatusMessage("Пауза");
                        this.state.isPlaying = false;
                    });

                    this.elements.audio.addEventListener('timeupdate', () => {
                        if (this.elements.currentTime && this.elements.progressBar && !isNaN(this.elements.audio.duration)) {
                            this.elements.currentTime.textContent = UIHelpers.formatTime(this.elements.audio.currentTime);
                            const progress = (this.elements.audio.currentTime / this.elements.audio.duration) * 100;
                            this.elements.progressBar.value = Math.max(0, Math.min(100, progress)) || 0;
                        } else {
                            if (this.elements.currentTime) this.elements.currentTime.textContent = '--:--';
                            if (this.elements.duration) this.elements.duration.textContent = '--:--';
                            if (this.elements.progressBar) this.elements.progressBar.value = 0;
                        }
                    });

                    this.elements.audio.addEventListener('durationchange', () => {
                        if (this.elements.duration && !isNaN(this.elements.audio.duration) && this.elements.audio.duration !== Infinity) {
                            this.elements.duration.textContent = UIHelpers.formatTime(this.elements.audio.duration);
                        } else if (this.elements.duration) {
                            this.elements.duration.textContent = '--:--';
                        }
                    });
        }

const handleFirstInteraction = async () => {
    if (self.state.audioContext && self.state.audioContext.state === 'suspended') {
        await self.state.audioContext.resume();
    }
    document.removeEventListener('click', handleFirstInteraction);
};
document.addEventListener('click', handleFirstInteraction);
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleBackgroundTab();
            } else {
                this.handleForegroundTab();
            }
        });

        if (this.elements.progressBar && this.elements.audio) {
            this.elements.progressBar.addEventListener('change', (e) => {
                if (!isNaN(this.elements.audio.duration) && this.elements.audio.duration !== Infinity) {
                    const seekTime = (e.target.value / 100) * this.elements.audio.duration;
                    this.elements.audio.currentTime = seekTime;
                }
            });
            this.elements.progressBar.addEventListener('mousedown', () => {
                const tooltip = document.getElementById('progress-tooltip');
                if(tooltip) tooltip.style.opacity = '0';
            });
        }
    }

    updateVolumeIcon() {
        if (!this.elements.volumeBtn || !this.elements.audio) return;
        UIHelpers.updateVolumeIcon(this.elements.volumeBtn, this.elements.audio.volume, this.elements.audio.muted);
    }

    updateVolumePercentage() {
        if (!this.elements.volumeSlider) return;
        this.elements.volumePercentage = document.getElementById('volume-percentage');
        if (!this.elements.volumePercentage) return;
        this.elements.volumePercentage.textContent = `${Math.round(this.elements.volumeSlider.value * 100)}%`;
    }

    async connectToStream(maxRetries = 3) {
        if (!this.state.currentStream?.url) {
            console.error("Attempted to connect without a valid stream URL.");
            try {
                this.state.currentStream = await this.findWorkingStream();
                if (!this.state.currentStream?.url) {
                    throw new Error("No working stream found after retry.");
                }
            } catch(e) {
                console.error("Failed to find a stream before connection attempt:", e);
                this.handleConnectionError(e);
                return false;
            }
        }

        console.log(`Connecting to stream: ${this.state.currentStream.url}`);
        this.setStatus("Подключение...", false);
        this.updateStatusMessage("Подключение к потоку...");
        this.updateConnectionProgress(20);

        try {
            if (!this.elements.audio) {
                throw new Error("Audio element not found.");
            }

            this.abortController?.abort();
            this.abortController = new AbortController();

            this.elements.audio.crossOrigin = 'anonymous';
            this.elements.audio.preload = 'auto';

            await this.loadAudioWithTimeout(this.state.currentStream.url, 15000);

            console.log("Stream connected.");
            this.setStatus("Соединение установлено", false);
            this.updateStatusMessage("Соединение установлено");
            this.updateConnectionProgress(100);
            this.state.retryCount = 0;
            if (this.elements.retryCount) this.elements.retryCount.textContent = this.state.retryCount;
            return true;
        } catch (loadError) {
            console.error("Ошибка загрузки аудио:", loadError);
            if (maxRetries > 0) {
                return this.connectToStream(maxRetries - 1);
            }
            this.handleConnectionError(loadError);
            return false;
        }
    }

    async loadAudioWithTimeout(url, timeout) {
        return new Promise((resolve, reject) => {
            this.elements.audio.crossOrigin = 'anonymous';
            this.elements.audio.preload = 'auto';

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

            this.elements.audio.src = url;
            this.elements.audio.load();
        });
    }

    async findWorkingStream() {
        const sortedStreams = [...this.config.streams].sort((a, b) => a.priority - b.priority);

        for (const stream of sortedStreams) {
            try {
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
    try {
        if (this.state.isPlaying) {
            // Если уже играет - ставим на паузу
            this.elements.audio.pause();
            this.state.isPlaying = false;
            this.updateStatusMessage("Пауза");
            return;
        }

        // Если не играет - запускаем воспроизведение
        
        // 1. Проверяем подключение к потоку
        if (!this.state.currentStream) {
            await this.connectToStream();
        }

        // 2. Активируем AudioContext при необходимости
        if (!this.state.audioContext) {
            this.initAudioContext();
        } else if (this.state.audioContext.state === 'suspended') {
            await this.state.audioContext.resume();
        }

        // 3. Добавляем защиту от ошибок воспроизведения
        let playbackAttempts = 0;
        const maxAttempts = 3;
        
        while (playbackAttempts < maxAttempts) {
            try {
                await new Promise(resolve => setTimeout(resolve, 100 * (playbackAttempts + 1)));
                await this.elements.audio.play();
                
                this.state.isPlaying = true;
                this.updateStatusMessage("Воспроизведение");
                return;
            } catch (playError) {
                playbackAttempts++;
                console.warn(`Попытка воспроизведения ${playbackAttempts} не удалась:`, playError);
                
                if (playbackAttempts >= maxAttempts) {
                    throw playError;
                }
                
                // При NotAllowedError пробуем восстановить контекст
                if (playError.name === 'NotAllowedError' && this.state.audioContext) {
                    await this.state.audioContext.resume();
                }
            }
        }
    } catch (error) {
        console.error("Ошибка переключения воспроизведения:", error);
        this.state.isPlaying = false;
        
        // Специальная обработка для NotAllowedError
        if (error.name === 'NotAllowedError') {
            this.updateStatusMessage("Нажмите разрешить воспроизведение", true);
            throw new Error("Требуется взаимодействие пользователя для воспроизведения");
        }
        
        // Для других ошибок пробуем переподключиться
        this.state.currentStream = null;
        throw error;
    }
}

    async loadAudioSource(url) {
        this.elements.audio.src = '';
        await new Promise(resolve => setTimeout(resolve, 50));
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

            // Проверяем, изменился ли текущий трек
            const currentSongId = data.now_playing?.song?.id;
            const lastSongId = this.state.lastTrackData?.now_playing?.song?.id;

            // Если трек изменился или это первое обновление
            if (currentSongId !== lastSongId || !this.state.lastTrackData) {
                this.state.lastTrackData = data;
                this.state.lastUpdateTime = Date.now();
                this.updateUI(data);

                // Сбрасываем статус сети на хороший, если API доступен
                if (this.state.networkQuality !== 'good') {
                    this.state.networkQuality = 'good';
                    this.adjustForNetworkQuality();

                    if (this.elements.networkQuality) {
                        this.elements.networkQuality.textContent = 'Отличное';
                    }
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
            this.updateStatusMessage("Проблемы с соединением, пытаемся восстановить...", true);
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
        const track = nowPlaying.song;

        // Сохраняем длительность трека
        this.state.currentTrackDuration = nowPlaying.duration || 0;

        // Если это новый трек (ID изменился), обновляем время начала
        const currentSongId = track.id;
        const lastSongId = this.state.lastTrackData?.now_playing?.song?.id;
        if (currentSongId !== lastSongId) {
            this.state.currentTrackStartTime = Date.now() - (nowPlaying.elapsed * 1000 || 0);
        }

        // Рассчитываем текущее время проигрывания
        const elapsed = nowPlaying.elapsed ||
        ((Date.now() - this.state.currentTrackStartTime) / 1000);
        const duration = nowPlaying.duration || this.state.currentTrackDuration;

        const html = `
        <span class="track-name">${track.title || 'Неизвестный трек'}</span>
        <span class="track-artist">${track.artist || 'Неизвестный исполнитель'}</span>
        <span class="track-progress">${UIHelpers.formatTime(elapsed)} / ${UIHelpers.formatTime(duration)}</span>
        `;

        if (this.elements.currentTrackEl) this.elements.currentTrackEl.innerHTML = html;

        if (this.elements.trackTitle) {
            this.elements.trackTitle.textContent = track.title || 'Неизвестный трек';
        }
        if (this.elements.trackArtist) {
            this.elements.trackArtist.textContent = track.artist || 'Неизвестный исполнитель';
        }
        if (this.elements.duration) {
            this.elements.duration.textContent = UIHelpers.formatTime(duration);
        }

        // Обновляем заголовок страницы
        document.title = `${track.title} - ${track.artist} | АлгоРитм-StreAM`;

        // Обновляем обложку альбома из AzuraCast
        this.updateAlbumArtFromAzuraCast(nowPlaying);
    }

    updateAlbumArtFromAzuraCast(nowPlaying) {
        let artworkUrl = this.config.artwork.defaultUrl;

        if (nowPlaying.song.art) {
            artworkUrl = nowPlaying.song.art;
        } else if (nowPlaying.song.image) {
            artworkUrl = nowPlaying.song.image;
        } else if (nowPlaying.song.album && nowPlaying.song.album.artwork_url) {
            artworkUrl = nowPlaying.song.album.artwork_url;
        }

        if (artworkUrl && !artworkUrl.startsWith('http') && !artworkUrl.startsWith('/')) {
            artworkUrl = `${this.config.azuraCast.baseUrl}${artworkUrl}`;
        }

        if (artworkUrl.includes(this.config.azuraCast.baseUrl)) {
            const separator = artworkUrl.includes('?') ? '&' : '?';
            artworkUrl = `${artworkUrl}${separator}size=${this.config.artwork.size}`;
        }

        if (this.config.artwork.useProxy && this.config.artwork.proxyUrl) {
            artworkUrl = `${this.config.artwork.proxyUrl}?url=${encodeURIComponent(artworkUrl)}`;
        }

        this.updateAlbumArt(artworkUrl);
    }

    updateAlbumArt(imageUrl) {
        const albumCover = document.querySelector('.album-cover');
        if (!albumCover) return;

        if (!imageUrl || typeof imageUrl !== 'string') {
            imageUrl = this.config.artwork.defaultUrl;
        }

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
        const recentTracks = history.slice(0, this.config.history.maxItems);

        recentTracks.forEach((item, index) => {
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
        const statusEl = this.elements.statusEl;
        if (!statusEl) return;

        statusEl.classList.add('show');

        if (isError) {
            statusEl.className = 'status-error show';
            statusEl.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span class="status-text">${text}</span>
            `;
        } else {
            statusEl.className = 'status-success show';
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
            if (!this.config.apiUrls || !Array.isArray(this.config.apiUrls)) {
                console.warn('apiUrls not configured, using primary endpoint');
                return this.config.apiEndpoints.primary || this.config.apiEndpoints.nowPlaying;
            }

            const workingUrl = await NetworkUtils.findWorkingUrl(this.config.apiUrls);

            if (workingUrl) {
                return workingUrl;
            }

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
        this.updateStatusMessage(`Ошибка: ${error.message}`, true);

        this.elements.audio.src = '';
        this.elements.audio.load();
        this.state.isPlaying = false;
        this.state.currentStream = null;

        this.state.retryCount++;
        if (this.elements.retryCount) {
            this.elements.retryCount.textContent = this.state.retryCount;
        }

        if (this.state.trackTimeUpdater) {
            clearInterval(this.state.trackTimeUpdater);
        }

        const delay = Math.min(3000 * Math.pow(2, this.state.retryCount), 30000);

        clearInterval(this.state.songCheckInterval);

        setTimeout(async () => {
            try {
                this.state.currentStream = await this.findWorkingStream();
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
                                                          this.config.updateInterval
                );
        }
    }

handleBackgroundTab() {
    // Не приостанавливаем AudioContext, только уменьшаем частоту обновлений
    clearInterval(this.state.updateIntervalId);
    this.state.updateIntervalId = setInterval(
        () => this.updateTrackInfo(),
        this.config.updateInterval * 3
    );
}

handleForegroundTab() {
    if (this.state.audioContext && this.state.audioContext.state === 'suspended') {
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

    startTrackTimeUpdater() {
        // Очищаем предыдущий интервал, если он был
        if (this.state.trackTimeUpdater) {
            clearInterval(this.state.trackTimeUpdater);
        }

        // Запускаем новый интервал обновления времени
        this.state.trackTimeUpdater = setInterval(() => {
            if (this.state.currentTrackStartTime && this.state.currentTrackDuration > 0) {
                const elapsed = (Date.now() - this.state.currentTrackStartTime) / 1000;

                // Обновляем только если трек еще не закончился
                if (elapsed < this.state.currentTrackDuration) {
                    const progressElement = this.elements.currentTrackEl?.querySelector('.track-progress');
                    if (progressElement) {
                        progressElement.textContent =
                        `${UIHelpers.formatTime(elapsed)} / ${UIHelpers.formatTime(this.state.currentTrackDuration)}`;
                    }

                    // Также обновляем элемент currentTime, если он есть
                    if (this.elements.currentTime) {
                        this.elements.currentTime.textContent = UIHelpers.formatTime(elapsed);
                    }
                }
            }
        }, 1000); // Обновляем каждую секунду
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

    setOverlayLoadingState(message) {
        this.elements.startPlaybackBtnText.textContent = message;
        this.elements.startPlaybackBtnSpinner.style.display = 'block';
        this.elements.startPlaybackBtnText.style.display = 'none';
    }

    setOverlayErrorState(message) {
        this.elements.startPlaybackBtnText.textContent = message;
        this.elements.startPlaybackBtnSpinner.style.display = 'none';
        this.elements.startPlaybackBtnText.style.display = 'block';
        this.elements.startPlaybackBtnText.style.color = 'red';
    }

    setOverlayReadyState() {
        this.elements.startPlaybackBtnText.textContent = 'Начать воспроизведение';
        this.elements.startPlaybackBtnSpinner.style.display = 'none';
        this.elements.startPlaybackBtnText.style.display = 'block';
        this.elements.startPlaybackBtnText.style.color = '';
    }
}
