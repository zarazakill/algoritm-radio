/**
 * Контроллер для работы с Web Audio API
 */
export class AudioController {
    static #instance = null;
    static #isSupported = null;

    /**
     * Проверяет поддержку Web Audio API в браузере
     * @returns {boolean} - true если API поддерживается
     */
    static isSupported() {
        if (this.#isSupported === null) {
            this.#isSupported = !!(window.AudioContext || window.webkitAudioContext);
        }
        return this.#isSupported;
    }

    /**
     * Инициализирует или возвращает существующий экземпляр AudioContext
     * @returns {AudioContext|null} - Экземпляр AudioContext или null если не поддерживается
     */
    static initAudioContext() {
        if (!this.isSupported()) {
            console.error('Web Audio API не поддерживается в этом браузере');
            return null;
        }

        if (!this.#instance) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.#instance = new AudioContext();
                
                // Обработка приостановки в некоторых браузерах
                if (this.#instance.state === 'suspended') {
                    const resume = () => {
                        this.#instance.resume().then(() => {
                            document.removeEventListener('click', resume);
                            document.removeEventListener('touchstart', resume);
                        });
                    };
                    
                    document.addEventListener('click', resume, { once: true });
                    document.addEventListener('touchstart', resume, { once: true });
                }
            } catch (error) {
                console.error('Ошибка инициализации AudioContext:', error);
                return null;
            }
        }

        return this.#instance;
    }

    /**
     * Возвращает текущий экземпляр AudioContext
     * @returns {AudioContext|null} - Текущий экземпляр или null если не инициализирован
     */
    static getAudioContext() {
        return this.#instance || this.initAudioContext();
    }

    /**
     * Приостанавливает AudioContext
     * @returns {Promise<void>}
     */
    static async suspend() {
        if (this.#instance) {
            await this.#instance.suspend();
        }
    }

    /**
     * Возобновляет работу AudioContext
     * @returns {Promise<void>}
     */
    static async resume() {
        if (this.#instance) {
            await this.#instance.resume();
        }
    }

    /**
     * Закрывает AudioContext и освобождает ресурсы
     * @returns {Promise<void>}
     */
    static async close() {
        if (this.#instance) {
            await this.#instance.close();
            this.#instance = null;
        }
    }
}
