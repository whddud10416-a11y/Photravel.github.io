import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSeededRandom } from '../utils/SeededRandom.js';

// Module-level cache for models, but not for chunk data.
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
    big:    { scale: 3.0, count: 2, chance: 0.585, multipart: true,  selfDistance: 200 },
    middle: { scale: 1.5, count: 6, chance: 1.0,   multipart: false, selfDistance: 100 },
    small:  { scale: 1.5, count: 11, chance: 1.0,  multipart: false, selfDistance: 50 },
};
const DISTANCE_MAP = {
    rock: {
        differentSize: 60,
        cactus: 30,
        gate: 30,
    }
};

/**
 * Generates rock data for a specific chunk, checking against existing and neighbor positions.
 * @param {number} chunkX - The x-coordinate of the chunk.
 * @param {number} chunkZ - The z-coordinate of the chunk.
 * @param {number} chunkSize - The size of the chunk.
 * @param {object[]} allOccupiedPositions - An array of objects with {position, type, size} to check against.
 * @returns {Promise<object[]>} A promise that resolves to the array of generated rock data for the chunk.
 */
export async function generateRockDataForChunk(chunkX, chunkZ, chunkSize, allOccupiedPositions) {
    const finalObjectData = [];
    const seed = (chunkX * 31 + chunkZ * 17) * 13;
    const seededRandom = createSeededRandom(seed);

    for (const category in rockConfigs) {
        const config = rockConfigs[category];
        const files = rockFileNames[category];
        
        let numToPlace = 0;
        for (let n = 0; n < config.count; n++) {
            if (seededRandom() < config.chance) numToPlace++;
        }

        for (let k = 0; k < numToPlace; k++) {
            let positionIsValid = false;
            let candidatePosition;
            let attempts = 0;

            while (!positionIsValid && attempts < 50) {
                const posX = (chunkX + seededRandom() - 0.5) * chunkSize;
                const posZ = (chunkZ + seededRandom() - 0.5) * chunkSize;
                candidatePosition = new T.Vector3(posX, 0, posZ);
                
                positionIsValid = true;
                
                for (const occupied of allOccupiedPositions) {
                    const dist = candidatePosition.distanceTo(occupied.position);
                    let minAllowedDist = 0;

                    if (occupied.type === 'rock') {
                        if (occupied.size === category) {
                            minAllowedDist = config.selfDistance;
                        } else {
                            minAllowedDist = DISTANCE_MAP.rock.differentSize;
                        }
                    } else if (occupied.type === 'cactus') {
                        minAllowedDist = DISTANCE_MAP.rock.cactus;
                    } else if (occupied.type === 'gate') {
                        minAllowedDist = DISTANCE_MAP.rock.gate;
                    }

                    if (dist < minAllowedDist) {
                        positionIsValid = false;
                        break;
                    }
                }
                attempts++;
            }

            if (positionIsValid) {
                const newRockInfo = {
                    position: candidatePosition.clone(),
                    type: 'rock',
                    size: category
                };
                allOccupiedPositions.push(newRockInfo);

                const modelFile = `rocks/${files[Math.floor(seededRandom() * files.length)]}`;
                const model = await getModel(modelFile);

                finalObjectData.push({
                    type: 'rock',
                    size: category,
                    model: model,
                    position: candidatePosition.clone(),
                    rotation: new T.Euler(0, seededRandom() * Math.PI * 2, 0),
                    scale: new T.Vector3(config.scale, config.scale, config.scale),
                    multipart: config.multipart
                });
            }
        }
    }
    
    return finalObjectData;
}