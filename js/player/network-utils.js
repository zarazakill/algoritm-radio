export class NetworkUtils {
    static async findWorkingStream(streams) {
        for (const stream of streams) {
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

    static async testStream(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    static async fetchWithTimeout(url, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
}
