export class UIManager {
    constructor(game) {
        this.game = game;
        this.overlayContainer = document.getElementById('overlay-container');
        this.overlayIframe = document.getElementById('overlay-iframe');
        this.closeButton = document.getElementById('overlay-close-button');
        this.galleryButton = document.getElementById('gallery-button');

        this.isOverlayVisible = false;
        this.isIntro = false; // Flag to track if the current popup is the intro
        
        if (!this.overlayContainer || !this.overlayIframe || !this.closeButton || !this.galleryButton) {
            console.error("UI elements not found!");
            return;
        }

        this.closeButton.addEventListener('click', () => this.hideGatePopup());
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isOverlayVisible) {
                this.hideGatePopup();
            }
        });
    }

    showIntroPopup(url) {
        this.isIntro = true;
        this.closeButton.classList.add('hidden'); // Hide close button initially
        this.showGatePopup(url);
    }

    showCloseButton() {
        this.closeButton.classList.remove('hidden');
    }

    showGatePopup(url) {
        if (this.isOverlayVisible) return;

        if (this.galleryButton) {
            this.galleryButton.style.opacity = '0';
            this.galleryButton.style.filter = 'blur(10px)';
            this.galleryButton.style.pointerEvents = 'none';
        }
        
        // Reset iframe state to transparent before showing
        this.overlayIframe.classList.remove('loaded');

        // Set src to start loading and add a one-time listener for when it's done
        this.overlayIframe.src = url;
        this.overlayIframe.addEventListener('load', () => {
            // Add 'loaded' class to fade in the iframe content
            this.overlayIframe.classList.add('loaded');
        }, { once: true }); // Listener automatically removes itself after firing

        // Add 'visible' to the container to start the background fade-in
        this.overlayContainer.classList.add('visible');
        this.isOverlayVisible = true;
        
        // Defer pause to allow current frame logic to complete
        // Don't pause if the game hasn't even started yet
        if (this.game.isGameStarted) {
             setTimeout(() => this.game.pause(), 0);
        }
    }

    hideGatePopup() {
        if (!this.isOverlayVisible) return;

        if (this.galleryButton) {
            this.galleryButton.style.opacity = '1';
            this.galleryButton.style.filter = 'blur(0px)';
            this.galleryButton.style.pointerEvents = 'auto';
        }

        // Make iframe content transparent before the container fades out
        this.overlayIframe.classList.remove('loaded');
        this.closeButton.classList.remove('hidden'); // Ensure button is visible next time

        this.overlayContainer.classList.remove('visible');
        this.isOverlayVisible = false;
        
        // The src is cleared after the fade-out transition (now 300ms)
        setTimeout(() => {
            this.overlayIframe.src = 'about:blank';
        }, 300);
        
        if (this.isIntro) {
            this.isIntro = false;
            this.game.start();
        } else {
            this.game.resume();
        }
    }
}