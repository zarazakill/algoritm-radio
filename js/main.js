document.addEventListener('DOMContentLoaded', async () => {
    try {
        const player = new RadioPlayer();
        
        const startButton = document.getElementById('start-playback');
        if (startButton) {
            startButton.addEventListener('click', async () => {
                try {
                    // Скрываем оверлей
                    const overlay = document.getElementById('audio-overlay');
                    if (overlay) overlay.style.display = 'none';
                    
                    // Явно инициируем подключение к потоку
                    await player.connectToStream();
                    
                    // Пробуем воспроизвести
                    await player.audioController.play();
                    
                    // Возобновляем AudioContext если нужно
                    if (player.state.audioContext?.state === 'suspended') {
                        await player.state.audioContext.resume();
                    }
                } catch (error) {
                    console.error("Playback error:", error);
                    player.audioController.setStatus(`Ошибка: ${error.message}`, true);
                }
            });
        }
        
        await player.init();
    } catch (error) {
        console.error("Initialization error:", error);
    }
});
