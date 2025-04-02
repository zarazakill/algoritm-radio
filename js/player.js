document.addEventListener('DOMContentLoaded', function() {
    const audio = document.getElementById('radio-stream');
    const playBtn = document.getElementById('play-btn');
    const statusEl = document.getElementById('stream-status');
    const currentTrackEl = document.getElementById('current-track');
    const nextTrackEl = document.getElementById('next-track');
    const historyList = document.getElementById('history-list');
    
    // URL API для получения информации о треках (пример для AzuraCast)
    const API_URL = "https://wwcat.duckdns.org/api/nowplaying/1";

    // Функция обновления информации о треках
    async function updateTrackInfo() {
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            
            // Текущий трек
            const current = data.now_playing.song;
            currentTrackEl.innerHTML = `
                <strong>${current.title}</strong> - ${current.artist}
                <span class="progress">${formatTime(data.now_playing.elapsed)} / ${formatTime(data.now_playing.duration)}</span>
            `;
            
            // Следующий трек
            if (data.playing_next) {
                nextTrackEl.innerHTML = `
                    Далее: <strong>${data.playing_next.song.title}</strong> - ${data.playing_next.song.artist}
                `;
            }
            
            // История (последние 5 треков)
            if (data.song_history) {
                historyList.innerHTML = data.song_history.slice(0, 5).map(track => `
                    <li>${track.title} - ${track.artist}</li>
                `).join('');
            }
            
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
        }
    }

    // Форматирование времени (mm:ss)
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Обновляем информацию каждые 10 секунд
    setInterval(updateTrackInfo, 10000);
    updateTrackInfo(); // Первоначальная загрузка

    // URL потоков
    const STREAM_URL = "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio";
    const FALLBACK_URL = "https://wwcat.duckdns.org:8000/radio";

    // Установка начальной громкости
    audio.volume = 0.7; // Значение по умолчанию

    function setStatus(text, isError = false) {
        statusEl.textContent = text;
        statusEl.classList.toggle('error', isError);
    }

    // Обработчик изменения громкости
    volumeSlider.addEventListener('input', function() {
        audio.volume = this.value;
        updateVolumeIcon();
    });

    // Кнопка mute/unmute
    volumeBtn.addEventListener('click', function() {
        audio.muted = !audio.muted;
        updateVolumeIcon();
    });

    // Обновление иконки громкости
    function updateVolumeIcon() {
        if (audio.muted || audio.volume === 0) {
            volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (audio.volume < 0.5) {
            volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }

    // Остальной код плеера остается без изменений
    async function testStream(url) {
        try {
            const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
            return true;
        } catch {
            return false;
        }
    }

    async function initPlayer() {
        if (await testStream(STREAM_URL)) {
            audio.src = STREAM_URL;
        } else {
            audio.src = FALLBACK_URL;
        }

        audio.crossOrigin = "anonymous";
        audio.preload = "auto";

        audio.addEventListener('canplay', () => {
            setStatus("Онлайн");
            playBtn.disabled = false;
        });

        audio.addEventListener('error', () => {
            setStatus("Ошибка подключения", true);
        });
    }

    playBtn.addEventListener('click', async () => {
        if (audio.paused) {
            try {
                await audio.play();
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                setStatus("Онлайн");
            } catch (e) {
                setStatus("Нажмите разрешить", true);
                console.error("Playback error:", e);
            }
        } else {
            audio.pause();
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            setStatus("Пауза");
        }
    });

    // Инициализация
    initPlayer();
    updateVolumeIcon(); // Установка начальной иконки громкости
    document.addEventListener('click', initPlayer, { once: true });
});
