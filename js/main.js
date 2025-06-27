// Main Application JavaScript
class AlgoRitmApp {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.currentTab = 'discover';
        this.isLoading = true;
        this.player = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Show loading screen
            this.showLoadingScreen();
            
            // Initialize theme
            this.initializeTheme();
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Hide loading screen
            setTimeout(() => {
                this.hideLoadingScreen();
            }, 2000);
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.handleInitError(error);
        }
    }
    
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            
            // Animate loading text
            const statusElement = loadingScreen.querySelector('.loading-status');
            const statuses = [
                'Инициализация аудио движка...',
                'Загрузка ваших предпочтений...',
                'Подключение к потокам...',
                'Готово к року! 🎵'
            ];
            
            let currentStatus = 0;
            const statusInterval = setInterval(() => {
                if (statusElement && currentStatus < statuses.length) {
                    statusElement.textContent = statuses[currentStatus];
                    currentStatus++;
                } else {
                    clearInterval(statusInterval);
                }
            }, 500);
        }
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                this.isLoading = false;
            }, 500);
        }
    }
    
    initializeTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        // Update theme toggle button
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            this.updateThemeToggle();
        }
    }
    
    async initializeComponents() {
        // Initialize audio player
        if (typeof AudioPlayer !== 'undefined') {
            this.player = new AudioPlayer();
            await this.player.initialize();
        } else if(typeof RadioPlayer !== 'undefined') {
            // Fallback for the other player class if it exists
            this.player = new RadioPlayer();
            await this.player.init().catch(err => {
                console.error("Ошибка инициализации RadioPlayer:", err);
                this.handleInitError(err);
                throw err; // Re-throw to stop execution if player is critical
            });
        }
        
        // Initialize other components
        this.initializeNavigation();
        this.initializeSearch();
        this.initializeMusicCards();
        this.initializePlayer();
    }
    
    initializeNavigation() {
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }
    
    initializeSearch() {
        const searchInput = document.querySelector('.search-input');
        const searchButton = document.querySelector('.search-button');
        
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.performSearch(e.target.value);
                }, 300);
            });
            
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.performSearch(e.target.value);
                }
            });
        }
        
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                const query = searchInput?.value || '';
                this.performSearch(query);
            });
        }
    }
    
    initializeMusicCards() {
        // Add event listeners to music cards
        document.addEventListener('click', (e) => {
            const musicCard = e.target.closest('.music-card');
            const playButton = e.target.closest('.play-button');
            
            if (playButton && musicCard) {
                e.preventDefault();
                e.stopPropagation();
                this.playTrack(musicCard.dataset.trackId);
            } else if (musicCard) {
                this.showTrackDetails(musicCard.dataset.trackId);
            }
        });
    }
    
    initializePlayer() {
        const playerContainer = document.querySelector('.player-container');
        
        // Player control buttons
        const playPauseBtn = document.querySelector('.play-pause');
        const prevBtn = document.querySelector('.previous');
        const nextBtn = document.querySelector('.next');
        const shuffleBtn = document.querySelector('.shuffle');
        const repeatBtn = document.querySelector('.repeat');
        const favoriteBtn = document.querySelector('.track-favorite');
        
        // Player controls
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousTrack());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextTrack());
        }
        
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        }
        
        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => this.toggleRepeat());
        }
        
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', () => this.toggleFavorite());
        }
        
        // Progress bar
        this.initializeProgressBar();
        
        // Volume control
        this.initializeVolumeControl();
    }
    
    initializeProgressBar() {
        const progressBar = document.querySelector('.progress-bar');
        const progressFill = document.querySelector('.progress-fill');
        const progressHandle = document.querySelector('.progress-handle');
        
        if (progressBar) {
            let isDragging = false;
            
            const updateProgress = (e) => {
                const rect = progressBar.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                
                if (progressFill) {
                    progressFill.style.width = `${percentage * 100}%`;
                }
                
                if (this.player) {
                    this.player.seekTo(percentage);
                }
            };
            
            progressBar.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateProgress(e);
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updateProgress(e);
                }
            });
            
            document.addEventListener('mouseup', () => {
                isDragging = false;
            });
        }
    }
    
    initializeVolumeControl() {
        const volumeSlider = document.querySelector('.volume-slider');
        const volumeFill = document.querySelector('.volume-fill');
        const volumeBtn = document.querySelector('.volume-btn');
        
        if (volumeSlider) {
            let isDragging = false;
            
            const updateVolume = (e) => {
                const rect = volumeSlider.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                
                if (volumeFill) {
                    volumeFill.style.width = `${percentage * 100}%`;
                }
                
                if (this.player) {
                    this.player.setVolume(percentage);
                }
                
                this.updateVolumeIcon(percentage);
            };
            
            volumeSlider.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateVolume(e);
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updateVolume(e);
                }
            });
            
            document.addEventListener('mouseup', () => {
                isDragging = false;
            });
        }
        
        if (volumeBtn) {
            volumeBtn.addEventListener('click', () => {
                this.toggleMute();
            });
        }
    }
    
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'ArrowLeft':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.previousTrack();
                    }
                    break;
                case 'ArrowRight':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.nextTrack();
                    }
                    break;
                case 'ArrowUp':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.increaseVolume();
                    }
                    break;
                case 'ArrowDown':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.decreaseVolume();
                    }
                    break;
            }
        });
    }
    
    async loadInitialData() {
        try {
            // Load trending tracks
            await this.loadTrendingTracks();
            
            // Load user library
            await this.loadUserLibrary();
            
            // Load radio stations
            await this.loadRadioStations();
            
            // Load recommendations
            await this.loadRecommendations();
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }
    
    async loadTrendingTracks() {
        const musicGrid = document.querySelector('.music-grid');
        if (!musicGrid) return;
        
        // Mock data - replace with actual API calls
        const mockTracks = [
            {
                id: '1',
                title: 'Цифровые Горизонты',
                artist: 'Синтетический Оркестр',
                plays: '2.1M',
                duration: '3:42',
                artwork: 'gradient-1'
            },
            {
                id: '2',
                title: 'Нейронные Пути',
                artist: 'ИИ Композитор',
                plays: '1.8M',
                duration: '4:15',
                artwork: 'gradient-2'
            },
            {
                id: '3',
                title: 'Квантовые Ритмы',
                artist: 'Алгоритм X',
                plays: '3.2M',
                duration: '2:58',
                artwork: 'gradient-3'
            }
        ];
        
        musicGrid.innerHTML = mockTracks.map(track => `
            <div class="music-card" data-track-id="${track.id}">
                <div class="card-artwork ${track.artwork}">
                    <div class="play-overlay">
                        <button class="play-button">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <polygon points="5,3 19,12 5,21" fill="currentColor"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="card-info">
                    <h3 class="card-title">${track.title}</h3>
                    <p class="card-artist">${track.artist}</p>
                    <div class="card-stats">
                        <span class="plays">${track.plays} прослушиваний</span>
                        <span class="duration">${track.duration}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    async loadUserLibrary() {
        // Implementation for loading user library
        console.log('Загрузка библиотеки пользователя...');
    }
    
    async loadRadioStations() {
        // Implementation for loading radio stations
        console.log('Загрузка радиостанций...');
    }
    
    async loadRecommendations() {
        // Implementation for loading AI recommendations
        console.log('Загрузка рекомендаций...');
    }
    
    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected tab
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Update nav buttons
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        this.currentTab = tabName;
    }
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
        this.updateThemeToggle();
    }
    
    updateThemeToggle() {
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            // Theme icons are handled by CSS
        }
    }
    
    performSearch(query) {
        console.log('Поиск:', query);
        // Implement search functionality
    }
    
    playTrack(trackId) {
        console.log('Воспроизведение трека:', trackId);
        
        // Show player
        const playerContainer = document.querySelector('.player-container');
        if (playerContainer) {
            playerContainer.classList.add('active');
        }
        
        // Update player UI
        this.updatePlayerUI(trackId);
        
        // Start playback
        if (this.player) {
            this.player.play(trackId);
        }
    }
    
    updatePlayerUI(trackId) {
        // Mock track data - replace with actual data
        const trackData = {
            title: 'Цифровые Горизонты',
            artist: 'Синтетический Оркестр',
            artwork: 'gradient-1'
        };
        
        const trackTitle = document.querySelector('.track-title');
        const trackArtist = document.querySelector('.track-artist');
        
        if (trackTitle) trackTitle.textContent = trackData.title;
        if (trackArtist) trackArtist.textContent = trackData.artist;
    }
    
    togglePlayPause() {
        const playPauseBtn = document.querySelector('.play-pause');
        if (playPauseBtn) {
            const isPlaying = playPauseBtn.classList.contains('playing');
            
            if (isPlaying) {
                playPauseBtn.classList.remove('playing');
                if (this.player) this.player.pause();
            } else {
                playPauseBtn.classList.add('playing');
                if (this.player) this.player.play();
            }
        }
    }
    
    previousTrack() {
        if (this.player) this.player.previous();
    }
    
    nextTrack() {
        if (this.player) this.player.next();
    }
    
    toggleShuffle() {
        const shuffleBtn = document.querySelector('.shuffle');
        if (shuffleBtn) {
            shuffleBtn.classList.toggle('active');
            if (this.player) {
                this.player.setShuffle(shuffleBtn.classList.contains('active'));
            }
        }
    }
    
    toggleRepeat() {
        const repeatBtn = document.querySelector('.repeat');
        if (repeatBtn) {
            repeatBtn.classList.toggle('active');
            if (this.player) {
                this.player.setRepeat(repeatBtn.classList.contains('active'));
            }
        }
    }
    
    toggleFavorite() {
        const favoriteBtn = document.querySelector('.track-favorite');
        if (favoriteBtn) {
            favoriteBtn.classList.toggle('active');
        }
    }
    
    toggleMute() {
        if (this.player) {
            const isMuted = this.player.toggleMute();
            this.updateVolumeIcon(isMuted ? 0 : this.player.getVolume());
        }
    }
    
    updateVolumeIcon(volume) {
        const volumeIcons = document.querySelectorAll('.volume-icon');
        volumeIcons.forEach(icon => {
            icon.style.opacity = '0';
            icon.style.transform = 'scale(0.8)';
        });
        
        let activeIcon;
        if (volume === 0) {
            activeIcon = document.querySelector('.volume-icon.muted');
        } else if (volume < 0.3) {
            activeIcon = document.querySelector('.volume-icon.low');
        } else if (volume < 0.7) {
            activeIcon = document.querySelector('.volume-icon.medium');
        } else {
            activeIcon = document.querySelector('.volume-icon.high');
        }
        
        if (activeIcon) {
            activeIcon.style.opacity = '1';
            activeIcon.style.transform = 'scale(1)';
        }
    }
    
    increaseVolume() {
        if (this.player) {
            const currentVolume = this.player.getVolume();
            const newVolume = Math.min(1, currentVolume + 0.1);
            this.player.setVolume(newVolume);
            this.updateVolumeIcon(newVolume);
            
            const volumeFill = document.querySelector('.volume-fill');
            if (volumeFill) {
                volumeFill.style.width = `${newVolume * 100}%`;
            }
        }
    }
    
    decreaseVolume() {
        if (this.player) {
            const currentVolume = this.player.getVolume();
            const newVolume = Math.max(0, currentVolume - 0.1);
            this.player.setVolume(newVolume);
            this.updateVolumeIcon(newVolume);
            
            const volumeFill = document.querySelector('.volume-fill');
            if (volumeFill) {
                volumeFill.style.width = `${newVolume * 100}%`;
            }
        }
    }
    
    showTrackDetails(trackId) {
        console.log('Отображение деталей для трека:', trackId);
        // Implement track details modal/popup
    }
    
    handleInitError(error) {
        console.error('App initialization error:', error);
        
        // Show error message to user
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.innerHTML = `
            <div class="error-content">
                <h2>Упс! Что-то пошло не так</h2>
                <p>Не удалось инициализировать приложение. Пожалуйста, обновите страницу и попробуйте снова.</p>
                <button class="btn btn-primary" onclick="window.location.reload()">Обновить страницу</button>
            </div>
        `;
        
        document.body.appendChild(errorMessage);
        
        // Hide loading screen
        this.hideLoadingScreen();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AlgoRitmApp();
});

// Add CSS for gradient artworks
const style = document.createElement('style');
style.textContent = `
    .gradient-1 { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .gradient-2 { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .gradient-3 { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    
    .error-message {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--color-bg-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .error-content {
        text-align: center;
        max-width: 400px;
        padding: var(--space-xl);
    }
    
    .error-content h2 {
        margin-bottom: var(--space-lg);
        color: var(--color-error);
    }
    
    .error-content p {
        margin-bottom: var(--space-xl);
        color: var(--color-text-secondary);
    }
`;
document.head.appendChild(style);