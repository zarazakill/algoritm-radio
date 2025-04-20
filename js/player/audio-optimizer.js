export class AudioOptimizer {
    constructor(audioElement, config) {
        this.audio = audioElement;
        this.config = config || {};
        // Устанавливаем значения по умолчанию, если конфиг не указан
        this.optimizationConfig = this.config.optimization || {
            lowLatency: true,
            bufferTarget: 15,
            reconnectStrategy: 'fast'
        };
        this.bufferCache = new Map();
    }

    async optimize() {
        if (this.optimizationConfig.lowLatency) {
            this.enableLowLatency();
        }
        
        this.setupBufferMonitoring();
    }

    enableLowLatency() {
        try {
            this.audio.setAttribute('playsinline', '');
            this.audio.setAttribute('webkit-playsinline', '');
            this.audio.setAttribute('preload', 'auto');
            
            // Для Safari/iOS
            if (typeof this.audio.webkitPreservesPitch !== 'undefined') {
                this.audio.webkitPreservesPitch = true;
            }
        } catch (e) {
            console.warn('Low latency optimization failed:', e);
        }
    }

    setupBufferMonitoring() {
        const bufferTarget = this.optimizationConfig.bufferTarget || 15;
        
        this.bufferMonitorInterval = setInterval(() => {
            const buffer = this.getCurrentBuffer();
            if (buffer < bufferTarget) {
                this.adjustBitrate(buffer);
            }
        }, 2000);
    }

    getCurrentBuffer() {
        if (this.audio.buffered.length === 0) return 0;
        const end = this.audio.buffered.end(this.audio.buffered.length - 1);
        const current = this.audio.currentTime;
        return end - current;
    }

    adjustBitrate(bufferLevel) {
        // Логика адаптации битрейта
        console.log(`Buffer level low (${bufferLevel}s), adjusting bitrate...`);
    }

    destroy() {
        if (this.bufferMonitorInterval) {
            clearInterval(this.bufferMonitorInterval);
        }
    }
}
