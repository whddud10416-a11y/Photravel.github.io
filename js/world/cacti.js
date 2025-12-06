import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSeededRandom } from '../utils/SeededRandom.js';
import { getGroundHeight } from './ground.js';

// Module-level cache for models, but not for chunk data.
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
    large:  { scale: 4.0, count: 6, selfDistance: 200 },
    medium: { scale: 2.5, count: 9, selfDistance: 100 },
    small:  { scale: 1.5, count: 9, selfDistance: 50 },
};

const DISTANCE_MAP = {
    cactus: {
        differentSize: 60,
        rock: 30,
        gate: 30,
    }
};

/**
 * Generates cactus data for a specific chunk, checking against existing and neighbor positions.
 * @param {number} chunkX - The x-coordinate of the chunk.
 * @param {number} chunkZ - The z-coordinate of the chunk.
 * @param {number} chunkSize - The size of the chunk.
 * @param {object[]} allOccupiedPositions - An array of objects with {position, type, size} to check against.
 * @returns {Promise<object[]>} A promise that resolves to the array of generated cactus data for the chunk.
 */
export async function generateCactiDataForChunk(chunkX, chunkZ, chunkSize, allOccupiedPositions) {
    const finalObjectData = [];
    const seed = (chunkX * 19 + chunkZ * 47) * 23;
    const seededRandom = createSeededRandom(seed);

    // Process large cacti first, then medium, then small
    const categories = ['large', 'medium', 'small'];

    for (const category of categories) {
        const config = cactusConfigs[category];
        const files = cactusFileNames[category];
        
        for (let k = 0; k < config.count; k++) {
            let positionIsValid = false;
            let candidatePosition;
            let attempts = 0;

            while (!positionIsValid && attempts < 50) {
                const posX = (chunkX + seededRandom() - 0.5) * chunkSize;
                const posZ = (chunkZ + seededRandom() - 0.5) * chunkSize;
                const groundY = getGroundHeight(posX, posZ);
                candidatePosition = new T.Vector3(posX, groundY, posZ);
                
                positionIsValid = true;

                for (const occupied of allOccupiedPositions) {
                    const dist = candidatePosition.distanceTo(occupied.position);
                    let minAllowedDist = 0;

                    if (occupied.type === 'cactus') {
                        if (occupied.size === category) {
                            minAllowedDist = config.selfDistance;
                        } else {
                            minAllowedDist = DISTANCE_MAP.cactus.differentSize;
                        }
                    } else if (occupied.type === 'rock') {
                        minAllowedDist = DISTANCE_MAP.cactus.rock;
                    } else if (occupied.type === 'gate') {
                        minAllowedDist = DISTANCE_MAP.cactus.gate;
                    }

                    if (dist < minAllowedDist) {
                        positionIsValid = false;
                        break;
                    }
                }
                attempts++;
            }

            if (positionIsValid) {
                const newCactusInfo = {
                    position: candidatePosition.clone(),
                    type: 'cactus',
                    size: category
                };
                allOccupiedPositions.push(newCactusInfo);

                const modelFile = `cactus/${files[Math.floor(seededRandom() * files.length)]}`;
                const model = await getModel(modelFile);

                if (model) {
                     // Calculate bounding box to find the exact vertical offset needed for this specific model
                    const box = new T.Box3().setFromObject(model);
                    const verticalOffset = -box.min.y; // Distance from model's origin to its bottom

                    // Apply ground height plus the SCALED vertical offset
                    candidatePosition.y += (verticalOffset * config.scale);

                    finalObjectData.push({
                        type: 'cactus',
                        size: category,
                        model: model,
                        position: candidatePosition.clone(),
                        rotation: new T.Euler(-Math.PI / 2, 0, seededRandom() * Math.PI * 2),
                        scale: new T.Vector3(config.scale, config.scale, config.scale)
                    });
                }
            }
        }
    }
    
    return finalObjectData;
}
