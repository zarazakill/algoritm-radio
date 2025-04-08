export class NetworkUtils {
    static async fetchWithTimeout(url, timeout, options = {}) {
        return Promise.race([
            fetch(url, options),
                            new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Таймаут подключения')), timeout)
                            )
        ]);
    }

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
}
