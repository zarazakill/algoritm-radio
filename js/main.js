document.addEventListener('DOMContentLoaded', async () => {
    try {
        const player = new RadioPlayer();
        
        // Добавляем обработчик для кнопки старта
        const startButton = document.getElementById('start-playback');
        if (startButton) {
            startButton.addEventListener('click', async () => {
                const overlay = document.getElementById('audio-overlay');
                if (overlay) overlay.style.display = 'none';
                
                try {
                    await player.elements.audio.play();
                    if (player.state.audioContext) {
                        await player.state.audioContext.resume();
                    }
                } catch (error) {
                    console.error("Ошибка воспроизведения:", error);
                    player.setStatus("Ошибка запуска: " + error.message, true);
                }
            });
        }
        
        // Инициализация с обработкой ошибок
        await player.init();
        
    } catch (error) {
        console.error("Ошибка при запуске приложения:", error);
        const statusEl = document.getElementById('stream-status');
        if (statusEl) {
            statusEl.textContent = "Ошибка загрузки плеера";
            statusEl.className = 'status-error';
        }
    }
});
