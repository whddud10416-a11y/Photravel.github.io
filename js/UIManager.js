export class UIManager {
    constructor(game) {
        this.game = game;
        this.overlayContainer = document.getElementById('overlay-container');
        this.overlayIframe = document.getElementById('overlay-iframe');
        this.closeButton = document.getElementById('overlay-close-button');
        this.galleryButton = document.getElementById('gallery-button');

        this.isOverlayVisible = false;
        
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

    showGatePopup(url) {
        if (this.isOverlayVisible) return;

        if (this.galleryButton) {
            this.galleryButton.style.opacity = '0';
            this.galleryButton.style.filter = 'blur(10px)';
            this.galleryButton.style.pointerEvents = 'none';
        }
        
        this.overlayIframe.src = url;
        this.overlayContainer.classList.add('visible');
        this.isOverlayVisible = true;
        // Defer pause to allow current frame logic to complete
        setTimeout(() => this.game.pause(), 0);
    }

    hideGatePopup() {
        if (!this.isOverlayVisible) return;

        if (this.galleryButton) {
            this.galleryButton.style.opacity = '1';
            this.galleryButton.style.filter = 'blur(0px)';
            this.galleryButton.style.pointerEvents = 'auto';
        }

        this.overlayContainer.classList.remove('visible');
        this.isOverlayVisible = false;
        // The src is cleared after the fade-out transition (500ms)
        setTimeout(() => {
            this.overlayIframe.src = 'about:blank';
        }, 500);
        this.game.resume();
    }
}