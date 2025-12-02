import * as T from 'three';
import { initScene } from './scene.js';
import { createGround, createRocks, createCacti, createGates } from './worldSetup.js';
import { Player } from './player.js';
import { CameraController } from './Camera.js';
import { GuideParticles } from './GuideParticles.js';
import { Navigation } from './Navigation.js';
import { UIManager } from './UIManager.js';

export class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sky = null;
        this.stars = null;
        this.milkyWay = null;

        this.player = null;
        this.cameraController = null;
        this.guideParticles = null;
        this.navigation = null;
        this.uiManager = null;
        
        this.worldContainer = null;
        this.obstacles = [];
        this.flyingObjects = [];
        this.gates = [];
        this.tileGroup = null;
        this.tileSize = 0;

        this.clock = new T.Clock();
        this.isPaused = false;
        this.animationFrameId = null;
    }

    async init() {
        // Scene setup
        const sceneData = initScene();
        this.scene = sceneData.scene;
        this.camera = sceneData.camera;
        this.renderer = sceneData.renderer;
        this.sky = sceneData.sky;
        this.stars = sceneData.stars;
        this.milkyWay = sceneData.milkyWay;

        // UI
        this.uiManager = new UIManager(this);

        // Lighting
        const ambientLight = new T.AmbientLight(0x606090, 0.4);
        this.scene.add(ambientLight);
        const directionalLight = new T.DirectionalLight(0xffffff, 0.3);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);

        // World
        this.worldContainer = new T.Group();
        this.scene.add(this.worldContainer);

        const groundData = createGround(this.worldContainer);
        this.tileGroup = groundData.tileGroup;
        this.tileSize = groundData.tileSize;
        
        const allObjectPositions = [];
        const rockObstacles = await createRocks(this.worldContainer, allObjectPositions);
        const cactusObstacles = await createCacti(this.worldContainer, allObjectPositions);
        this.obstacles = [...rockObstacles, ...cactusObstacles];
        
        this.gates = await createGates(this.worldContainer, allObjectPositions);

        // Player
        this.player = new Player(this.scene);
        await this.player.loadModels();

        // Controllers
        this.cameraController = new CameraController(this.camera, this.player);
        this.guideParticles = new GuideParticles(this.scene);
        this.navigation = new Navigation(this.gates, (gate) => this.onGatePassed(gate));

        // Event Listeners
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onGatePassed(gate) {
        if (gate.userData.number === 1) {
            const url = 'https://spinning-experiences-055746.framer.app/%EC%97%B0%EC%9D%B8';
            this.uiManager.showGatePopup(url);
        }
    }

    pause() {
        this.isPaused = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        console.log("Game paused");
    }

    resume() {
        this.isPaused = false;
        this.clock.getDelta(); // Reset clock delta
        this.animate();
        console.log("Game resumed");
    }

    start() {
        this.animate();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    updateFlyingObjects(deltaTime) {
        for (let i = this.flyingObjects.length - 1; i >= 0; i--) {
            const obj = this.flyingObjects[i];
            obj.flyVelocity.y -= 9.8 * deltaTime * 2;
            obj.mesh.position.add(obj.flyVelocity.clone().multiplyScalar(deltaTime));
            obj.mesh.rotation.x += obj.rotationSpeed.x * deltaTime;
            obj.mesh.rotation.y += obj.rotationSpeed.y * deltaTime;
            obj.mesh.rotation.z += obj.rotationSpeed.z * deltaTime;
            obj.flyVelocity.multiplyScalar(1 - (0.5 * deltaTime));
            if (obj.mesh.position.y < -10) {
                this.worldContainer.remove(obj.mesh);
                this.flyingObjects.splice(i, 1);
            }
        }
    }

    handleCollisions(displacement) {
        const worldDisplacement = displacement.clone().negate();

        const checkCollision = (disp) => {
            const playerWorldPosition = new T.Vector3().copy(this.worldContainer.position).negate();
            const nextPlayerBox = this.player.boundingBox.clone().translate(playerWorldPosition).translate(disp);
            for (const obstacle of this.obstacles) {
                const checkBoxes = obstacle.boxes || [obstacle.box];
                for (const box of checkBoxes) {
                    if (nextPlayerBox.intersectsBox(box)) return obstacle;
                }
            }
            return null;
        };

        const collidedObject = checkCollision(worldDisplacement);

        if (!collidedObject) {
            this.worldContainer.position.add(displacement);
        } else if (collidedObject.type === 'cactus') {
            this.worldContainer.position.add(displacement);
            const index = this.obstacles.indexOf(collidedObject);
            if (index > -1) this.obstacles.splice(index, 1);
            
            // Apply a fixed-speed impulse instead of using player velocity
            const launchDirection = displacement.clone().normalize();
            collidedObject.flyVelocity = launchDirection.multiplyScalar(-120); // Fly backward with a fixed speed of 120
            collidedObject.flyVelocity.y += 5 + Math.random() * 5; // Add upward force

            collidedObject.rotationSpeed = { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 10 };
            this.flyingObjects.push(collidedObject);
        } else { // Rocks
            const xOnlyDisplacement = new T.Vector3(displacement.x, 0, 0);
            if (!checkCollision(xOnlyDisplacement.clone().negate())) {
                this.worldContainer.position.add(xOnlyDisplacement);
            }
            const zOnlyDisplacement = new T.Vector3(0, 0, displacement.z);
            if (!checkCollision(zOnlyDisplacement.clone().negate())) {
                this.worldContainer.position.add(zOnlyDisplacement);
            }
        }
    }

    updateInfiniteGround() {
        if (!this.tileGroup) return;
        const playerX = -this.worldContainer.position.x;
        const playerZ = -this.worldContainer.position.z;
        const gridX = this.tileGroup.position.x;
        const gridZ = this.tileGroup.position.z;

        if (playerX - gridX > this.tileSize / 2) this.tileGroup.position.x += this.tileSize;
        else if (playerX - gridX < -this.tileSize / 2) this.tileGroup.position.x -= this.tileSize;
        if (playerZ - gridZ > this.tileSize / 2) this.tileGroup.position.z += this.tileSize;
        else if (playerZ - gridZ < -this.tileSize / 2) this.tileGroup.position.z -= this.tileSize;
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());

        if (this.isPaused) {
            return;
        }

        const deltaTime = this.clock.getDelta();

        this.updateFlyingObjects(deltaTime);

        const displacement = this.player.update(deltaTime);
        if (displacement && displacement.lengthSq() > 0) {
            this.handleCollisions(displacement);
        }

        this.cameraController.update();
        
        const playerWorldPosition = new T.Vector3().copy(this.worldContainer.position).negate();
        this.navigation.update(playerWorldPosition);
        const currentTargetGate = this.navigation.getCurrentTarget();

        // Update particle system
        if (currentTargetGate) {
            const particleStartPos = this.player.model.position.clone().add(new T.Vector3(0, 1, 0));
            // Use the gate's actual world position for the particle target, not the arrivalPoint
            const gateWorldPos = currentTargetGate.getWorldPosition(new T.Vector3());
            this.guideParticles.update(deltaTime, particleStartPos, gateWorldPos);
        } else {
            this.guideParticles.update(deltaTime, this.player.model.position, null);
        }

        this.updateInfiniteGround();

        this.sky.position.copy(this.camera.position);
        this.stars.rotation.y += 0.00001;
        this.milkyWay.rotation.y += 0.00002;

        this.renderer.render(this.scene, this.camera);
    }
}