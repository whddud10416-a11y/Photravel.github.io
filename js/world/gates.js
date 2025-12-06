import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

export async function createGates(container, occupiedPositions, chunkSize) {
    const loader = new GLTFLoader();
    const gates = [];
    const gateConfig = {
        scale: 0.1,
        count: 86,
        minDist: 400, // Reduced distance
        maxDist: 700, // Reduced distance
    };
    const gltf = await loader.loadAsync('gate/gate.glb');
    const sourceGateModel = gltf.scene;

    // Keep track of how many gates are in each chunk
    const chunkGateCount = new Map();

    sourceGateModel.traverse(child => {
        if (child.isMesh && child.material && child.material.color) {
            child.material.color.multiplyScalar(1.05);
        }
    });
    
    // --- Gate 1 (near origin) ---
    const firstGateAngle = Math.random() * Math.PI * 2;
    const firstGateRadius = T.MathUtils.randFloat(50, 100);
    const firstGatePosition = new T.Vector3(
        Math.cos(firstGateAngle) * firstGateRadius,
        0.5,
        Math.sin(firstGateAngle) * firstGateRadius
    );
    
    // Add to occupied list and update chunk count
    occupiedPositions.push(firstGatePosition.clone());
    const firstChunkId = `${Math.floor(firstGatePosition.x / chunkSize)}_${Math.floor(firstGatePosition.z / chunkSize)}`;
    chunkGateCount.set(firstChunkId, 1);

    const firstGate = sourceGateModel.clone();
    const firstGateBox = new T.Box3().setFromObject(firstGate);
    firstGate.position.copy(firstGatePosition);
    firstGate.position.y = -2 - (firstGateBox.min.y * gateConfig.scale);
    firstGate.rotation.y = Math.random() * Math.PI * 2;
    firstGate.scale.set(gateConfig.scale, gateConfig.scale, gateConfig.scale);
    firstGate.userData.triggerPoint = firstGatePosition.clone();
    container.add(firstGate);
    gates.push(firstGate);

    let lastGatePosition = firstGatePosition.clone();

    // --- Create all the remaining random gates ---
    for (let i = 0; i < gateConfig.count - 1; i++) {
        let positionIsValid = false;
        let candidatePosition;
        let attempts = 0;
        
        while (!positionIsValid && attempts < 10000) {
            attempts++;
            const randomAngle = Math.random() * Math.PI * 2;
            const randomRadius = T.MathUtils.randFloat(gateConfig.minDist, gateConfig.maxDist);
            
            candidatePosition = new T.Vector3(
                lastGatePosition.x + Math.cos(randomAngle) * randomRadius,
                0.5,
                lastGatePosition.z + Math.sin(randomAngle) * randomRadius
            );

            // 1. Check chunk limit first (it's a cheaper check)
            const chunkId = `${Math.floor(candidatePosition.x / chunkSize)}_${Math.floor(candidatePosition.z / chunkSize)}`;
            const currentCountInChunk = chunkGateCount.get(chunkId) || 0;
            if (currentCountInChunk >= 2) {
                positionIsValid = false;
                continue; // Try a new position
            }

            // 2. If chunk is ok, check distance to other gates
            positionIsValid = true;
            for (const pos of occupiedPositions) {
                if (candidatePosition.distanceTo(pos) < gateConfig.minDist) {
                    positionIsValid = false;
                    break;
                }
            }
        }

        if (positionIsValid) {
            // Add to occupied list
            occupiedPositions.push(candidatePosition.clone());
            
            // Update chunk count
            const chunkId = `${Math.floor(candidatePosition.x / chunkSize)}_${Math.floor(candidatePosition.z / chunkSize)}`;
            const currentCount = chunkGateCount.get(chunkId) || 0;
            chunkGateCount.set(chunkId, currentCount + 1);

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
            
            gate.traverse(child => {
                if (child.isMesh && child.material && child.material.transparent) {
                    child.material.transparent = false;
                    child.material.alphaTest = 0.5;
                    child.material.depthWrite = true;
                }
            });
            container.add(gate);
            gates.push(gate);
        }
    }

    // --- Shuffle and assign numbers to the gates randomly ---
    const numbersToAssign = Array.from({length: gates.length}, (_, i) => i + 1);
    for (let i = numbersToAssign.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbersToAssign[i], numbersToAssign[j]] = [numbersToAssign[j], numbersToAssign[i]];
    }

    // --- Assign the shuffled numbers and labels to the gates ---
    gates.forEach((gate, index) => {
        const gateNumber = numbersToAssign[index];
        gate.userData.number = gateNumber;
        const label = makeTextSprite(` ${gateNumber} `, { fontsize: 32 });
        label.position.set(0, 15, 0);
        gate.add(label);
    });
    
    return gates;
}