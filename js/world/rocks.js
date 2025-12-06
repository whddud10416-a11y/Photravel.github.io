import * as T from 'three';
import { config } from '../config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function createRocks(container, occupiedPositions) {
    const loader = new GLTFLoader();
    const obstacles = [];

    const rockFileNames = {
        big: ['big_rock_1.glb', 'big_rock_2.glb', 'big_rock_3.glb'],
        middle: ['middle_rock_1.glb', 'middle_rock_2.glb', 'middle_rock_3.glb', 'middle_rock_4.glb', 'middle_rock_5.glb'],
        small: ['small_rock_1.glb', 'small_rock_2.glb', 'small_rock_3.glb', 'small_rock_4.glb', 'small_rock_5.glb', 'small_rock_6.glb', 'small_rock_7.glb']
    };

    const rockConfigs = {
        big: { scale: 3.0, count: 173, minDistance: 12 },
        middle: { scale: 1.5, count: 694, minDistance: 4 },
        small: { scale: 1.5, count: 1386, minDistance: 1.5 },
    };

    const loadPromises = Object.values(rockFileNames).flat().map(name => loader.loadAsync(`rocks/${name}`));
    const loadedGltfs = await Promise.all(loadPromises);
    const allModels = loadedGltfs.map(gltf => gltf.scene);

    let modelIndex = 0;
    const rockModels = {
        big: allModels.slice(modelIndex, modelIndex += rockFileNames.big.length),
        middle: allModels.slice(modelIndex, modelIndex += rockFileNames.middle.length),
        small: allModels.slice(modelIndex, modelIndex += rockFileNames.small.length),
    };

    const placementArea = config.world.groundSize / 2 - 100;

    const placeRockCategory = (category) => {
        const models = rockModels[category];
        const config = rockConfigs[category];

        for (let i = 0; i < config.count; i++) {
            let positionIsValid = false;
            let candidatePosition;
            let attempts = 0;
            while (!positionIsValid && attempts < 20) {
                candidatePosition = new T.Vector3((Math.random() - 0.5) * placementArea * 2, 0.5, (Math.random() - 0.5) * placementArea * 2);
                if (candidatePosition.length() < 10) { attempts++; continue; }
                positionIsValid = true;
                for (const pos of occupiedPositions) {
                    if (candidatePosition.distanceTo(pos) < config.minDistance) {
                        positionIsValid = false;
                        break;
                    }
                }
                attempts++;
            }

            if (positionIsValid) {
                occupiedPositions.push(candidatePosition);
                const sourceModel = models[Math.floor(Math.random() * models.length)];
                const rock = sourceModel.clone();
                rock.position.copy(candidatePosition);
                rock.rotation.y = Math.random() * Math.PI * 2;
                rock.scale.set(config.scale, config.scale, config.scale);
                container.add(rock);

                if (category === 'big') {
                    const aabb = new T.Box3().setFromObject(rock);
                    const size = new T.Vector3();
                    aabb.getSize(size);
                    const center = new T.Vector3();
                    aabb.getCenter(center);
                    const numBoxes = 3;
                    const subBoxes = [];
                    if (size.x > size.z) {
                        const boxWidth = size.x / numBoxes;
                        for (let j = 0; j < numBoxes; j++) {
                            const boxCenter = new T.Vector3(center.x - size.x / 2 + boxWidth * (j + 0.5), center.y, center.z);
                            const newSize = new T.Vector3(boxWidth, size.y, size.z * 0.8);
                            const subBox = new T.Box3();
                            subBox.setFromCenterAndSize(boxCenter, newSize);
                            subBox.min.y += size.y * 0.15;
                            subBoxes.push(subBox);
                        }
                    } else {
                        const boxDepth = size.z / numBoxes;
                        for (let j = 0; j < numBoxes; j++) {
                            const boxCenter = new T.Vector3(center.x, center.y, center.z - size.z / 2 + boxDepth * (j + 0.5));
                            const newSize = new T.Vector3(size.x * 0.8, size.y, boxDepth);
                            const subBox = new T.Box3();
                            subBox.setFromCenterAndSize(boxCenter, newSize);
                            subBox.min.y += size.y * 0.15;
                            subBoxes.push(subBox);
                        }
                    }
                    obstacles.push({ type: 'rock', mesh: rock, boxes: subBoxes });
                } else {
                    const tempBox = new T.Box3().setFromObject(rock);
                    const size = new T.Vector3();
                    tempBox.getSize(size);
                    const center = new T.Vector3();
                    tempBox.getCenter(center);
                    const newSize = new T.Vector3(size.x * 0.7, size.y, size.z * 0.7);
                    const scaledBox = new T.Box3();
                    scaledBox.setFromCenterAndSize(center, newSize);
                    scaledBox.min.y += size.y * 0.15;
                    obstacles.push({ type: 'rock', mesh: rock, box: scaledBox });
                }
            }
        }
    };
    placeRockCategory('big');
    placeRockCategory('middle');
    placeRockCategory('small');
    return obstacles;
}