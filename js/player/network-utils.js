export class NetworkUtils {
    static async testUrl(url, timeout = 3000) {
        try {
            // Если url - это объект, берем свойство url
            const urlStr = typeof url === 'object' ? url.url : url;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const options = typeof url === 'object' ? url.corsOptions || {} : {};
            
            const response = await fetch(urlStr, {
                method: 'HEAD',
                mode: options.mode || 'no-cors',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return true;
        } catch {
            return false;
        }
    }

static async fetchWithTimeout(url, timeout, options = {}) {
    try {
        const urlStr = typeof url === 'object' ? url.url : url;
        const mergedOptions = typeof url === 'object' ? 
            { ...url.corsOptions, ...options } : 
            options;

        // Добавляем fallback для CORS
        if (!mergedOptions.mode) {
            mergedOptions.mode = 'cors';
        }

        return await Promise.race([
            fetch(urlStr, mergedOptions),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Таймаут подключения')), timeout)
        ]);
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}
    
    static async findWorkingUrl(urls, timeout = 3000) {
        for (const url of urls) {
            try {
                if (await this.testUrl(url, timeout)) {
                    return url; // Возвращаем оригинальный объект/строку
                }
            } catch (error) {
                console.warn(`URL недоступен: ${typeof url === 'object' ? url.url : url}`, error);
            }
        }
        return null;
    }
}
