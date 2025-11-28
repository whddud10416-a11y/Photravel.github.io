import * as THREE from 'three';

// Reverted to non-physics 'moving world' version.
export class PlayerController {
    constructor(input) {
        this.input = input;

        this.maxSpeed = 33.0;
        this.sprintMultiplier = 1.8;
        this.turnSpeed = 2.5;
        this.currentSpeed = 0;
        this.acceleration = 25.0;
        this.deceleration = 35.0;

        this.quaternion = new THREE.Quaternion();
        this.displacement = new THREE.Vector3();
        this.upAxis = new THREE.Vector3(0, 1, 0);
    }

    update(_, deltaTime) { // 'body' argument is not used
        const keys = this.input.keysPressed;

        let targetSpeed = 0;
        if (keys['w']) {
            targetSpeed = this.maxSpeed;
            if (keys['shift']) {
                targetSpeed *= this.sprintMultiplier;
            }
        } else if (keys['s']) {
            targetSpeed = -this.maxSpeed * 0.8;
        }
        
        const accel = (Math.abs(targetSpeed) > 0) ? this.acceleration : this.deceleration;
        this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, accel * deltaTime);
        if (Math.abs(this.currentSpeed) < 0.01) {
            this.currentSpeed = 0;
        }

        if (Math.abs(this.currentSpeed) > 0.1) {
            let turnAngle = 0;
            if (keys['a']) {
                turnAngle = this.turnSpeed * deltaTime;
            } else if (keys['d']) {
                turnAngle = -this.turnSpeed * deltaTime;
            }
            if (this.currentSpeed < 0) {
                turnAngle *= -1;
            }
            if (turnAngle !== 0) {
                const turnQuaternion = new THREE.Quaternion().setFromAxisAngle(this.upAxis, turnAngle);
                this.quaternion.multiply(turnQuaternion);
            }
        }

        const moveDistance = this.currentSpeed * deltaTime;
        const forwardVector = new THREE.Vector3(1, 0, 0);
        forwardVector.applyQuaternion(this.quaternion);
        
        this.displacement.copy(forwardVector).multiplyScalar(-moveDistance);
        
        return this.displacement;
    }
}
