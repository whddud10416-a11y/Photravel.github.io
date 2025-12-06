import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSeededRandom } from '../utils/SeededRandom.js';
import { getGroundHeight } from './ground.js';

// Module-level cache for generated chunk data to ensure persistence.
const rockDataCache = new Map();
const loader = new GLTFLoader();
const modelCache = new Map();

async function getModel(path) {
    if (modelCache.has(path)) {
        return modelCache.get(path).clone();
    }
    const gltf = await loader.loadAsync(path);
    modelCache.set(path, gltf.scene);
    return gltf.scene.clone();
}

const rockFileNames = {
    big: ['big_rock_1.glb', 'big_rock_2.glb', 'big_rock_3.glb'],
    middle: ['middle_rock_1.glb', 'middle_rock_2.glb', 'middle_rock_3.glb', 'middle_rock_4.glb', 'middle_rock_5.glb'],
    small: ['small_rock_1.glb', 'small_rock_2.glb', 'small_rock_3.glb', 'small_rock_4.glb', 'small_rock_5.glb', 'small_rock_6.glb', 'small_rock_7.glb']
};

const rockConfigs = {
    big: { scale: 3.0, count: 1, chance: 0.585, minDistance: 12, multipart: true },
    middle: { scale: 1.5, count: 5, chance: 1.0, minDistance: 4, multipart: false },
    small: { scale: 1.5, count: 10, chance: 1.0, minDistance: 1.5, multipart: false },
};

/**
 * Recursively gets or generates rock data for a specific chunk, ensuring no overlaps at borders.
 * @param {number} chunkX - The x-coordinate of the chunk.
 * @param {number} chunkZ - The z-coordinate of the chunk.
 * @param {number} chunkSize - The size of the chunk.
 * @param {T.Vector3[]} globalOccupiedPositions - Positions of global objects (gates) to avoid.
 * @returns {Promise<object[]>} A promise that resolves to the array of raw object data for the chunk.
 */
export async function getOrGenerateRockDataForChunk(chunkX, chunkZ, chunkSize, globalOccupiedPositions) {
    const chunkId = `${chunkX}_${chunkZ}`;
    if (rockDataCache.has(chunkId)) {
        return rockDataCache.get(chunkId);
    }

    // --- Non-Recursive Generation logic ---
    const finalObjectData = [];
    const internalPositions = []; // Keep track of positions within this chunk
    const seed = (chunkX * 31 + chunkZ * 17) * 13;
    const seededRandom = createSeededRandom(seed);

    for (const category in rockConfigs) {
        const config = rockConfigs[category];
        const files = rockFileNames[category];
        
        let numToPlace = 0;
        for (let n = 0; n < config.count; n++) {
            if (seededRandom() < config.chance) {
                numToPlace++;
            }
        }

        for (let k = 0; k < numToPlace; k++) {
            let positionIsValid = false;
            let candidatePosition;
            let attempts = 0;
            let groundY; // Declare groundY here to make it accessible in the outer scope

            while (!positionIsValid && attempts < 20) {
                const posX = (chunkX + seededRandom() - 0.5) * chunkSize;
                const posZ = (chunkZ + seededRandom() - 0.5) * chunkSize;
                groundY = getGroundHeight(posX, posZ); // Assign value here
                candidatePosition = new T.Vector3(posX, groundY, posZ);
                
                positionIsValid = true;
                
                // Check against global objects (e.g., gates)
                for (const pos of globalOccupiedPositions) {
                    if (candidatePosition.distanceTo(pos) < config.minDistance) {
                        positionIsValid = false;
                        break;
                    }
                }
                if (!positionIsValid) { attempts++; continue; }

                // Check against objects already placed in THIS chunk
                for (const pos of internalPositions) {
                    if (candidatePosition.distanceTo(pos) < config.minDistance) {
                        positionIsValid = false;
                        break;
                    }
                }
                attempts++;
            }

            if (positionIsValid) {
                // Add to this chunk's internal position list
                internalPositions.push(candidatePosition.clone());

                const modelFile = `rocks/${files[Math.floor(seededRandom() * files.length)]}`;
                const model = await getModel(modelFile);

                // Calculate bounding box to find the exact vertical offset needed for this specific model
                const box = new T.Box3().setFromObject(model);
                const verticalOffset = -box.min.y; // Distance from model's origin to its bottom

                // Apply ground height plus the SCALED vertical offset
                candidatePosition.y += (verticalOffset * config.scale);
                
                finalObjectData.push({
                    type: 'rock',
                    model: model,
                    position: candidatePosition,
                    rotation: new T.Euler(0, seededRandom() * Math.PI * 2, 0),
                    scale: new T.Vector3(config.scale, config.scale, config.scale),
                    multipart: config.multipart
                });
            }
        }
    }
    
    // Cache the result and return it.
    rockDataCache.set(chunkId, finalObjectData);
    return finalObjectData;
}