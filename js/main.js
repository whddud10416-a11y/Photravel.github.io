import { Game } from './Game.js';

async function main() {
    const game = new Game();
    await game.init();
    game.start();
}

try {
    main();
} catch(e) {
    console.error("An error occurred during game initialization or runtime:", e);
    // Optionally, display a less intrusive error message
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    if (errorContainer && errorMessage) {
        errorMessage.textContent = e.stack;
        errorContainer.style.display = 'block';
    }
}
