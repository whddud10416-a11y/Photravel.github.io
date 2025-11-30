import * as T from 'three';
import { config } from './config.js';

export class CameraController {
    constructor(camera, player) {
        this.camera = camera;
        this.player = player;
        
        this.cameraOffset = new T.Vector3(
            config.camera.distance, 
            config.camera.height, 
            config.camera.distance
        );
        this.desiredDistance = this.cameraOffset.length(); // Store the initial distance

        this.isDragging = false;
        this.previousMouseX = 0;

        this.addEventListeners();
    }

    addEventListeners() {
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        document.addEventListener('mouseleave', this.onMouseUp.bind(this)); // Stop dragging if mouse leaves window
    }

    onMouseDown(event) {
        this.isDragging = true;
        this.previousMouseX = event.clientX;
    }

    onMouseUp() {
        this.isDragging = false;
    }

    onMouseMove(event) {
        if (!this.isDragging) return;

        const deltaX = event.clientX - this.previousMouseX;
        this.previousMouseX = event.clientX;
        
        // Rotate the offset vector around the player's up-axis (Y)
        const rotationSpeed = 0.005;
        const quaternion = new T.Quaternion().setFromAxisAngle(
            new T.Vector3(0, 1, 0), 
            -deltaX * rotationSpeed
        );
        this.cameraOffset.applyQuaternion(quaternion);

        // Maintain the original distance to prevent zooming
        this.cameraOffset.normalize().multiplyScalar(this.desiredDistance);
    }

    update() {
        if (!this.player.model) return;
        
        const playerPosition = this.player.model.position; // Should be (0, 0.5, 0)
        
        const desiredCameraPosition = playerPosition.clone().add(this.cameraOffset);
        
        this.camera.position.lerp(desiredCameraPosition, config.camera.lerpFactor);

        // Look at a stable point at the player's base.
        const lookAtTarget = playerPosition.clone();
        lookAtTarget.y = 1.0; 
        this.camera.lookAt(lookAtTarget);
    }
}