export class AudioController {
    /**
     * Инициализирует AudioContext (с проверкой поддержки браузером)
     * @returns {AudioContext|null}
     */
    static initAudioContext() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            return new AudioContextClass();
        } catch (error) {
            console.error("AudioContext не поддерживается:", error);
            return null;
        }
    }

    /**
     * Создает анализатор для визуализации звука
     * @param {AudioContext} audioContext
     * @param {HTMLAudioElement} audioElement
     * @returns {AnalyserNode|null}
     */
    static setupAnalyser(audioContext, audioElement) {
        if (!audioContext || !audioElement) return null;

        try {
            const source = audioContext.createMediaElementSource(audioElement);
            const analyser = audioContext.createAnalyser();

            analyser.fftSize = 256;
            source.connect(analyser);
            analyser.connect(audioContext.destination);

            return analyser;
        } catch (error) {
            console.error("Ошибка создания анализатора:", error);
            return null;
        }
    }

    /**
     * Возобновляет AudioContext после пользовательского взаимодействия
     * @param {AudioContext} audioContext
     */
    static async resumeContext(audioContext) {
        if (audioContext && audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
                console.log("AudioContext возобновлен");
            } catch (error) {
                console.error("Ошибка возобновления AudioContext:", error);
            }
        }
    }

    /**
     * Генерирует данные для визуализации (волна или частоты)
     * @param {AnalyserNode} analyser
     * @param {string} type 'waveform' или 'frequency'
     * @returns {Uint8Array}
     */
    static getVisualizationData(analyser, type = 'waveform') {
        if (!analyser) return new Uint8Array(0);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        if (type === 'frequency') {
            analyser.getByteFrequencyData(dataArray);
        } else {
            analyser.getByteTimeDomainData(dataArray);
        }

        return dataArray;
    }

    /**
     * Настраивает авто-паузу при сворачивании вкладки
     * @param {HTMLAudioElement} audioElement
     */
    static setupTabPauseBehavior(audioElement) {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                audioElement.pause();
            } else if (audioElement.dataset.shouldPlay === 'true') {
                audioElement.play().catch(console.error);
            }
        });
    }

    /**
     * Нормализует громкость (предотвращает клиппинг)
     * @param {AudioNode} node
     * @param {number} maxVolume 0-1
     */
    static setupVolumeLimiter(node, maxVolume = 0.8) {
        if (!node.context) return;

        const limiter = node.context.createDynamicsCompressor();
        limiter.threshold.value = -6;
        limiter.knee.value = 6;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.25;

        const gainNode = node.context.createGain();
        gainNode.gain.value = maxVolume;

        node.connect(limiter);
        limiter.connect(gainNode);
        gainNode.connect(node.context.destination);
    }
}
