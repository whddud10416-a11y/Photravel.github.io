import * as T from 'three';
import { config } from './config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createGround(container) {
    const tileSize = config.world.groundSize;
    const segments = 100;
    const textureLoader = new T.TextureLoader();
    const sandTexture = textureLoader.load('color.webp');
    sandTexture.wrapS = T.RepeatWrapping;
    sandTexture.wrapT = T.RepeatWrapping;
    sandTexture.repeat.set(config.world.textureRepeat, config.world.textureRepeat);

    const groundGeometry = new T.PlaneGeometry(tileSize, tileSize, segments, segments);
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = (Math.sin(x / config.world.duneFrequency) * config.world.duneHeight) + (Math.sin(y / 20) * config.world.duneHeight);
        positions.setZ(i, z);
    }
    groundGeometry.computeVertexNormals();

    const groundVertexShader = `
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const groundFragmentShader = `
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        uniform vec3 uCenterColor;
        uniform vec3 uEdgeColor;
        uniform float uGradientRadius;
        uniform sampler2D uSandTexture;
        uniform float uTextureAlpha;

        void main() {
            float dist = distance(vWorldPosition.xz, vec2(0.0));
            float mixFactor = smoothstep(0.0, uGradientRadius, dist);
            vec3 gradientColor = mix(uCenterColor, uEdgeColor, mixFactor);
            
            vec4 texColor = texture2D(uSandTexture, vUv);
            float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
            
            vec3 finalColor = gradientColor * (1.0 + (luminance - 0.5) * uTextureAlpha);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    const groundMaterial = new T.ShaderMaterial({
        uniforms: {
            uCenterColor: { value: new T.Color('#CE9FCD') },
            uEdgeColor: { value: new T.Color('#FFCCA8') },
            uGradientRadius: { value: 600.0 },
            uSandTexture: { value: sandTexture },
            uTextureAlpha: { value: 0.8 }
        },
        vertexShader: groundVertexShader,
        fragmentShader: groundFragmentShader,
        side: T.DoubleSide
    });

    const tileGroup = new T.Group();
    tileGroup.position.y = 0; 
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const ground = new T.Mesh(groundGeometry, groundMaterial);
            ground.position.set(i * tileSize, 0, j * tileSize);
            ground.rotation.x = -Math.PI / 2;
            tileGroup.add(ground);
        }
    }
    container.add(tileGroup);

    return { tileGroup, tileSize };
}

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
        middle: { scale: 1.5, count: 347, minDistance: 4 },
        small: { scale: 1.5, count: 693, minDistance: 1.5 },
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

export async function createCacti(container, occupiedPositions) {
    const loader = new GLTFLoader();
    const obstacles = [];

    const cactusFileNames = {
        small: ['cactus_1.glb', 'cactus_2.glb', 'cactus_3.glb'],
        medium: ['cactus_4.glb', 'cactus_5.glb', 'cactus_6.glb'],
        large: ['cactus_7.glb', 'cactus_8.glb', 'cactus_9.glb']
    };

    const cactusConfigs = {
        small: { scale: 1.5, count: 756, minDistance: 4 },
        medium: { scale: 2.5, count: 756, minDistance: 6 },
        large: { scale: 4.0, count: 756, minDistance: 10 },
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

function makeTextSprite(message, opts) {
    const parameters = opts || {};
    const fontface = parameters.fontface || 'Arial';
    const fontsize = parameters.fontsize || 18;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `Bold ${fontsize}px ${fontface}`;
    
    // get size data (height depends only on font size)
    const metrics = context.measureText(message);
    const textWidth = metrics.width;

    context.fillStyle = 'rgba(255, 255, 255, 1.0)';
    context.fillText(message, 0, fontsize);

    // canvas contents will be used for a texture
    const texture = new T.Texture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new T.SpriteMaterial({ map: texture });
    const sprite = new T.Sprite(spriteMaterial);
    sprite.scale.set(textWidth / fontsize * 5, 5, 1.0);
    return sprite;
}

export async function createGates(container, occupiedPositions) {
    const loader = new GLTFLoader();
    const gates = [];
    const gateConfig = {
        scale: 0.1,
        count: 86, // 86 random + 1 fixed = 87 total
        minDistFromPrev: 900,
        maxDistFromPrev: 1200,
        minDistFromAny: 40, // Reduced to allow spawning near scenery
    };
    const gltf = await loader.loadAsync('gate/gate.glb');
    const sourceGateModel = gltf.scene;

    // --- Create all gates first without numbering ---

    // 1. Create the "fixed" gate near spawn
    let lastGatePosition = new T.Vector3(0, 0.5, -50);
    occupiedPositions.push(lastGatePosition.clone());
    const fixedGate = sourceGateModel.clone();
    const fixedBox = new T.Box3().setFromObject(fixedGate);
    fixedGate.position.copy(lastGatePosition);
    fixedGate.position.y = -2 - (fixedBox.min.y * gateConfig.scale);
    fixedGate.scale.set(gateConfig.scale, gateConfig.scale, gateConfig.scale);
    
    const triggerPoint = lastGatePosition.clone();
    triggerPoint.y = 0;
    fixedGate.userData.triggerPoint = triggerPoint;
    
    container.add(fixedGate);
    gates.push(fixedGate);

    // 2. Create all the random gates
    for (let i = 0; i < gateConfig.count; i++) {
        let positionIsValid = false;
        let candidatePosition;
        let attempts = 0;
        
        while (!positionIsValid && attempts < 500) {
            const randomAngle = Math.random() * Math.PI * 2;
            const randomRadius = T.MathUtils.randFloat(gateConfig.minDistFromPrev, gateConfig.maxDistFromPrev);
            
            candidatePosition = new T.Vector3(
                lastGatePosition.x + Math.cos(randomAngle) * randomRadius,
                0.5,
                lastGatePosition.z + Math.sin(randomAngle) * randomRadius
            );

            positionIsValid = true;
            for (const pos of occupiedPositions) {
                if (candidatePosition.distanceTo(pos) < gateConfig.minDistFromAny) {
                    positionIsValid = false;
                    break;
                }
            }
            attempts++;
        }

        if (positionIsValid) {
            occupiedPositions.push(candidatePosition.clone());
            lastGatePosition = candidatePosition.clone(); 

            const gate = sourceGateModel.clone();
            const box = new T.Box3().setFromObject(gate);
            gate.position.copy(candidatePosition);
            gate.position.y = -2 - (box.min.y * gateConfig.scale);
            gate.rotation.y = Math.random() * Math.PI * 2;
            gate.scale.set(gateConfig.scale, gateConfig.scale, gateConfig.scale);
            
            const gateTriggerPoint = candidatePosition.clone();
            gateTriggerPoint.y = 0;
            gate.userData.triggerPoint = gateTriggerPoint;
            
            container.add(gate);
            gates.push(gate);
        }
    }

    // --- Sort gates by distance from spawn (0,0,0) ---
    const spawnPoint = new T.Vector3(0, 0, 0);
    gates.sort((a, b) => {
        const distA = a.position.distanceTo(spawnPoint);
        const distB = b.position.distanceTo(spawnPoint);
        return distA - distB;
    });

    // --- Assign numbers and labels to the sorted gates ---
    gates.forEach((gate, index) => {
        const gateNumber = index + 1;
        gate.userData.number = gateNumber;
        const label = makeTextSprite(` ${gateNumber} `, { fontsize: 32 });
        label.position.set(0, 15, 0);
        gate.add(label);
    });
    
    return gates;
}
