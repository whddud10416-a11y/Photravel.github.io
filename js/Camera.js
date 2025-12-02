import * as T from 'three';
import { config } from './config.js';

// Reverted CameraController for a 'moving world' architecture.
export class CameraController {
    constructor(camera, player) {
        this.camera = camera;
        this.player = player;
    }

    update() {
        if (!this.player.model) return;

        const targetPos = this.player.model.position; // Should be (0, 0.5, 0)

        const cameraX = targetPos.x + config.camera.distance;
        const cameraY = config.camera.height;
        const cameraZ = targetPos.z + config.camera.distance;
        
        const desiredCameraPosition = new T.Vector3(cameraX, cameraY, cameraZ);
        
        this.camera.position.lerp(desiredCameraPosition, config.camera.lerpFactor);

        // Look at a stable point at the player's base.
        const lookAtTarget = targetPos.clone();
        lookAtTarget.y = 1.0; 
        this.camera.lookAt(lookAtTarget);
    }
}