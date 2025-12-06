import * as T from 'three';
import { config } from '../config.js';

// Module-level variables for ground shape, needed for getGroundHeight
let seamlessDuneFrequencyX, seamlessDuneFrequencyY;
const duneHeight = config.world.duneHeight;

/**
 * Calculates the ground's world Y position at a given X and Z coordinate.
 * @param {number} worldX The world x-coordinate.
 * @param {number} worldZ The world z-coordinate.
 * @returns {number} The height (y-coordinate) of the ground at that point.
 */
export function getGroundHeight(worldX, worldZ) {
    if (seamlessDuneFrequencyX === undefined) {
        // This is a fallback in case getGroundHeight is called before createGround initializes the values.
        // It's better to ensure createGround is called first.
        const tileSize = config.world.groundSize;
        const periodFactorX = Math.ceil(tileSize / (config.world.duneFrequency * 2 * Math.PI));
        seamlessDuneFrequencyX = tileSize / (periodFactorX * 2 * Math.PI);
        const periodFactorY = Math.ceil(tileSize / (20 * 2 * Math.PI));
        seamlessDuneFrequencyY = tileSize / (periodFactorY * 2 * Math.PI);
    }
    // The formula is derived from the vertex displacement logic in createGround,
    // accounting for the mesh's -90 degree rotation around the X-axis.
    const y = (Math.sin(worldX / seamlessDuneFrequencyX) * duneHeight) + (Math.sin(-worldZ / seamlessDuneFrequencyY) * duneHeight);
    return y;
}


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

    // Calculate new frequencies to ensure seamless tiling
    const periodFactorX = Math.ceil(tileSize / (config.world.duneFrequency * 2 * Math.PI));
    seamlessDuneFrequencyX = tileSize / (periodFactorX * 2 * Math.PI);

    const periodFactorY = Math.ceil(tileSize / (20 * 2 * Math.PI)); // Original hardcoded 20
    seamlessDuneFrequencyY = tileSize / (periodFactorY * 2 * Math.PI);

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        // Use the new seamless frequencies
        const z = getGroundHeight(x, -y); // Use the exported function for consistency. y is inverted because of the plane's orientation vs world Z.
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