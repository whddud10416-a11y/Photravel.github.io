import * as T from 'three';
import { initScene } from './scene.js';
import { createGround } from './world/ground.js';
import { generateRockDataForChunk } from './world/rocks.js';
import { generateCactiDataForChunk } from './world/cacti.js';
import { createGates } from './world/gates.js';
import { Player } from './player.js';
import { CameraController } from './Camera.js';
import { GuideParticles } from './GuideParticles.js';
import { Navigation } from './Navigation.js';
import { UIManager } from './UIManager.js';
import { SpatialGrid } from './managers/SpatialGrid.js';
import { ChunkManager } from './managers/ChunkManager.js';
import { AtmosphericParticles } from './AtmosphericParticles.js';

const CHUNK_SIZE = 400;
const RENDER_DISTANCE = 2; // in chunks

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
        
        // World and object management
        this.chunkManager = new ChunkManager(CHUNK_SIZE);
        this.rockDataCache = new Map();
        this.cactiDataCache = new Map();
        this.spatialGrid = new SpatialGrid(50000, 50000, 100);
        this.activeObstacles = new Map(); // Map from mesh.uuid to obstacle data
        this.flyingObjects = [];
        this.gates = [];
        this.gateOccupiedPositions = [];
        this.fadingGates = [];
        this.tileGroup = null;
        this.tileSize = 0;

        // UI and helpers
        this.uiManager = null;
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

        const overlayContainer = document.getElementById('overlay-container');
        let blurHandler, pointerDownHandler;

        const onFirstInteraction = () => {
            if (firstInteractionOccurred) return;
            firstInteractionOccurred = true;
            tryShowButton();
            window.removeEventListener('blur', blurHandler);
            overlayContainer.removeEventListener('pointerdown', pointerDownHandler);
        };

        blurHandler = () => setTimeout(() => {
            if (document.activeElement === document.getElementById('overlay-iframe')) onFirstInteraction();
        }, 0);

        pointerDownHandler = () => onFirstInteraction();

        window.addEventListener('blur', blurHandler);
        overlayContainer.addEventListener('pointerdown', pointerDownHandler);

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
        
        this.gates = await createGates(this.worldContainer, this.gateOccupiedPositions, CHUNK_SIZE);
        
        this.player = new Player(this.scene);
        await this.player.loadModels();
        
        this.atmosphericParticles = new AtmosphericParticles(this.worldContainer);
        this.cameraController = new CameraController(this.camera, this.player);
        this.guideParticles = new GuideParticles(this.scene);
        this.navigation = new Navigation(this.gates, (gate) => this.onGatePassed(gate));
        
        await this.updateChunks(new T.Vector3(0, 0, 0), true);

        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    async updateChunks(playerPos, force = false) {
        const { chunksToLoad, chunksToUnload } = this.chunkManager.update(playerPos, RENDER_DISTANCE);

        chunksToUnload.forEach(id => this.unloadChunk(id));
        
        const allChunksToProcess = [...chunksToLoad];
        if (force) {
            this.chunkManager.activeChunkIds.forEach(id => {
                if (!allChunksToProcess.includes(id)) {
                    allChunksToProcess.push(id);
                }
            });
        }
        
        if (allChunksToProcess.length > 0) {
            // console.log(`Sequentially loading ${allChunksToProcess.length} chunks.`);
            for (const id of allChunksToProcess) {
                await this.loadChunk(id);
            }
        }
    }

    async loadChunk(chunkId) {
        if (this.chunkManager.getChunkMeshGroup(chunkId)) return;

        const [chunkX, chunkZ] = chunkId.split('_').map(Number);
        
        // --- This is the core logic for preventing duplicates ---
        // 1. Start with global gate positions.
        const allOccupiedPositions = this.gateOccupiedPositions.map(p => ({
            position: p, type: 'gate', size: 'gate'
        }));

        // 2. Collect data from all 8 neighbors + current chunk (if already cached)
        for (let x = chunkX - 1; x <= chunkX + 1; x++) {
            for (let z = chunkZ - 1; z <= chunkZ + 1; z++) {
                const neighborId = `${x}_${z}`;
                const rockCache = this.rockDataCache.get(neighborId);
                if (rockCache) {
                    rockCache.forEach(d => allOccupiedPositions.push({ ...d, type: 'rock' }));
                }
                const cactusCache = this.cactiDataCache.get(neighborId);
                if (cactusCache) {
                    cactusCache.forEach(d => allOccupiedPositions.push({ ...d, type: 'cactus' }));
                }
            }
        }
        
        // 3. Generate new data if not in cache
        let rockData = this.rockDataCache.get(chunkId);
        if (!rockData) {
            rockData = await generateRockDataForChunk(chunkX, chunkZ, CHUNK_SIZE, allOccupiedPositions);
            this.rockDataCache.set(chunkId, rockData);
        }
        
        let cactusData = this.cactiDataCache.get(chunkId);
        if (!cactusData) {
            cactusData = await generateCactiDataForChunk(chunkX, chunkZ, CHUNK_SIZE, allOccupiedPositions);
            this.cactiDataCache.set(chunkId, cactusData);
        }
        
        const chunkData = [...rockData, ...cactusData];

        if (chunkData.length === 0) {
            const emptyGroup = new T.Group();
            emptyGroup.name = `chunk_${chunkId}`;
            this.worldContainer.add(emptyGroup);
            this.chunkManager.setChunkMeshGroup(chunkId, emptyGroup);
            return;
        };
        
        const group = new T.Group();
        group.name = `chunk_${chunkId}`;
        
        for (const data of chunkData) {
            const mesh = data.model.clone();
            mesh.position.copy(data.position);
            mesh.rotation.copy(data.rotation);
            mesh.scale.copy(data.scale);
            group.add(mesh);

            let obstacle;
            if (data.multipart) { // Big rocks
                const aabb = new T.Box3().setFromObject(mesh);
                const size = new T.Vector3(); aabb.getSize(size);
                const center = new T.Vector3(); aabb.getCenter(center);
                const numBoxes = 3;
                const subBoxes = [];
                const mainAxisSize = (size.x > size.z) ? size.x : size.z;
                const subBoxSize = mainAxisSize / numBoxes;
                
                for (let j = 0; j < numBoxes; j++) {
                    const boxCenter = new T.Vector3(center.x, center.y, center.z);
                    const newSize = new T.Vector3(size.x, size.y, size.z);
                    if (size.x > size.z) {
                       boxCenter.x = center.x - size.x / 2 + subBoxSize * (j + 0.5);
                       newSize.x = subBoxSize;
                       newSize.z *= 0.8;
                    } else {
                       boxCenter.z = center.z - size.z / 2 + subBoxSize * (j + 0.5);
                       newSize.z = subBoxSize;
                       newSize.x *= 0.8;
                    }
                    const subBox = new T.Box3().setFromCenterAndSize(boxCenter, newSize);
                    subBox.min.y += size.y * 0.15;
                    subBoxes.push(subBox);
                }
                obstacle = { type: data.type, mesh: mesh, boxes: subBoxes, sourceData: data, chunkId: chunkId };
            } else { // Small/medium rocks and cacti
                const tempBox = new T.Box3().setFromObject(mesh);
                const size = new T.Vector3(); tempBox.getSize(size);
                const center = new T.Vector3(); tempBox.getCenter(center);
                const newSize = new T.Vector3(size.x * 0.7, size.y, size.z * 0.7);
                const scaledBox = new T.Box3().setFromCenterAndSize(center, newSize);
                scaledBox.min.y += size.y * 0.15;
                obstacle = { type: data.type, mesh: mesh, box: scaledBox, sourceData: data, chunkId: chunkId };
            }
            this.activeObstacles.set(mesh.uuid, obstacle);
            this.spatialGrid.add(obstacle);
        }

        this.worldContainer.add(group);
        this.chunkManager.setChunkMeshGroup(chunkId, group);
    }

    unloadChunk(chunkId) {
        const group = this.chunkManager.getChunkMeshGroup(chunkId);
        if (!group) return;

        for (let i = group.children.length - 1; i >= 0; i--) {
            const mesh = group.children[i];
            const obstacle = this.activeObstacles.get(mesh.uuid);
            if (obstacle) {
                this.spatialGrid.remove(obstacle);
                this.activeObstacles.delete(mesh.uuid);
            }
            mesh.geometry?.dispose();
            if(mesh.material.map) mesh.material.map.dispose();
            mesh.material?.dispose();
        }
        this.worldContainer.remove(group);
        this.chunkManager.setChunkMeshGroup(chunkId, null);
    }
    
    handleCollisions(displacement) {
        const worldDisplacement = displacement.clone().negate();
        const playerWorldPosition = new T.Vector3().copy(this.worldContainer.position).negate();
        const nextPlayerPosition = playerWorldPosition.clone().add(worldDisplacement);
        const playerBox = this.player.boundingBox.clone().translate(nextPlayerPosition);

        let collidedObstacle = null;
        let collidedBox = null;
        
        const nearbyObstacles = this.spatialGrid.getNearby(playerWorldPosition, 50);

        for (const obstacle of nearbyObstacles) {
            const checkBoxes = obstacle.boxes || [obstacle.box];
            for (const box of checkBoxes) {
                if (playerBox.intersectsBox(box)) {
                    collidedObstacle = obstacle;
                    collidedBox = box;
                    break;
                }
            }
            if (collidedObstacle) break;
        }

        if (!collidedObstacle) {
            this.worldContainer.position.add(displacement);
        } else if (collidedObstacle.type === 'cactus') {
            this.worldContainer.position.add(displacement);
            
            const group = this.chunkManager.getChunkMeshGroup(collidedObstacle.chunkId);
            group?.remove(collidedObstacle.mesh);

            this.spatialGrid.remove(collidedObstacle);
            this.activeObstacles.delete(collidedObstacle.mesh.uuid);

            const isSprinting = this.player.controller.currentSpeed > this.player.controller.maxSpeed;
            const launchMagnitude = isSprinting ? -120 : -60;
            const launchDirection = displacement.clone().normalize();
            
            collidedObstacle.flyVelocity = launchDirection.multiplyScalar(launchMagnitude);
            collidedObstacle.flyVelocity.y += 5 + Math.random() * 5;
            collidedObstacle.rotationSpeed = { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 10 };
            
            this.worldContainer.add(collidedObstacle.mesh);
            this.flyingObjects.push(collidedObstacle);

        } else { // It's a rock, so we slide
            const mtv = new T.Vector3();
            const overlapX1 = playerBox.max.x - collidedBox.min.x;
            const overlapX2 = collidedBox.max.x - playerBox.min.x;
            const overlapZ1 = playerBox.max.z - collidedBox.min.z;
            const overlapZ2 = collidedBox.max.z - playerBox.min.z;
            let minOverlap = Infinity;
            if (overlapX1 > 0 && overlapX1 < minOverlap) { minOverlap = overlapX1; mtv.set(-overlapX1, 0, 0); }
            if (overlapX2 > 0 && overlapX2 < minOverlap) { minOverlap = overlapX2; mtv.set(overlapX2, 0, 0); }
            if (overlapZ1 > 0 && overlapZ1 < minOverlap) { minOverlap = overlapZ1; mtv.set(0, 0, -overlapZ1); }
            if (overlapZ2 > 0 && overlapZ2 < minOverlap) { minOverlap = overlapZ2; mtv.set(0, 0, overlapZ2); }
            
            const correctedPlayerPosition = nextPlayerPosition.clone().add(mtv);
            const newWorldContainerPosition = correctedPlayerPosition.clone().negate();
            this.worldContainer.position.copy(newWorldContainerPosition);
        }
    }

    onGatePassed(gate) { if (!this.fadingGates.includes(gate)) { this.fadingGates.push(gate); } const gateNumber = gate.userData.number; if (gateNumber) { const url = `https://spinning-experiences-055746.framer.app/popup/${gateNumber}`; this.uiManager.showGatePopup(url); } }
    pause() { this.isPaused = true; if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; } if (this.player && this.player.input) { this.player.input.reset(); } if (this.cameraController) { this.cameraController.reset(); } console.log("Game paused"); }
    resume() { if (!this.isGameStarted) return; this.isPaused = false; this.clock.getDelta(); this.animate(); console.log("Game resumed"); }
    start() { if (this.isGameStarted) return; this.isGameStarted = true; this.animate(); console.log("Game started"); }
    onWindowResize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); }
    updateFlyingObjects(deltaTime) { for (let i = this.flyingObjects.length - 1; i >= 0; i--) { const obj = this.flyingObjects[i]; obj.flyVelocity.y -= 9.8 * deltaTime * 2; obj.mesh.position.add(obj.flyVelocity.clone().multiplyScalar(deltaTime)); obj.mesh.rotation.x += obj.rotationSpeed.x * deltaTime; obj.mesh.rotation.y += obj.rotationSpeed.y * deltaTime; obj.mesh.rotation.z += obj.rotationSpeed.z * deltaTime; obj.flyVelocity.multiplyScalar(1 - (0.5 * deltaTime)); if (obj.mesh.position.y < -10) { this.worldContainer.remove(obj.mesh); obj.mesh.geometry?.dispose(); if(obj.mesh.material.map) obj.mesh.material.map.dispose(); obj.mesh.material?.dispose(); this.flyingObjects.splice(i, 1); } } }
    updateInfiniteGround() { if (!this.tileGroup) return; const playerX = -this.worldContainer.position.x; const playerZ = -this.worldContainer.position.z; const gridX = this.tileGroup.position.x; const gridZ = this.tileGroup.position.z; if (playerX - gridX > this.tileSize / 2) this.tileGroup.position.x += this.tileSize; else if (playerX - gridX < -this.tileSize / 2) this.tileGroup.position.x -= this.tileSize; if (playerZ - gridZ > this.tileSize / 2) this.tileGroup.position.z += this.tileSize; else if (playerZ - gridZ < -this.tileSize / 2) this.tileGroup.position.z -= this.tileSize; }
    updateFadingGates(deltaTime) { for (let i = this.fadingGates.length - 1; i >= 0; i--) { const gate = this.fadingGates[i]; if (!gate.userData.isFading) { gate.userData.isFading = true; const fadingMaterial = new T.MeshStandardMaterial({ transparent: true, opacity: 1.0, color: 0xaaaaaa }); const originalMaterial = gate.children[0]?.children[0]?.material; if(originalMaterial && originalMaterial.color) { fadingMaterial.color.copy(originalMaterial.color); } gate.traverse(child => { if (child.isMesh) { child.material = fadingMaterial; } }); gate.userData.fadingMaterial = fadingMaterial; } const fadingMaterial = gate.userData.fadingMaterial; if (fadingMaterial && fadingMaterial.opacity > 0) { fadingMaterial.opacity -= 0.5 * deltaTime; } else if (fadingMaterial && fadingMaterial.opacity <= 0) { gate.visible = false; this.fadingGates.splice(i, 1); } } }

    animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());
        if (this.isPaused) return;

        const deltaTime = this.clock.getDelta();
        const playerWorldPosition = new T.Vector3().copy(this.worldContainer.position).negate();

        this.updateChunks(playerWorldPosition);
        this.updateFlyingObjects(deltaTime);

        const displacement = this.player.update(deltaTime);
        if (displacement && displacement.lengthSq() > 0) {
            this.handleCollisions(displacement);
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