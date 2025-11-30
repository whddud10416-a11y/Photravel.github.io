export const config = {
    // Player
    player: {
        maxSpeed: 12.0,
        turnSpeed: 2.0,
        acceleration: 0.05,
        deceleration: 0.15,
        sprintMultiplier: 1.5,
    },

    // Camera
    camera: {
        fov: 75,
        near: 0.1,
        far: 2000,
        initialPosition: { x: 0, y: 10, z: 40 },
        distance: 28,
        height: 20,
        lerpFactor: 0.1,
    },

    // World
    world: {
        groundSize: 8000,
        textureRepeat: 200,
        duneHeight: 1.5,
        duneFrequency: 30,
    },

    // Lighting
    lights: {
        ambientIntensity: 0.6,
        directionalIntensity: 1.5,
        directionalPosition: { x: 50, y: 50, z: 25 },
    },
};