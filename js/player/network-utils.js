/**
 * Утилиты для работы с сетью
 */
export class NetworkUtils {
    /**
     * Проверяет доступность URL с таймаутом
     * @param {string} url - URL для проверки
     * @param {number} timeout - Таймаут в миллисекундах
     * @returns {Promise<boolean>} - Доступен ли ресурс
     */
    static async testUrl(url, timeout = 3000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Запрос с таймаутом
     * @param {string} url - URL для запроса
     * @param {number} timeout - Таймаут в миллисекундах
     * @param {Object} options - Дополнительные опции fetch
     * @returns {Promise<Response>}
     */
    static async fetchWithTimeout(url, timeout, options = {}) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Таймаут подключения')), timeout)
            )
        ]);
    }

    /**
     * Находит первый рабочий URL из списка
     * @param {Array<string>} urls - Список URL для проверки
     * @param {number} timeout - Таймаут для каждого запроса
     * @returns {Promise<string|null>} - Первый рабочий URL или null
     */
    static async findWorkingUrl(urls, timeout = 3000) {
        for (const url of urls) {
            try {
                if (await this.testUrl(url, timeout)) {
                    return url;
                }
            } catch (error) {
                console.warn(`URL недоступен: ${url}`, error);
            }
        }
        return null;
    }
}
