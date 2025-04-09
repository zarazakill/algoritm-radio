import { RadioPlayer } from './player.js';

document.addEventListener('DOMContentLoaded', () => {
    const player = new RadioPlayer();
    
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
    
    player.init();
});
