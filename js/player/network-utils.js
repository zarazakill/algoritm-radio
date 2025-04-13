/**
 * Утилиты для работы с сетью
 */
export class NetworkUtils {
    /**
     * Проверяет доступность URL с таймаутом
     * @param {string} url - URL для проверки
     * @param {number} [timeout=3000] - Таймаут в миллисекундах
     * @returns {Promise<boolean>} - true если ресурс доступен, false если недоступен
     * @throws {Error} - Если произошла ошибка, не связанная с доступностью (например, неправильный URL)
     */
    static async testUrl(url, timeout = 3000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal,
                cache: 'no-store'
            });

            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                return false;
            }
            // Другие ошибки (например, неправильный URL) пробрасываем дальше
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Запрос с таймаутом
     * @param {string} url - URL для запроса
     * @param {number} timeout - Таймаут в миллисекундах
     * @param {Object} [options={}] - Дополнительные опции fetch
     * @returns {Promise<Response>}
     * @throws {Error} - При таймауте или других ошибках сети
     */
    static async fetchWithTimeout(url, timeout, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Таймаут подключения (${timeout}ms)`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Находит первый рабочий URL из списка
     * @param {Array<string>} urls - Список URL для проверки
     * @param {number} [timeout=3000] - Таймаут для каждого запроса в миллисекундах
     * @returns {Promise<string|null>} - Первый рабочий URL или null, если ни один не работает
     */
    static async findWorkingUrl(urls, timeout = 3000) {
        for (const url of urls) {
            try {
                const isAvailable = await this.testUrl(url, timeout);
                if (isAvailable) {
                    return url;
                }
            } catch (error) {
                console.warn(`Ошибка при проверке URL ${url}:`, error.message);
                continue;
            }
        }
        return null;
    }
}
