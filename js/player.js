import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { InputController } from './InputController.js';
import { PlayerController } from './PlayerController.js';
import { JoystickController } from './JoystickController.js';

// Reverted to non-physics 'moving world' version.
export class Player {
    constructor(scene) {
        this.scene = scene;
        this.model = null;
        this.input = new InputController();
        this.controller = new PlayerController(this.input);
        this.mixer = null;
        this.animations = new Map();
        this.currentAction = null;
        this.joystick = null;

        // Conditionally create JoystickController for touch devices
        if ('ontouchstart' in window) {
            this.joystick = new JoystickController(this.input);
        }

        this.boundingBox = new T.Box3();
    }

    async loadModels() {
        const loader = new GLTFLoader();
        const chassisGltf = await loader.loadAsync('lp_car/fw.gltf');
        this.model = chassisGltf.scene;
        this.model.scale.set(3.0, 3.0, 3.0);
        this.model.position.y = 0.5;
        this.scene.add(this.model);

        this.mixer = new T.AnimationMixer(this.model);
        const animationGltf = await loader.loadAsync('lp_car/fw.gltf'); 
        // This assumes animations are in fw.gltf. A more robust solution
        // would be to load all gltfs as done in a previous version.
        animationGltf.animations.forEach(clip => {
            const action = this.mixer.clipAction(clip);
            const name = clip.name.toLowerCase() || 'idle';
            this.animations.set(name, action);
        });
        
        const idleAction = this.animations.get('idle') || this.animations.values().next().value;
        if (idleAction) {
            this.currentAction = idleAction;
            this.currentAction.play();
        }
        
        const headlightTarget = new T.Object3D();
        headlightTarget.position.set(10, 0, 0);
        this.model.add(headlightTarget);

        const createHeadlight = (x, y, z) => {
            const headlight = new T.SpotLight(0xffffff, 200, 200, Math.PI / 9, 0.5, 2);
            headlight.position.set(x, y, z);
            headlight.target = headlightTarget;
            this.model.add(headlight);
        };
        createHeadlight(0.5, 0.8, 1.0);
        createHeadlight(0.5, 0.8, -1.0);
        
        this.boundingBox.setFromObject(this.model);
    }

    playAnimation(name) {
        name = name.toLowerCase();
        if (this.currentAction && this.currentAction.name === name) return;
        const newAction = this.animations.get(name);
        if (!newAction) return;
        if (this.currentAction) this.currentAction.fadeOut(0.2);
        newAction.reset().fadeIn(0.2).play();
        this.currentAction = newAction;
        this.currentAction.name = name;
    }

    update(deltaTime) {
        if (!this.model) return null;

        const displacement = this.controller.update(null, deltaTime);
        
        this.model.quaternion.copy(this.controller.quaternion);

        const speed = this.controller.currentSpeed;
        if (this.mixer) this.mixer.update(deltaTime);

        if (this.currentAction) {
            const timeScale = speed / 10;
            this.currentAction.timeScale = timeScale;
        }

        this.boundingBox.setFromObject(this.model);
        
        return displacement;
    }
}