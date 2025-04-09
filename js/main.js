import { RadioPlayer } from 'player/player.js';

document.addEventListener('DOMContentLoaded', () => {
    // Инициализация элементов управления
    const startButton = document.getElementById('start-playback');
    const overlay = document.getElementById('audio-overlay');

    // Создаем экземпляр плеера
    const player = new RadioPlayer();

    // Обработчик кнопки запуска
    startButton.addEventListener('click', () => {
        overlay.style.display = 'none';
        player.togglePlayback().catch(console.error);
    });
});
