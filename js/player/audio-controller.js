export class AudioController {
    /**
     * Инициализирует AudioContext в приостановленном состоянии
     * @returns {AudioContext|null} Созданный контекст или null при ошибке
     */
    static initAudioContext() {
        // Проверка поддержки Web Audio API
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.error('Web Audio API не поддерживается в этом браузере');
            return null;
        }

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const context = new AudioContext();
            
            // Для Safari требуется дополнительная проверка
            if (typeof context.state === 'undefined') {
                console.warn('Нестандартная реализация AudioContext');
                return context;
            }

            // Автоматическая приостановка для последующей активации по жесту
            if (context.state === 'running') {
                context.suspend()
                    .then(() => console.debug('AudioContext приостановлен'))
                    .catch(e => console.error('Ошибка приостановки:', e));
            }
            
            return context;
        } catch (error) {
            console.error('Ошибка создания AudioContext:', error);
            return null;
        }
    }

    /**
     * Активирует AudioContext после пользовательского жеста
     * @param {AudioContext} audioContext
     * @returns {Promise<boolean>} Успешность активации
     */
    static async activateAudioContext(audioContext) {
        if (!audioContext) {
            console.warn('Попытка активации несуществующего AudioContext');
            return false;
        }

        try {
            // Проверка для нестандартных реализаций
            if (typeof audioContext.state === 'undefined') {
                console.warn('Активация нестандартного AudioContext');
                return true;
            }

            if (audioContext.state === 'suspended') {
                console.debug('Попытка активации AudioContext...');
                await audioContext.resume();
                
                // Дополнительная проверка после resume()
                if (audioContext.state !== 'running') {
                    throw new Error('AudioContext не перешел в running состояние');
                }
                
                console.debug('AudioContext успешно активирован');
                return true;
            }
            
            return audioContext.state === 'running';
        } catch (error) {
            console.error('Ошибка активации AudioContext:', error);
            return false;
        }
    }

    /**
     * Создает анализатор с дополнительными проверками
     */
    static createAnalyser(audioContext, mediaElement) {
        if (!audioContext || !mediaElement) {
            console.warn('Недостаточно параметров для создания анализатора');
            return null;
        }

        try {
            // Проверка подключенности mediaElement
            if (mediaElement.readyState === 0) {
                console.warn('Элемент media не готов');
                return null;
            }

            const source = audioContext.createMediaElementSource(mediaElement);
            const analyser = audioContext.createAnalyser();
            
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            
            // Безопасное подключение
            try {
                source.connect(analyser);
                analyser.connect(audioContext.destination);
            } catch (connectionError) {
                console.error('Ошибка подключения анализатора:', connectionError);
                return null;
            }
            
            return analyser;
        } catch (error) {
            console.error('Ошибка создания анализатора:', error);
            return null;
        }
    }

    /**
     * Улучшенный контроль громкости с защитой от клиппинга
     */
    static createVolumeControl(audioContext, source, volume = 0.8) {  // По умолчанию 0.8 для защиты ушей
        if (!audioContext || !source) return null;
        
        try {
            const gainNode = audioContext.createGain();
            
            // Защита от слишком громкого звука
            const safeVolume = Math.min(1.0, Math.max(0, volume));
            gainNode.gain.value = safeVolume;
            
            // Плавное изменение громкости
            gainNode.gain.setValueAtTime(safeVolume, audioContext.currentTime);
            
            source.disconnect();  // Отключаем прямое подключение
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            return gainNode;
        } catch (error) {
            console.error('Ошибка создания контроля громкости:', error);
            return null;
        }
    }

    /**
     * Безопасное восстановление контекста
     */
    static async safeResume(audioContext) {
        return this.activateAudioContext(audioContext);
    }
}
