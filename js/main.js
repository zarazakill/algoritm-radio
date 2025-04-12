import { RadioPlayer } from './player/player.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing player...');
        const player = new RadioPlayer();
        await player.init();
        
        // Простая проверка работы кнопки
        document.getElementById('start-playback').addEventListener('click', () => {
            console.log('Play button clicked');
            player.elements.audio.play().catch(e => console.error('Play error:', e));
        });
        
    } catch (error) {
        console.error("Initialization failed:", error);
        const statusEl = document.getElementById('stream-status');
        if (statusEl) {
            statusEl.textContent = `Error: ${error.message}`;
            statusEl.className = 'status-error';
        }
    }
});
        
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
