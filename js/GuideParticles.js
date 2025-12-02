import * as T from 'three';
import { createNoise3D } from 'simplex-noise';

const PARTICLE_COUNT = 50;
const SWARM_RADIUS = 0.8; // Reduced range of wobbling
const PARTICLE_BASE_SIZE = 3.5;
const FLOW_SPEED = 7.5;
const MAX_GUIDE_DISTANCE = 70.0;
const NOISE_STRENGTH = 0.8; // Reduced strength of swirls
const NOISE_TIME_SCALE = 0.2;

// Implements a "Fixed Length Local Guide" with organic noise.
export class GuideParticles {
    constructor(scene) {
        this.scene = scene;
        this.noise3D = createNoise3D(Math.random);
        this.curve = null;

        const geometry = new T.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const progresses = new Float32Array(PARTICLE_COUNT);
        
        this.particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            this.particles.push({
                progress: Math.random(), // Start at a random point in the stream
            });
            positions[i * 3 + 1] = -10000;
        }
        
        geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
        geometry.setAttribute('aProgress', new T.BufferAttribute(progresses, 1));
        
        const material = new T.ShaderMaterial({
            uniforms: { color: { value: new T.Color(0xadff2f) } },
            vertexShader: `
                attribute float aProgress;
                varying float vProgress;
                void main() {
                    vProgress = aProgress;
                    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
                    
                    // Size over Lifetime
                    float size = ${PARTICLE_BASE_SIZE.toFixed(1)} * pow(1.0 - vProgress, 2.0);

                    gl_PointSize = size * ( 300.0 / -mvPosition.z );
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: `
                varying float vProgress;
                uniform vec3 color;
                void main() {
                    if (distance(gl_PointCoord, vec2(0.5, 0.5)) > 0.45) discard;
                    
                    // Opacity over Lifetime
                    float alpha = pow(1.0 - vProgress, 3.0);

                    float glow = 1.0 - distance(gl_PointCoord, vec2(0.5, 0.5)) * 2.0;
                    gl_FragColor = vec4( color, alpha * glow );
                }
            `,
            blending: T.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });

        this.particleSystem = new T.Points(geometry, material);
        this.scene.add(this.particleSystem);
        this.time = 0;
    }
    
    update(deltaTime, startPosition, targetPosition) {
        if (!targetPosition || !startPosition) {
            this.particleSystem.visible = false;
            return;
        }
        this.particleSystem.visible = true;
        this.time += deltaTime;

        // 1. Create the fixed-length local path
        const direction = new T.Vector3().subVectors(targetPosition, startPosition).normalize();
        const endPoint = startPosition.clone().add(direction.multiplyScalar(MAX_GUIDE_DISTANCE));
        this.curve = new T.LineCurve3(startPosition, endPoint);

        const positions = this.particleSystem.geometry.attributes.position.array;
        const progresses = this.particleSystem.geometry.attributes.aProgress.array;
        const normalizedFlowSpeed = FLOW_SPEED / MAX_GUIDE_DISTANCE;

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            particle.progress = (particle.progress + normalizedFlowSpeed * deltaTime) % 1.0;

            const currentPoint = this.curve.getPoint(particle.progress);
            
            // 2. Apply noise for organic movement
            const noise = this.noise3D(
                currentPoint.x * 0.1, 
                currentPoint.y * 0.1, 
                (this.time * NOISE_TIME_SCALE) + i * 0.01 // Use time scale
            );
            const noiseVec = new T.Vector3(
                this.noise3D(currentPoint.x * 0.2 + (this.time * NOISE_TIME_SCALE), currentPoint.y * 0.2, i),
                noise,
                this.noise3D(currentPoint.z * 0.2, i, currentPoint.x * 0.2 + (this.time * NOISE_TIME_SCALE))
            );

            const finalPosition = currentPoint.add(noiseVec.multiplyScalar(SWARM_RADIUS * (1.0 - particle.progress)));

            positions[i * 3] = finalPosition.x;
            positions[i * 3 + 1] = finalPosition.y;
            positions[i * 3 + 2] = finalPosition.z;

            // 3. Update progress for shader-based lifetime effects
            progresses[i] = particle.progress;
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.aProgress.needsUpdate = true;
    }
}