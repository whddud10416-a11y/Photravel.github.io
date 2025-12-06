import * as T from 'three';
import { initScene } from './scene.js';
import { createGround } from './world/ground.js';
import { createGates } from './world/gates.js';
import { Player } from './player.js';
import { CameraController } from './Camera.js';
import { GuideParticles } from './GuideParticles.js';
import { Navigation } from './Navigation.js';
import { UIManager } from './UIManager.js';
import { WorldManager } from './managers/WorldManager.js';
import { AtmosphericParticles } from './AtmosphericParticles.js';

export class Game {
    constructor() {
        // Scene essentials
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sky = null;
        this.stars = null;
        this.milkyWay = null;
        this.worldContainer = null;
        this.clock = new T.Clock();

        // Game state
        this.isPaused = false;
        this.isGameStarted = false;
        this.animationFrameId = null;

        // Player and controllers
        this.player = null;
        this.cameraController = null;
        
        // Managers
        this.worldManager = null;
        this.uiManager = null;

        // World objects
        this.gates = [];
        this.fadingGates = [];
        this.tileGroup = null;
        this.tileSize = 0;

        // UI and helpers
        this.guideParticles = null;
        this.navigation = null;
        this.atmosphericParticles = null;
    }

    init() {
        this.uiManager = new UIManager(this);
        const homeUrl = 'https://spinning-experiences-055746.framer.app/';
        this.uiManager.showIntroPopup(homeUrl);

        let loadingComplete = false;
        let firstInteractionOccurred = false;

        const tryShowButton = () => {
            if (loadingComplete && firstInteractionOccurred) {
                setTimeout(() => this.uiManager.showCloseButton(), 3000);
            }
        };

        const clickCatcher = document.getElementById('click-catcher');
        const onFirstInteraction = () => {
            if (firstInteractionOccurred) return;
            firstInteractionOccurred = true;

            if (clickCatcher) {
                clickCatcher.style.display = 'none';
            }
            
            tryShowButton();
            clickCatcher.removeEventListener('click', onFirstInteraction);
        };

        if (clickCatcher) {
            clickCatcher.addEventListener('click', onFirstInteraction);
        }

        this._loadAssets().then(() => {
            loadingComplete = true;
            tryShowButton();
        }).catch(error => {
            console.error("Fatal error during asset loading:", error);
            const errorContainer = document.getElementById('error-container');
            const errorMessage = document.getElementById('error-message');
            if (errorContainer && errorMessage) {
                errorMessage.textContent = error.stack || error;
                errorContainer.style.display = 'block';
            }
        });
    }

    async _loadAssets() {
        Object.assign(this, initScene());
        
        this.scene.add(new T.HemisphereLight(0xE0BBE4, 0xCE9FCD, 0.96));
        const directionalLight = new T.DirectionalLight(0xFFCCA8, 0.72);
        directionalLight.position.set(-100, 20, -100);
        this.scene.add(directionalLight);

        this.worldContainer = new T.Group();
        this.scene.add(this.worldContainer);

        const groundData = createGround(this.worldContainer);
        this.tileGroup = groundData.tileGroup;
        this.tileSize = groundData.tileSize;
        
        const gateOccupiedPositions = [];
        this.gates = await createGates(this.worldContainer, gateOccupiedPositions, 400);
        
        this.player = new Player(this.scene);
        await this.player.loadModels();
        
        this.worldManager = new WorldManager(this.worldContainer, this.gates);
        this.atmosphericParticles = new AtmosphericParticles(this.worldContainer);
        this.cameraController = new CameraController(this.camera, this.player);
        this.guideParticles = new GuideParticles(this.scene);
        this.navigation = new Navigation(this.gates, (gate) => this.onGatePassed(gate));
        
        await this.worldManager.update(new T.Vector3(0, 0, 0));

        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    onGatePassed(gate) {
        if (!this.fadingGates.includes(gate)) {
            this.fadingGates.push(gate);
        }
        const gateNumber = gate.userData.number;
        if (gateNumber) {
            const url = `https://spinning-experiences-055746.framer.app/popup/${gateNumber}`;
            this.uiManager.showGatePopup(url);
        }
    }

    pause() {
        this.isPaused = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.player && this.player.input) {
            this.player.input.reset();
        }
        if (this.cameraController) {
            this.cameraController.reset();
        }
        console.log("Game paused");
    }

    resume() {
        if (!this.isGameStarted) return;
        this.isPaused = false;
        this.clock.getDelta();
        this.animate();
        console.log("Game resumed");
    }

    start() {
        if (this.isGameStarted) return;
        this.isGameStarted = true;
        this.animate();
        console.log("Game started");
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
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

    updateFadingGates(deltaTime) {
        for (let i = this.fadingGates.length - 1; i >= 0; i--) {
            const gate = this.fadingGates[i];
            if (!gate.userData.isFading) {
                gate.userData.isFading = true;
                const fadingMaterial = new T.MeshStandardMaterial({ transparent: true, opacity: 1.0, color: 0xaaaaaa });
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
            const fadingMaterial = gate.userData.fadingMaterial;
            if (fadingMaterial && fadingMaterial.opacity > 0) {
                fadingMaterial.opacity -= 0.5 * deltaTime;
            } else if (fadingMaterial && fadingMaterial.opacity <= 0) {
                gate.visible = false;
                this.fadingGates.splice(i, 1);
            }
        }
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());
        if (this.isPaused) return;

        const deltaTime = this.clock.getDelta();
        const playerWorldPosition = new T.Vector3().copy(this.worldContainer.position).negate();

        this.worldManager.update(playerWorldPosition);
        this.worldManager.updateFlyingObjects(deltaTime);

        const displacement = this.player.update(deltaTime);
        if (displacement && displacement.lengthSq() > 0) {
            this.worldManager.handleCollisions(this.player, displacement);
        }

        this.cameraController.update();
        this.navigation.update(playerWorldPosition);
        this.atmosphericParticles.update(deltaTime, playerWorldPosition);
        this.updateInfiniteGround();

        const currentTargetGate = this.navigation.getCurrentTarget();
        if (currentTargetGate) {
            const gateWorldPos = currentTargetGate.getWorldPosition(new T.Vector3());
            this.guideParticles.update(deltaTime, this.player.model.position.clone().add(new T.Vector3(0, 2, 0)), gateWorldPos);
        } else {
            this.guideParticles.update(deltaTime, null, null);
        }

        this.sky.position.copy(this.camera.position);
        this.stars.position.copy(this.camera.position);
        this.milkyWay.position.copy(this.camera.position);
        this.stars.rotation.y += 1e-5;
        this.milkyWay.rotation.y += 2e-5;
        this.updateFadingGates(deltaTime);

        this.renderer.render(this.scene, this.camera);
    }
}
