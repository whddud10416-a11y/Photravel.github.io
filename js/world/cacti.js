import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSeededRandom } from '../utils/SeededRandom.js';

// Module-level caches
const cactiDataCache = new Map();
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

const cactusFileNames = {
    small: ['cactus_1.glb', 'cactus_2.glb', 'cactus_3.glb'],
    medium: ['cactus_4.glb', 'cactus_5.glb', 'cactus_6.glb'],
    large: ['cactus_7.glb', 'cactus_8.glb', 'cactus_9.glb']
};

const cactusConfigs = {
    small: { scale: 1.5, count: 15, minDistance: 4 },
    medium: { scale: 2.5, count: 15, minDistance: 6 },
    large: { scale: 4.0, count: 10, minDistance: 10 },
};

/**
 * Recursively gets or generates cactus data for a specific chunk.
 * @param {number} chunkX - The x-coordinate of the chunk.
 * @param {number} chunkZ - The z-coordinate of the chunk.
 * @param {number} chunkSize - The size of the chunk.
 * @param {T.Vector3[]} globalOccupiedPositions - Positions of global objects (gates) to avoid.
 * @returns {Promise<object[]>} A promise that resolves to the array of raw object data for the chunk.
 */
export async function getOrGenerateCactiDataForChunk(chunkX, chunkZ, chunkSize, globalOccupiedPositions) {
    const chunkId = `${chunkX}_${chunkZ}`;
    if (cactiDataCache.has(chunkId)) {
        return cactiDataCache.get(chunkId);
    }

    // --- Non-Recursive Generation logic ---
    const finalObjectData = [];
    const internalPositions = []; // Keep track of positions within this chunk
    const seed = (chunkX * 19 + chunkZ * 47) * 23;
    const seededRandom = createSeededRandom(seed);

    for (const category in cactusConfigs) {
        const config = cactusConfigs[category];
        const files = cactusFileNames[category];
        
        for (let k = 0; k < config.count; k++) {
            let positionIsValid = false;
            let candidatePosition;
            let attempts = 0;

            while (!positionIsValid && attempts < 20) {
                const posX = (chunkX + seededRandom() - 0.5) * chunkSize;
                const posZ = (chunkZ + seededRandom() - 0.5) * chunkSize;
                candidatePosition = new T.Vector3(posX, 0, posZ);
                
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
                internalPositions.push(candidatePosition.clone());
                const modelFile = `cactus/${files[Math.floor(seededRandom() * files.length)]}`;
                const model = await getModel(modelFile);

                if (model) {
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
    
    cactiDataCache.set(chunkId, finalObjectData);
    return finalObjectData;
}