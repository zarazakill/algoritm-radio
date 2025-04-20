/** * Вспомогательные функции для работы с UI */
export class UIHelpers {
    /** * Форматирует секунды в удобный вид ("мм:сс") * * @param {number} seconds - Количество секунд * @return {string} Строковое представление времени */
    static formatTime(seconds) {
        if (Number.isNaN(Number.parseFloat(seconds))) return "0:00";
        
        let minutes = Math.floor(seconds / 60),
            secondsPart = Math.floor(seconds % 60).toString().padStart(2, '0');
            
        return `${minutes}:${secondsPart}`;
    }
    
    /** * Правильно склоняет слово согласно числу (например, песня-песни-песен). * * @param {number} count - Исходное число * @param {Array<string>} forms - Варианты формы слова ["единица", "двойственная", "множественное"] * @return {string} Верная форма слова */
    static pluralize(count, forms) {
        const cases = [2, 0, 1, 1, 1, 2];
        return forms[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[count % 10 < 5 ? count % 10 : 5]];
    }
    
    /** * Обновляет иконку уровня громкости на кнопке * * @param {HTMLElement|null} button - Кнопка управления громкостью * @param {number} volume - Уровень громкости (от 0 до 1) * @param {boolean} isMuted - Флаг отключения звука */
    static updateVolumeIcon(button, volume, isMuted) {
        if (!button) return;

        if (isMuted || volume <= 0) {
            button.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (volume < 0.5) {
            button.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }
    
    /** * Формирует элемент списка истории треков * * @param {object} trackData - Объект с информацией о треке * @param {number} index - Порядковый номер трека * @return {HTMLElement} Готовый элемент списка (<li>) */
    static createHistoryItem(trackData, index) {
        const listItem = document.createElement('li');
        if (index === 0) listItem.classList.add('new-track');
        
        const title = trackData?.song?.title ?? 'Неизвестный трек',
              artist = trackData?.song?.artist ?? 'Неизвестный исполнитель',
              duration = trackData.duration !== undefined ? this.formatTime(trackData.duration) : '';
        
        const titleSpan = document.createElement('span'),
              artistSpan = document.createElement('span');
        
        titleSpan.className = 'track-title';
        titleSpan.textContent = title;
        
        artistSpan.className = 'track-artist';
        artistSpan.textContent = artist;
        
        listItem.appendChild(titleSpan);
        listItem.appendChild(artistSpan);
        
        if (duration) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'track-time';
            timeSpan.textContent = duration;
            listItem.appendChild(timeSpan);
        }
        
        return listItem;
    }
}
