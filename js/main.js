document.addEventListener('DOMContentLoaded', () => {
    // Инициализация плеера
    const player = new RadioPlayer();
    
    // Обработчик для кнопки старта воспроизведения
    document.getElementById('start-playback').addEventListener('click', () => {
        document.getElementById('audio-overlay').style.display = 'none';
        player.elements.audio.play()
            .then(() => {
                if (player.state.audioContext) {
                    player.state.audioContext.resume();
                }
            })
            .catch(console.error);
    });
    
    // Инициализация плеера
    player.init();
});
