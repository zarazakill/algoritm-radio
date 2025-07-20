/* ...existing code... */
            lastError: null
        },
        isInitialized: false,
        lastTrackData: null,
        gradientIndex: 0
    };
        
    // this.elements.audio.autoplay = true; // Autoplay is handled manually
/* ...existing code... */
    /**
     * Light initialization on page load. Fetches track info without touching audio.
     */
    async lightInit() {
        this.setupEventListeners();
        this.changeEqualizerColors(); // Set initial colors
        this.setStatus("Готов к запуску");
        this.updateStatusMessage("Нажмите 'Запустить поток', чтобы начать");

        try {
/* ...existing code... */
    }

    async startPlayback() {
/* ...existing code... */
        this.updateStatusMessage("Воспроизведение");
        this.elements.audio.muted = false; // Убедимся что звук не выключен

        if (!this.state.streamUptimeInterval) {
/* ...existing code... */
            throw error; // Re-throw to inform the caller
        } finally {
            this.state.isConnecting = false;
        }
    }

    changeEqualizerColors() {
        if (!this.config.equalizer?.gradients) return;

        const gradients = this.config.equalizer.gradients;
        this.state.gradientIndex = (this.state.gradientIndex + 1) % gradients.length;
        const newGradient = gradients[this.state.gradientIndex];

        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--equalizer-color-start', newGradient.start);
        rootStyle.setProperty('--equalizer-color-mid', newGradient.mid);
        rootStyle.setProperty('--equalizer-color-end', newGradient.end);
    }

    async init() {
        try {
            // Проверяем наличие необходимых элементов DOM
/* ...existing code... */
            if (this.isTrackChanged(data.now_playing, this.state.lastTrackData?.now_playing)) {
                // Очищаем предыдущий интервал
                if (this.state.timeUpdateInterval) {
                    clearInterval(this.state.timeUpdateInterval);
                    this.state.timeUpdateInterval = null;
                }

                this.changeEqualizerColors();
                this.state.lastTrackData = data;
                this.state.lastUpdateTime = Date.now();
                this.updateUI(data);
/* ...existing code... */