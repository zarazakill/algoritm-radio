/**
 * Класс для управления аудио контекстом и обработкой аудио
 */
export class AudioController {
    /**
     * Инициализирует аудио контекст с обработкой ошибок
     * @returns {AudioContext|null} - Созданный аудио контекст или null при ошибке
     */
static initAudioContext() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContext();
        
        // Автоматически приостанавливаем контекст
        if (context.state === 'running') {
            context.suspend().catch(e => console.error("Error suspending AudioContext:", e));
        }
        
        return context;
    } catch (error) {
        console.error("Ошибка инициализации AudioContext:", error);
        return null;
    }
}
    
    /**
     * Создает анализатор для визуализации звука
     * @param {AudioContext} audioContext - Аудио контекст
     * @param {HTMLMediaElement} mediaElement - HTML элемент аудио
     * @returns {AnalyserNode|null} - Созданный анализатор или null при ошибке
     */
    static createAnalyser(audioContext, mediaElement) {
        try {
            if (!audioContext || !mediaElement) return null;
            
            const source = audioContext.createMediaElementSource(mediaElement);
            const analyser = audioContext.createAnalyser();
            
            // Настройка анализатора для лучшей визуализации
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            
            return analyser;
        } catch (error) {
            console.error("Ошибка создания анализатора:", error);
            return null;
        }
    }
    
    /**
     * Обрабатывает состояние приостановки аудио контекста
     * @param {AudioContext} audioContext - Аудио контекст для восстановления
     * @returns {Promise<boolean>} - Успешность операции
     */
    static async resumeAudioContext(audioContext) {
        if (!audioContext) return false;
        
        try {
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            return true;
        } catch (error) {
            console.error("Ошибка восстановления AudioContext:", error);
            return false;
        }
    }
    
    /**
     * Устанавливает громкость через GainNode (альтернатива audio.volume)
     * @param {AudioContext} audioContext - Аудио контекст
     * @param {MediaElementAudioSourceNode} source - Источник аудио
     * @param {number} volume - Значение громкости (0-1)
     * @returns {GainNode} - Узел управления громкостью
     */
    static createVolumeControl(audioContext, source, volume = 1.0) {
        if (!audioContext || !source) return null;
        
        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        return gainNode;
    }
}
