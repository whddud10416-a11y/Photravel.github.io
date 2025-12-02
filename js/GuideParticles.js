import * as T from 'three';

const PARTICLE_COUNT = 25;      // How many particles are in the trail (reduced further)
const TRAIL_LENGTH = 35;      // The visible length of the trail in world units
const SWARM_RADIUS = 2.5;       // How much the particles spread out from the center line
const PARTICLE_BASE_SIZE = 1.5;   // Base size of the particles (reduced by 50%)
const FLOW_SPEED = 7.0;        // How fast the particles flow along the trail (reduced by 30%)

export class GuideParticles {
    constructor(scene) {
        this.scene = scene;
        this.curve = null;

        const geometry = new T.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const alphas = new Float32Array(PARTICLE_COUNT);

        const offsets = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3 + 1] = -10000;
            offsets.push(
                new T.Vector3(
                    (Math.random() - 0.5) * SWARM_RADIUS,
                    (Math.random() - 0.5) * SWARM_RADIUS,
                    (Math.random() - 0.5) * SWARM_RADIUS
                )
            );
        }
        this.particleOffsets = offsets;

        geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
        geometry.setAttribute('alpha', new T.BufferAttribute(alphas, 1));
        
        const material = new T.ShaderMaterial({
            uniforms: {
                color: { value: new T.Color(0xadff2f) },
            },
            vertexShader: `
                attribute float alpha;
                varying float vAlpha;
                void main() {
                    vAlpha = alpha;
                    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
                    gl_PointSize = ${PARTICLE_BASE_SIZE.toFixed(1)} * ( 300.0 / -mvPosition.z );
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                varying float vAlpha;
                void main() {
                    if (distance(gl_PointCoord, vec2(0.5, 0.5)) > 0.5) discard;
                    float glow = 1.0 - distance(gl_PointCoord, vec2(0.5, 0.5)) * 2.0;
                    gl_FragColor = vec4( color, vAlpha * glow * 0.5 ); // Reduced brightness
                }
            `,
            blending: T.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });

        this.particleSystem = new T.Points(geometry, material);
        this.particleSystem.visible = false;
        this.scene.add(this.particleSystem);
    }
    
    update(deltaTime, playerPosition, targetPosition) {
        if (!targetPosition) {
            this.particleSystem.visible = false;
            return;
        }

        this.particleSystem.visible = true;

        this.curve = new T.LineCurve3(playerPosition, targetPosition);

        const positions = this.particleSystem.geometry.attributes.position.array;
        const alphas = this.particleSystem.geometry.attributes.alpha.array;
        const curveLength = this.curve.getLength();
        const time = Date.now() / 1000;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Add a looping time offset to make the particles flow
            const timeOffset = time * FLOW_SPEED;

            // Calculate this particle's base distance along the trail
            const baseDist = (i / (PARTICLE_COUNT - 1)) * TRAIL_LENGTH;
            
            // Animate the distance and make it loop within the trail length
            const animatedDist = (baseDist + timeOffset) % TRAIL_LENGTH;

            const progress = animatedDist / curveLength;

            if (animatedDist > curveLength || progress >= 1) {
                positions[i * 3 + 1] = -10000;
                alphas[i] = 0;
            } else {
                // Alpha fades out based on distance along the fixed-length trail
                alphas[i] = 1.0 - (animatedDist / TRAIL_LENGTH);

                const basePosition = this.curve.getPoint(progress);
                const finalPosition = basePosition.add(this.particleOffsets[i]);

                positions[i * 3] = finalPosition.x;
                positions[i * 3 + 1] = finalPosition.y;
                positions[i * 3 + 2] = finalPosition.z;
            }
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.alpha.needsUpdate = true;
    }
}