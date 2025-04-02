document.addEventListener('DOMContentLoaded', function() {
    // Элементы управления плеером
    const audio = document.getElementById('radio-stream');
    const playBtn = document.getElementById('play-btn');
    const statusEl = document.getElementById('stream-status');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeBtn = document.getElementById('volume-btn');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    
    // Элементы информации о треках
    const currentTrackEl = document.getElementById('current-track');
    const nextTrackEl = document.getElementById('next-track');
    const historyList = document.getElementById('history-list');
    const trackTitleEl = document.getElementById('track-title');
    const trackArtistEl = document.getElementById('track-artist');
    const currentArtEl = document.getElementById('current-art');

    // URL API и потоков
    const API_URL = "https://wwcat.duckdns.org/api/nowplaying/1";
    const STREAM_URL = "https://wwcat.duckdns.org:8443/listen/algoritm-stream/radio";
    const FALLBACK_URL = "https://wwcat.duckdns.org:8000/radio";

    // Инициализация плеера
    function initPlayer() {
        // Установка начальных значений
        audio.volume = volumeSlider.value;
        updateVolumeIcon();
        
        // Проверка и подключение потока
        testStream(STREAM_URL)
            .then(isAvailable => {
                audio.src = isAvailable ? STREAM_URL : FALLBACK_URL;
                audio.crossOrigin = "anonymous";
                setStatus("Готов к воспроизведению");
            })
            .catch(() => {
                audio.src = FALLBACK_URL;
                setStatus("Используется резервный поток", true);
            });

        // Обновление информации о треках
        updateTrackInfo();
        setInterval(updateTrackInfo, 10000);
    }

    // Обновление информации о треках
    async function updateTrackInfo() {
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            
            // Текущий трек
            const current = data.now_playing.song;
            trackTitleEl.textContent = current.title;
            trackArtistEl.textContent = current.artist;
            
            currentTrackEl.innerHTML = `
                <span class="track-name">${current.title} - ${current.artist}</span>
                <span class="track-progress">${formatTime(data.now_playing.elapsed)} / ${formatTime(data.now_playing.duration)}</span>
            `;
            
            // Следующий трек
            if (data.playing_next) {
                nextTrackEl.innerHTML = `
                    <span class="track-name">${data.playing_next.song.title} - ${data.playing_next.song.artist}</span>
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
            trackTitleEl.textContent = "Не удалось загрузить информацию";
        }
    }

    // Проверка доступности потока
    async function testStream(url) {
        try {
            const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
            return true;
        } catch {
            return false;
        }
    }

    // Форматирование времени (mm:ss)
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Обновление статуса
    function setStatus(text, isError = false) {
        statusEl.textContent = text;
        statusEl.classList.toggle('error', isError);
    }

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

    // Обновление прогресса трека
    function updateProgress() {
        if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            progressBar.value = progress;
            currentTimeEl.textContent = formatTime(audio.currentTime);
            durationEl.textContent = formatTime(audio.duration);
        }
    }

    // Обработчики событий
    playBtn.addEventListener('click', async () => {
        if (audio.paused) {
            try {
                await audio.play();
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                setStatus("Онлайн");
            } catch (e) {
                setStatus("Нажмите разрешить", true);
            }
        } else {
            audio.pause();
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            setStatus("Пауза");
        }
    });

    volumeSlider.addEventListener('input', () => {
        audio.volume = volumeSlider.value;
        audio.muted = false;
        updateVolumeIcon();
    });

    volumeBtn.addEventListener('click', () => {
        audio.muted = !audio.muted;
        updateVolumeIcon();
    });

    progressBar.addEventListener('input', () => {
        const seekTime = (progressBar.value / 100) * audio.duration;
        audio.currentTime = seekTime;
    });

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('canplay', () => {
        setStatus("Онлайн");
        playBtn.disabled = false;
        updateProgress();
    });

    audio.addEventListener('error', () => {
        setStatus("Ошибка подключения", true);
    });

    // Запуск плеера
    initPlayer();
    document.addEventListener('click', initPlayer, { once: true });
});
