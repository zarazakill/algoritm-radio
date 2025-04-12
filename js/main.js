import { RadioPlayer } from './player/player.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const player = new RadioPlayer();
        
        document.getElementById('start-playback')?.addEventListener('click', async () => {
            try {
                document.getElementById('audio-overlay').style.display = 'none';
                
                // Проверяем готовность аудио через AudioController
                if (player.audioController.audio.readyState < 2) { // 2 = HAVE_ENOUGH_DATA
                    await new Promise(resolve => {
                        player.audioController.audio.addEventListener('canplay', resolve, { once: true });
                    });
                }
                
                // Используем метод play() из AudioController
                await player.audioController.play();
                
                // Возобновляем AudioContext если нужно
                if (player.state.audioContext?.state === 'suspended') {
                    await player.state.audioContext.resume();
                }
            } catch (error) {
                console.error("Playback error:", error);
                player.audioController.setStatus(`Ошибка воспроизведения: ${error.message}`, true);
            }
        });
        
        await player.init();
    } catch (error) {
        console.error("Fatal initialization error:", error);
        const statusEl = document.getElementById('stream-status');
        if (statusEl) {
            statusEl.textContent = `Ошибка инициализации: ${error.message}`;
            statusEl.className = 'status-error';
        }
    }
});
