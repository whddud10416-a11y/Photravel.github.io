import * as T from 'three';
import { config } from '../config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function createCacti(container, occupiedPositions) {
    const loader = new GLTFLoader();
    const obstacles = [];

    const cactusFileNames = {
        small: ['cactus_1.glb', 'cactus_2.glb', 'cactus_3.glb'],
        medium: ['cactus_4.glb', 'cactus_5.glb', 'cactus_6.glb'],
        large: ['cactus_7.glb', 'cactus_8.glb', 'cactus_9.glb']
    };

    const cactusConfigs = {
        small: { scale: 1.5, count: 1512, minDistance: 4 },
        medium: { scale: 2.5, count: 1512, minDistance: 6 },
        large: { scale: 4.0, count: 1512, minDistance: 10 },
    };

    const allCactusMeshes = {};
    for (const category in cactusFileNames) {
        const loadPromises = cactusFileNames[category].map(name => loader.loadAsync(`cactus/${name}`));
        const loadedGltfs = await Promise.all(loadPromises);
        const meshes = [];
        loadedGltfs.forEach(gltf => { gltf.scene.traverse(node => { if (node.isMesh) meshes.push(node.clone()); }); });
        allCactusMeshes[category] = meshes;
    }

    const placementArea = config.world.groundSize / 2 - 100;

    const placeCactusCategory = (category) => {
        const models = allCactusMeshes[category];
        const config = cactusConfigs[category];
        for (let i = 0; i < config.count; i++) {
            let positionIsValid = false;
            let candidatePosition;
            let attempts = 0;
            while (!positionIsValid && attempts < 20) {
                 candidatePosition = new T.Vector3((Math.random() - 0.5) * placementArea * 2, 0.5, (Math.random() - 0.5) * placementArea * 2 );
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
                const sourceMesh = models[Math.floor(Math.random() * models.length)];
                const mesh = sourceMesh.clone();
                mesh.rotation.x = -Math.PI / 2;
                const cactus = new T.Group();
                cactus.add(mesh);
                cactus.position.copy(candidatePosition);
                cactus.rotation.y = Math.random() * Math.PI * 2;
                cactus.scale.set(config.scale, config.scale, config.scale);
                container.add(cactus);
                
                const tempBox = new T.Box3().setFromObject(cactus);
                const size = new T.Vector3();
                tempBox.getSize(size);
                const center = new T.Vector3();
                tempBox.getCenter(center);
                
                const newSize = new T.Vector3(size.x * 0.5, size.y, size.z * 0.5);
                const scaledBox = new T.Box3();
                scaledBox.setFromCenterAndSize(center, newSize);
                scaledBox.min.y += size.y * 0.15;
                obstacles.push({ type: 'cactus', mesh: cactus, box: scaledBox });
            }
        }
    };
    placeCactusCategory('small');
    placeCactusCategory('medium');
    placeCactusCategory('large');
    return obstacles;
}