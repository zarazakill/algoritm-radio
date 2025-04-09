import { RadioPlayer } from './player/player.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const player = new RadioPlayer();
        
        // Добавляем проверку перед добавлением обработчика
document.getElementById('start-playback')?.addEventListener('click', async () => {
    try {
        document.getElementById('audio-overlay').style.display = 'none';
        
        // Добавляем проверку и ожидание завершения загрузки
        if (player.elements.audio.readyState < 2) { // 2 = HAVE_ENOUGH_DATA
            await new Promise(resolve => {
                player.elements.audio.addEventListener('canplay', resolve, { once: true });
            });
        }
        
        await player.elements.audio.play();
        
        if (player.state.audioContext?.state === 'suspended') {
            await player.state.audioContext.resume();
        }
    } catch (error) {
        console.error("Playback error:", error);
        player.setStatus(`Ошибка воспроизведения: ${error.message}`, true);
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
