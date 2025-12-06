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

export async function createGates(container, occupiedPositions) {
    const loader = new GLTFLoader();
    const gates = [];
    const gateConfig = {
        scale: 0.1,
        count: 86, // 86 random + 1 fixed = 87 total
        minDistFromPrev: 900,
        maxDistFromPrev: 1200,
        minDistFromAny: 450, // Increased to avoid collision with other gates in the chain
    };
    const gltf = await loader.loadAsync('gate/gate.glb');
    const sourceGateModel = gltf.scene;

    // Brighten the gate material by 10%
    sourceGateModel.traverse(child => {
        if (child.isMesh && child.material && child.material.color) {
            child.material.color.multiplyScalar(1.05);
        }
    });

    // --- Create all gates first without numbering ---
    
    // 1. Create a special gate near the origin first.
    const firstGateAngle = Math.random() * Math.PI * 2;
    const firstGateRadius = T.MathUtils.randFloat(50, 100);
    const firstGatePosition = new T.Vector3(
        Math.cos(firstGateAngle) * firstGateRadius,
        0.5,
        Math.sin(firstGateAngle) * firstGateRadius
    );
    
    occupiedPositions.push(firstGatePosition.clone());

    const firstGate = sourceGateModel.clone();
    const firstGateBox = new T.Box3().setFromObject(firstGate);
    firstGate.position.copy(firstGatePosition);
    firstGate.position.y = -2 - (firstGateBox.min.y * gateConfig.scale);
    firstGate.rotation.y = Math.random() * Math.PI * 2;
    firstGate.scale.set(gateConfig.scale, gateConfig.scale, gateConfig.scale);
    firstGate.userData.triggerPoint = firstGatePosition.clone();
    container.add(firstGate);
    gates.push(firstGate);


    // The generation chain will now start from this first gate.
    let lastGatePosition = firstGatePosition.clone();

    // 2. Create all the remaining random gates
    for (let i = 0; i < gateConfig.count - 1; i++) { // N-1 gates
        let positionIsValid = false;
        let candidatePosition;
        let attempts = 0;
        
        while (!positionIsValid && attempts < 5000) {
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
            
            gate.traverse(child => {
                if (child.isMesh && child.material && child.material.transparent) {
                    console.log("Applying alpha fix to gate material:", child.material.name);
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
    // The gate positions are already set in a chain; this just randomizes the numbers.
    const numbersToAssign = Array.from({length: gates.length}, (_, i) => i + 1);

    // Fisher-Yates (aka Knuth) Shuffle algorithm
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