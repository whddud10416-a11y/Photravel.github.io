import * as THREE from 'three';

const PARTICLE_COUNT = 18000;
const VISIBLE_RADIUS = 300; // A reasonably large area around the player where particles are visible
const VISIBLE_DIAMETER = VISIBLE_RADIUS * 2;
const MAX_HEIGHT = 100;
const PARTICLE_SIZE = 1.56;

const vertexShader = `
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = ${PARTICLE_SIZE.toFixed(1)} * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 color;
  varying float vAlpha;
  void main() {
    if (distance(gl_PointCoord, vec2(0.5, 0.5)) > 0.5) discard;
    float glow = pow(1.0 - distance(gl_PointCoord, vec2(0.5, 0.5)) * 2.0, 2.0);
    gl_FragColor = vec4(color, min(vAlpha * glow * 2.0, 1.0)); // Double the alpha for brightness, clamped at 1.0
  }
`;

export class AtmosphericParticles {
    constructor(scene) {
        this.scene = scene;
        this.geometry = new THREE.BufferGeometry();
        
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xFFFFAA) },
            },
            vertexShader,
            fragmentShader,
            blending: THREE.NormalBlending, // Changed from AdditiveBlending
            transparent: true,
            depthWrite: false,
        });

        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const alphas = new Float32Array(PARTICLE_COUNT);
        const randoms = new Float32Array(PARTICLE_COUNT * 3); // x-bobble, y-speed, z-bobble

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Set initial position randomly within the visible sphere
            const i3 = i * 3;
            positions[i3 + 0] = (Math.random() - 0.5) * VISIBLE_DIAMETER;
            positions[i3 + 1] = Math.random() * MAX_HEIGHT;
            positions[i3 + 2] = (Math.random() - 0.5) * VISIBLE_DIAMETER;
            
            alphas[i] = Math.random(); // Start with random alpha
            
            randoms[i3 + 0] = (Math.random() - 0.5) * 0.5;
            randoms[i3 + 1] = 0.5 + Math.random() * 2.5;
            randoms[i3 + 2] = (Math.random() - 0.5) * 0.5;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        this.geometry.setAttribute('randoms', new THREE.BufferAttribute(randoms, 3));
        
        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false; // Prevents the entire system from being culled
        this.scene.add(this.points);
    }
    
    update(deltaTime, playerPosition) {
        const positions = this.geometry.attributes.position.array;
        const alphas = this.geometry.attributes.alpha.array;
        const randoms = this.geometry.attributes.randoms.array;
        const time = Date.now() * 0.001;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;

            // Apply upward drift
            positions[i3 + 1] += randoms[i3 + 1] * deltaTime;
            
            // Apply bobbing motion
            positions[i3 + 0] += Math.sin(time * randoms[i3 + 2]) * randoms[i3 + 0] * deltaTime;
            positions[i3 + 2] += Math.cos(time * randoms[i3 + 0]) * randoms[i3 + 2] * deltaTime;

            // --- Wrapping Logic ---
            // If particle is too far from the player, wrap it to the other side.
            if (positions[i3 + 0] - playerPosition.x > VISIBLE_RADIUS) {
                positions[i3 + 0] -= VISIBLE_DIAMETER;
            } else if (positions[i3 + 0] - playerPosition.x < -VISIBLE_RADIUS) {
                positions[i3 + 0] += VISIBLE_DIAMETER;
            }
            if (positions[i3 + 2] - playerPosition.z > VISIBLE_RADIUS) {
                positions[i3 + 2] -= VISIBLE_DIAMETER;
            } else if (positions[i3 + 2] - playerPosition.z < -VISIBLE_RADIUS) {
                positions[i3 + 2] += VISIBLE_DIAMETER;
            }

            // --- Lifecycle Logic ---
            const life = positions[i3 + 1] / MAX_HEIGHT;
            if (life < 0.5) {
                alphas[i] = life * 2;
            } else {
                alphas[i] = (1.0 - life) * 2;
            }

            // Reset particle if it goes too high
            if (positions[i3 + 1] > MAX_HEIGHT) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.sqrt(Math.random()) * VISIBLE_RADIUS;
                positions[i3 + 0] = playerPosition.x + Math.cos(angle) * radius;
                positions[i3 + 1] = 0; // Reset to ground
                positions[i3 + 2] = playerPosition.z + Math.sin(angle) * radius;
                alphas[i] = 0;
            }
        }
        
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.alpha.needsUpdate = true;
    }
}
