import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSeededRandom } from '../utils/SeededRandom.js';

const loader = new GLTFLoader();
const modelCache = new Map();

async function getModel(path) {
    if (modelCache.has(path)) {
        return modelCache.get(path).clone();
    }
    const gltf = await loader.loadAsync(path);
    let mesh = null;
    gltf.scene.traverse(node => {
        if (node.isMesh) {
            mesh = node;
        }
    });

    if (mesh) {
        modelCache.set(path, mesh);
        return mesh.clone();
    }
    console.error(`No mesh found in ${path}`);
    return null;
}

/**
 * Generates the data for all cactus instances for a specific chunk.
 * @param {number} chunkX - The x-coordinate of the chunk.
 * @param {number} chunkZ - The z-coordinate of the chunk.
 * @param {number} chunkSize - The size of the chunk.
 * @param {object[]} globalOccupiedPositions - Positions of objects (like gates) to avoid.
 * @returns {Promise<object[]>} A promise that resolves to an array of raw object data for the chunk.
 */
export async function generateChunkCacti(chunkX, chunkZ, chunkSize, globalOccupiedPositions) {
    
    const cactusFileNames = {
        small: ['cactus_1.glb', 'cactus_2.glb', 'cactus_3.glb'],
        medium: ['cactus_4.glb', 'cactus_5.glb', 'cactus_6.glb'],
        large: ['cactus_7.glb', 'cactus_8.glb', 'cactus_9.glb']
    };

    const cactusConfigs = {
        small: { scale: 1.5, count: 5, minDistance: 4 },
        medium: { scale: 2.5, count: 5, minDistance: 6 },
        large: { scale: 4.0, count: 5, minDistance: 10 },
    };

    const finalObjectData = [];

    // To solve border collisions, generate for a 3x3 grid and keep the center
    const neighborOccupiedPositions = [...globalOccupiedPositions];

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const currentChunkX = chunkX + i;
            const currentChunkZ = chunkZ + j;
            
            const seed = (currentChunkX * 19 + currentChunkZ * 47) * 23; // Different primes from rocks
            const seededRandom = createSeededRandom(seed);

            for (const category in cactusConfigs) {
                const config = cactusConfigs[category];
                const files = cactusFileNames[category];
                
                for (let k = 0; k < config.count; k++) {
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

                        if (i === 0 && j === 0) {
                            const modelFile = `cactus/${files[Math.floor(seededRandom() * files.length)]}`;
                            const model = await getModel(modelFile);

                            finalObjectData.push({
                                type: 'cactus',
                                model: model,
                                position: candidatePosition,
                                rotation: new T.Euler(-Math.PI / 2, 0, seededRandom() * Math.PI * 2),
                                scale: new T.Vector3(config.scale, config.scale, config.scale)
                            });
                        }
                    }
                }
            }
        }
    }
    
    return finalObjectData;
}