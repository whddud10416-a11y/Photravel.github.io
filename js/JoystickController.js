import * as nipplejs from 'nipplejs';

export class JoystickController {
    constructor(inputController) {
        this.inputController = inputController;
        this.zone = document.getElementById('joystick-zone');

        if (!this.zone) {
            console.error("Joystick zone not found!");
            return;
        }

        // Make the zone visible because this controller is only created on touch devices
        this.zone.style.display = 'block';

        const options = {
            zone: this.zone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'rgba(255, 255, 255, 0.5)',
            size: 150,
            threshold: 0.1,
            fadeTime: 250
        };

        this.manager = nipplejs.create(options);
        this.bindEvents();
    }

    bindEvents() {
        this.manager.on('move', (evt, data) => {
            this.handleMove(data);
        });

        this.manager.on('end', () => {
            this.handleEnd();
        });
    }

    handleMove(data) {
        if (!data.vector) {
            this.handleEnd();
            return;
        }

        const { x, y } = data.vector;

        // Reset keys before applying new state
        this.resetKeys();

        // Vertical movement (W/S keys)
        // Y is inverted in nipple.js, positive is up
        if (y > 0.3) this.inputController.keys.forward = true;
        if (y < -0.3) this.inputController.keys.backward = true;

        // Horizontal movement (A/D keys for turning)
        if (x < -0.3) this.inputController.keys.left = true;
        if (x > 0.3) this.inputController.keys.right = true;
    }

    handleEnd() {
        this.resetKeys();
    }

    resetKeys() {
        this.inputController.keys.forward = false;
        this.inputController.keys.backward = false;
        this.inputController.keys.left = false;
        this.inputController.keys.right = false;
    }
}
