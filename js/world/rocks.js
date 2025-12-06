import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSeededRandom } from '../utils/SeededRandom.js';

// Using a simple cache for loaded models to avoid re-loading the same GLB file.
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


/**
 * Generates the data for all rock instances for a specific chunk.
 * @param {number} chunkX - The x-coordinate of the chunk.
 * @param {number} chunkZ - The z-coordinate of the chunk.
 * @param {number} chunkSize - The size of the chunk.
 * @param {object[]} globalOccupiedPositions - Positions of objects (like gates) to avoid.
 * @returns {Promise<object[]>} A promise that resolves to an array of raw object data for the chunk.
 */
export async function generateChunkRocks(chunkX, chunkZ, chunkSize, globalOccupiedPositions) {
    
    const rockFileNames = {
        big: ['big_rock_1.glb', 'big_rock_2.glb', 'big_rock_3.glb'],
        middle: ['middle_rock_1.glb', 'middle_rock_2.glb', 'middle_rock_3.glb', 'middle_rock_4.glb', 'middle_rock_5.glb'],
        small: ['small_rock_1.glb', 'small_rock_2.glb', 'small_rock_3.glb', 'small_rock_4.glb', 'small_rock_5.glb', 'small_rock_6.glb', 'small_rock_7.glb']
    };

    const rockConfigs = {
        big: { scale: 3.0, count: 1, chance: 0.585, minDistance: 12, multipart: true },
        middle: { scale: 1.5, count: 3, chance: 1.0, minDistance: 4, multipart: false },
        small: { scale: 1.5, count: 5, chance: 1.0, minDistance: 1.5, multipart: false },
    };

    const finalObjectData = [];
    const localOccupiedPositions = [];

    // --- To solve border collisions, we generate positions for a 3x3 grid of chunks ---
    // --- but only keep the ones for the central chunk (0,0) ---
    const neighborOccupiedPositions = [...globalOccupiedPositions];

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const currentChunkX = chunkX + i;
            const currentChunkZ = chunkZ + j;
            
            // Create a deterministic seed from the chunk coordinates
            const seed = (currentChunkX * 31 + currentChunkZ * 17) * 13;
            const seededRandom = createSeededRandom(seed);

            for (const category in rockConfigs) {
                const config = rockConfigs[category];
                const files = rockFileNames[category];
                
                // Determine how many to place based on count and chance
                let numToPlace = 0;
                for(let n = 0; n < config.count; n++) {
                    if (seededRandom() < config.chance) {
                        numToPlace++;
                    }
                }

                for (let k = 0; k < numToPlace; k++) {
                    let positionIsValid = false;
                    let candidatePosition;
                    let attempts = 0;

                    while (!positionIsValid && attempts < 20) {
                        const posX = (currentChunkX + seededRandom()) * chunkSize;
                        const posZ = (currentChunkZ + seededRandom()) * chunkSize;
                        candidatePosition = new T.Vector3(posX, 0, posZ);
                        
                        positionIsValid = true;
                        for (const pos of neighborOccupiedPositions) {
                            if (candidatePosition.distanceTo(pos) < config.minDistance) {
                                positionIsValid = false;
                                break;
                            }
                        }
                        attempts++;
                    }

                    if (positionIsValid) {
                        neighborOccupiedPositions.push(candidatePosition.clone());

                        // --- Only add the object if it's in the *central* chunk we're generating for ---
                        if (i === 0 && j === 0) {
                             const modelFile = `rocks/${files[Math.floor(seededRandom() * files.length)]}`;
                             const model = await getModel(modelFile);

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
            }
        }
    }
    
    return finalObjectData;
}