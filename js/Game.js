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
        this.guideBurstCooldown = 0;
        
        this.worldContainer = null;
        this.obstacles = [];
        this.flyingObjects = [];
        this.gates = [];
        this.fadingGates = []; // Gates to be faded out
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
        const hemisphereLight = new T.HemisphereLight(0xE0BBE4, 0xCE9FCD, 0.96);
        this.scene.add(hemisphereLight);
        
        const directionalLight = new T.DirectionalLight(0xFFCCA8, 0.72);
        directionalLight.position.set(-100, 20, -100);
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
            // Add gate to be faded out, but only if it's not already being processed
            if (!this.fadingGates.includes(gate)) {
                this.fadingGates.push(gate);
            }
            
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
        
        // Update navigation and check for passed gates
        this.navigation.update(playerWorldPosition);
        const passedGate = this.navigation.getJustPassedGate();
        if (passedGate) {
            this.onGatePassed(passedGate);
        }

        const currentTargetGate = this.navigation.getCurrentTarget();
        
        if (currentTargetGate) {
            const gateWorldPos = currentTargetGate.getWorldPosition(new T.Vector3());
            const particleStartPos = this.player.model.position.clone().add(new T.Vector3(0, 2, 0));
            this.guideParticles.update(deltaTime, particleStartPos, gateWorldPos);
        } else {
            this.guideParticles.update(deltaTime, null, null);
        }

        this.updateInfiniteGround();

        this.sky.position.copy(this.camera.position);
        this.stars.rotation.y += 0.00001;
        this.milkyWay.rotation.y += 0.00002;

        this.updateFadingGates(deltaTime);

        this.renderer.render(this.scene, this.camera);
    }

    updateFadingGates(deltaTime) {
        for (let i = this.fadingGates.length - 1; i >= 0; i--) {
            const gate = this.fadingGates[i];

            // On the first frame of fading, swap all materials for a single new one
            if (!gate.userData.isFading) {
                gate.userData.isFading = true;
                
                const fadingMaterial = new T.MeshStandardMaterial({
                    transparent: true,
                    opacity: 1.0,
                    color: 0xaaaaaa // Default color
                });
                
                // Attempt to grab a color from the original materials
                const originalMaterial = gate.children[0]?.children[0]?.material;
                if(originalMaterial && originalMaterial.color) {
                    fadingMaterial.color.copy(originalMaterial.color);
                }

                gate.traverse(child => {
                    if (child.isMesh) {
                        child.material = fadingMaterial;
                    }
                });
                gate.userData.fadingMaterial = fadingMaterial;
            }

            // Now, just update the one shared material's opacity
            const fadingMaterial = gate.userData.fadingMaterial;
            if (fadingMaterial && fadingMaterial.opacity > 0) {
                fadingMaterial.opacity -= 0.5 * deltaTime;
            } else if (fadingMaterial && fadingMaterial.opacity <= 0) {
                gate.visible = false; // Hide the whole object
                this.fadingGates.splice(i, 1);
            }
        }
    }
}