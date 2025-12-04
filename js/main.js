import { Game } from './Game.js';

async function main() {
    const game = new Game();
    await game.init();

    const galleryButton = document.getElementById('gallery-button');
    if (galleryButton) {
        // Make the button appear after loading
        galleryButton.classList.remove('hidden'); // Ensure hidden class is removed if it was present
        galleryButton.classList.add('visible'); // Trigger the transition
        
        galleryButton.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link navigation
            const galleryUrl = 'https://spinning-experiences-055746.framer.app/gallery';
            game.uiManager.showGatePopup(galleryUrl);
        });
    }

    // Show the intro popup instead of starting the game directly
    game.showIntro(); 
    // game.start(); // Re-enabled for debugging mobile issue
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