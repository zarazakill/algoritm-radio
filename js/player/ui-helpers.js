export class UIHelpers {
    static updateCurrentTrack(trackInfo, elements) {
        if (elements.currentTrackEl) {
            elements.currentTrackEl.innerHTML = `
                <div class="title">${trackInfo.song.title || 'Неизвестно'}</div>
                <div class="artist">${trackInfo.song.artist || 'Неизвестно'}</div>
            `;
        }
    }
}
