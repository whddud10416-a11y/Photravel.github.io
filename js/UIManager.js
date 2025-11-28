export class UIManager {
    constructor(game) {
        this.game = game;
        this.overlayContainer = document.getElementById('overlay-container');
        this.overlayIframe = document.getElementById('overlay-iframe');
        this.closeButton = document.getElementById('overlay-close-button');

        this.isOverlayVisible = false;
        
        if (!this.overlayContainer || !this.overlayIframe || !this.closeButton) {
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

        this.overlayIframe.src = url;
        this.overlayContainer.classList.add('visible');
        this.isOverlayVisible = true;
        this.game.pause();
    }

    hideGatePopup() {
        if (!this.isOverlayVisible) return;

        this.overlayContainer.classList.remove('visible');
        this.isOverlayVisible = false;
        // The src is cleared after the fade-out transition (500ms)
        setTimeout(() => {
            this.overlayIframe.src = 'about:blank';
        }, 500);
        this.game.resume();
    }
}
