export class AudioController {
    static initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            return new AudioContext();
        } catch (error) {
            console.error("Ошибка инициализации AudioContext:", error);
            return null;
        }
    }
}
