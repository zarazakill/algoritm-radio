import { RadioConfig } from './config.js';
import { RadioPlayer } from './player/radio-player.js';

document.addEventListener('DOMContentLoaded', () => {
    new RadioPlayer(RadioConfig);
});
