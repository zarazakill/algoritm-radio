import { RadioPlayer } from './player/player.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing player...');
        const player = new RadioPlayer();
        await player.init();
        
        const playButton = document.getElementById('start-playback');
        if (!playButton) {
            throw new Error('Play button not found');
        }

        playButton.addEventListener('click', async () => {
            try {
                console.log('Play button clicked');
                
                // Скрываем оверлей если есть
                const overlay = document.getElementById('audio-overlay');
                if (overlay) {
                    overlay.style.display = 'none';
                }
                
                // Проверяем готовность аудио
                if (player.elements.audio.readyState < 2) {
                    await new Promise(resolve => {
                        player.elements.audio.addEventListener('canplay', resolve, { once: true });
                    });
                }
                
                // Запускаем воспроизведение
                await player.elements.audio.play();
                
                // Возобновляем аудиоконтекст если нужно
                if (player.state.audioContext?.state === 'suspended') {
                    await player.state.audioContext.resume();
                }
                
                console.log('Playback started successfully');
            } catch (error) {
                console.error("Playback error:", error);
                player.setStatus(`Ошибка воспроизведения: ${error.message}`, true);
            }
        });
        
    } catch (error) {
        console.error("Initialization failed:", error);
        const statusEl = document.getElementById('stream-status');
        if (statusEl) {
            statusEl.textContent = `Ошибка инициализации: ${error.message}`;
            statusEl.className = 'status-error';
        }
    }
});
