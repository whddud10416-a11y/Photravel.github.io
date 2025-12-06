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
    // verticalAdjust determined empirically from logs.
    // All cactus models showed a Calculated Vertical Offset of ~0.00,
    // indicating their origin is at their base. Thus, the new logic uses the calculated offset directly.
    // Small positive adjustments are added to medium/small to prevent arms from sinking into the ground.
    large:  { scale: 4.0, count: 7, selfDistance: 160, verticalAdjust: 0 },
    medium: { scale: 2.5, count: 10, selfDistance: 80, verticalAdjust: 0.3 },
    small:  { scale: 1.5, count: 10, selfDistance: 40,  verticalAdjust: 0.5 },
};

const DISTANCE_MAP = {
    cactus: {
        differentSize: 60,
        rock: 30,
        gate: 30,
    }
};

const sizeToRadius = {
    'rock-big': 100, 'rock-middle': 50, 'rock-small': 25,
    'cactus-large': 80, 'cactus-medium': 40, 'cactus-small': 20,
    'gate': 150,
};

/**
 * Generates cactus data for a specific chunk, checking against existing and neighbor positions.
 * @param {number} chunkX - The x-coordinate of the chunk.
 * @param {number} chunkZ - The z-coordinate of the chunk.
 * @param {number} chunkSize - The size of the chunk.
 * @param {object[]} allOccupiedPositions - An array of objects with {position, type, size} to check against.
 * @returns {Promise<object[]>} A promise that resolves to the array of generated cactus data for the chunk.
 */
export async function generateCactiDataForChunk(chunkX, chunkZ, chunkSize) {
    const finalObjectData = [];
    const seed = (chunkX * 19 + chunkZ * 47) * 23;
    const seededRandom = createSeededRandom(seed);

    // Process large cacti first, then medium, then small
    const categories = ['large', 'medium', 'small'];

    for (const category of categories) {
        const config = cactusConfigs[category];
        const files = cactusFileNames[category];
        
        for (let k = 0; k < config.count; k++) {
            const posX = (chunkX + seededRandom() - 0.5) * chunkSize;
            const posZ = (chunkZ + seededRandom() - 0.5) * chunkSize;
            const candidatePosition = new T.Vector3(posX, 0, posZ);

            const modelFile = `cactus/${files[Math.floor(seededRandom() * files.length)]}`;
            const model = await getModel(modelFile);

            if (model) {
                finalObjectData.push({
                    type: 'cactus',
                    size: category,
                    model: model,
                    position: candidatePosition.clone(),
                    rotation: new T.Euler(-Math.PI / 2, 0, seededRandom() * Math.PI * 2),
                    scale: new T.Vector3(config.scale, config.scale, config.scale),
                    config: config, // Pass config for later use
                });
            }
        }
    }
    
    return finalObjectData;
}
