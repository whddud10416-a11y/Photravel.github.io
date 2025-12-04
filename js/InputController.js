export class InputController {
    constructor() {
        this.keysPressed = {};
        this.initListeners();
    }

    initListeners() {
        document.addEventListener('keydown', (event) => {
            this.keysPressed[event.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (event) => {
            this.keysPressed[event.key.toLowerCase()] = false;
        });
    }

    reset() {
        this.keysPressed = {};
    }
}
