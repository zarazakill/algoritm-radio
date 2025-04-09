import { RadioPlayer } from './player/player.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const player = new RadioPlayer();
        
        // Добавляем проверку перед добавлением обработчика
        const startBtn = document.getElementById('start-playback');
        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                try {
                    document.getElementById('audio-overlay').style.display = 'none';
                    await player.elements.audio.play();
                    
                    if (player.state.audioContext?.state === 'suspended') {
                        await player.state.audioContext.resume();
                    }
                } catch (error) {
                    console.error("Playback error:", error);
                    player.setStatus(`Ошибка: ${error.message}`, true);
                }
            });
        }
        
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
