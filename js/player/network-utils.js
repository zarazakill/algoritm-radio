export class NetworkUtils {
    /**
     * Проверяет доступность аудиопотоков
     * @param {Array} streams - Массив объектов {url: string, priority: number}
     * @returns {Promise<Object>} Первый рабочий поток
     */
    static async findWorkingStream(streams) {
        const sortedStreams = [...streams].sort((a, b) => a.priority - b.priority);
        
        for (const stream of sortedStreams) {
            try {
                if (await this.testStream(stream.url)) {
                    return stream;
                }
            } catch (error) {
                console.warn(`Поток недоступен: ${stream.url}`, error);
            }
        }
        return null;
    }

    /**
     * Проверяет доступность конкретного потока
     * @param {string} url - URL потока
     * @returns {Promise<boolean>}
     */
    static async testStream(url) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });

            clearTimeout(timeout);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Запрос с таймаутом
     * @param {string} url - URL API
     * @param {number} timeout - Таймаут в мс
     * @returns {Promise<Response>}
     */
    static async fetchWithTimeout(url, timeout) {
        return Promise.race([
            fetch(url),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Таймаут подключения')), timeout)
        ]);
    }
}
