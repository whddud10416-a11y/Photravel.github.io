import * as T from 'three';
import { ChunkManager } from './ChunkManager.js';
import { SpatialGrid } from './SpatialGrid.js';
import { getGroundHeight } from '../world/ground.js';
import { generateRockDataForChunk } from '../world/rocks.js';
import { generateCactiDataForChunk } from '../world/cacti.js';

const CHUNK_SIZE = 400;
const RENDER_DISTANCE = 2;

export class WorldManager {
    constructor(worldContainer, gates) {
        this.worldContainer = worldContainer;
        this.gates = gates;

        this.chunkManager = new ChunkManager(CHUNK_SIZE);
        this.spatialGrid = new SpatialGrid(50000, 50000, 100);
        this.activeObstacles = new Map();
        this.flyingObjects = [];
        this.playerChunkId = null;
    }

    async update(playerWorldPosition) {
        // --- Chunk updates based on player position (Optimized) ---
        const playerChunkX = Math.floor(playerWorldPosition.x / CHUNK_SIZE);
        const playerChunkZ = Math.floor(playerWorldPosition.z / CHUNK_SIZE);
        const newPlayerChunkId = `${playerChunkX}_${playerChunkZ}`;

        if (newPlayerChunkId !== this.playerChunkId) {
            this.playerChunkId = newPlayerChunkId;
            
            const { chunksToLoad, chunksToUnload } = this.chunkManager.update(playerWorldPosition, RENDER_DISTANCE);

            chunksToUnload.forEach(id => this.unloadChunk(id));
            
            if (chunksToLoad.length > 0) {
                for (const id of chunksToLoad) {
                    await this.loadChunk(id);
                }
            }
        }
    }

    async loadChunk(chunkId) {
        if (this.chunkManager.getChunkMeshGroup(chunkId)) return;

        const [chunkX, chunkZ] = chunkId.split('_').map(Number);
        
        const rockData = await generateRockDataForChunk(chunkX, chunkZ, CHUNK_SIZE);
        const cactusData = await generateCactiDataForChunk(chunkX, chunkZ, CHUNK_SIZE);
        const potentialChunkData = [...rockData, ...cactusData];

        const group = new T.Group();
        group.name = `chunk_${chunkId}`;
        
        const validatedChunkObstacles = [];
        let objectsProcessed = 0;

        for (const data of potentialChunkData) {
            if (++objectsProcessed % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const { position, scale, config, model } = data;
            
            const modelBox = new T.Box3().setFromObject(model);
            const size = modelBox.getSize(new T.Vector3()).multiply(scale);
            const tempBox = new T.Box3().setFromCenterAndSize(position, size);

            let isOverlapping = false;
            
            for (const gate of this.gates) {
                if (tempBox.intersectsBox(new T.Box3().setFromObject(gate))) {
                    isOverlapping = true;
                    break;
                }
            }
            if (isOverlapping) continue;

            const checkRadius = Math.max(size.x, size.z) / 2 + 150;
            const nearbyGlobalObstacles = this.spatialGrid.getNearby(position, checkRadius);
            for (const occupied of nearbyGlobalObstacles) {
                const occupiedBox = occupied.boxes ? occupied.boxes[0].clone().union(occupied.boxes[1]).union(occupied.boxes[2]) : occupied.box;
                if (tempBox.intersectsBox(occupiedBox)) {
                    isOverlapping = true;
                    break;
                }
            }
            if (isOverlapping) continue;

            for (const placed of validatedChunkObstacles) {
                const placedBox = placed.boxes ? placed.boxes[0].clone().union(placed.boxes[1]).union(placed.boxes[2]) : placed.box;
                if (!placedBox) continue;

                const checkA = tempBox.clone();
                const checkB = placedBox.clone();
                checkA.min.y = -Infinity;
                checkA.max.y = Infinity;
                checkB.min.y = -Infinity;
                checkB.max.y = Infinity;
                if (checkA.intersectsBox(checkB)) {
                    isOverlapping = true;
                    break;
                }
            }
            if (isOverlapping) continue;

            const halfWidth = size.x / 2;
            const halfDepth = size.z / 2;
            const corners = [
                { x: position.x - halfWidth, z: position.z - halfDepth },
                { x: position.x + halfWidth, z: position.z - halfDepth },
                { x: position.x - halfWidth, z: position.z + halfDepth },
                { x: position.x + halfWidth, z: position.z + halfDepth },
            ];

            let maxCornerHeight = -Infinity;
            corners.forEach(corner => {
                maxCornerHeight = Math.max(maxCornerHeight, getGroundHeight(corner.x, corner.z));
            });
            
            let verticalOffset = -modelBox.min.y;
            if (data.type === 'rock' && data.size === 'big' && verticalOffset > 1.0) {
                verticalOffset = 0.7; // Clamp faulty big rock models
            } else if (data.type === 'rock' && data.size === 'small' && verticalOffset > 0.5) {
                verticalOffset = 0.05; // Clamp faulty small rock models
            }
            
            position.y = maxCornerHeight + (verticalOffset * scale.y);
            
            
            const mesh = model.clone();
            mesh.position.copy(position);
            mesh.rotation.copy(data.rotation);
            mesh.scale.copy(scale);
            
            let obstacle;
            const finalBox = new T.Box3().setFromObject(mesh);
            if (data.multipart) {
                const boxes = [];
                const partSize = finalBox.getSize(new T.Vector3()).x / 3;
                for(let i = -1; i <= 1; i++) {
                   const center = finalBox.getCenter(new T.Vector3());
                   center.x += i * partSize;
                   boxes.push(new T.Box3().setFromCenterAndSize(center, new T.Vector3(partSize, size.y, size.z)));
                }
                obstacle = { type: data.type, mesh, boxes, sourceData: data, chunkId };
            } else {
                obstacle = { type: data.type, mesh, box: finalBox, sourceData: data, chunkId };
            }
            
            validatedChunkObstacles.push(obstacle);
            group.add(mesh);
        }

        for (const obs of validatedChunkObstacles) {
            this.activeObstacles.set(obs.mesh.uuid, obs);
            this.spatialGrid.add(obs);
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

    handleCollisions(player, displacement) {
        const worldDisplacement = displacement.clone().negate();
        const playerWorldPosition = new T.Vector3().copy(this.worldContainer.position).negate();
        const nextPlayerPosition = playerWorldPosition.clone().add(worldDisplacement);
        const playerBox = player.boundingBox.clone().translate(nextPlayerPosition);

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

            const isSprinting = player.controller.currentSpeed > player.controller.maxSpeed;
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
                obj.mesh.geometry?.dispose();
                if(obj.mesh.material.map) obj.mesh.material.map.dispose();
                obj.mesh.material?.dispose();
                this.flyingObjects.splice(i, 1);
            }
        }
    }
}
