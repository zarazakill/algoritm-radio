export class AudioOptimizer {
    constructor(audioElement, config) {
        this.audio = audioElement;
        this.config = config || {};
        this.optimizationConfig = this.config.optimization || {
            lowLatency: true,
            bufferTarget: 15, // Целевой размер буфера в секундах
            minBufferThreshold: 5, // Минимальный порог буфера перед действием
            maxQualitySwitches: 3, // Максимальное количество переключений качества
            switchCooldown: 30000 // 30 секунд между переключениями
        };
        this.bufferCache = new Map();
        this.qualitySwitchCount = 0;
        this.lastSwitchTime = 0;
        this.currentBitrate = 'high';
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
            
            if (typeof this.audio.webkitPreservesPitch !== 'undefined') {
                this.audio.webkitPreservesPitch = true;
            }
        } catch (e) {
            console.warn('Low latency optimization failed:', e);
        }
    }

    setupBufferMonitoring() {
        this.bufferMonitorInterval = setInterval(() => {
            const buffer = this.getCurrentBuffer();
            if (buffer < this.optimizationConfig.minBufferThreshold) {
                this.handleLowBuffer(buffer);
            }
        }, 2000);
    }

    getCurrentBuffer() {
        if (this.audio.buffered.length === 0) return 0;
        const end = this.audio.buffered.end(this.audio.buffered.length - 1);
        const current = this.audio.currentTime;
        return end - current;
    }

    handleLowBuffer(bufferLevel) {
        const now = Date.now();
        const sinceLastSwitch = now - this.lastSwitchTime;
        
        // Проверяем условия для переключения
        if (this.qualitySwitchCount < this.optimizationConfig.maxQualitySwitches && 
            sinceLastSwitch > this.optimizationConfig.switchCooldown) {
            
            console.log(`Low buffer (${bufferLevel.toFixed(2)}s), switching to lower bitrate...`);
            this.switchToLowerBitrate();
            this.qualitySwitchCount++;
            this.lastSwitchTime = now;
            
        } else if (sinceLastSwitch > this.optimizationConfig.switchCooldown) {
            console.warn(`Buffer critically low (${bufferLevel.toFixed(2)}s), but max switches reached`);
        }
    }

    switchToLowerBitrate() {
        if (this.currentBitrate === 'high') {
            console.log('Switching to medium bitrate');
            this.currentBitrate = 'medium';
            // Здесь должна быть логика переключения на средний битрейт
            // Например: player.switchStream('medium');
        } else if (this.currentBitrate === 'medium') {
            console.log('Switching to low bitrate');
            this.currentBitrate = 'low';
            // player.switchStream('low');
        }
    }

    destroy() {
        if (this.bufferMonitorInterval) {
            clearInterval(this.bufferMonitorInterval);
        }
    }
}
