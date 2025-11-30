import * as THREE from 'three';

export function createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.3, // Increased size
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const starVertices = [];
    for (let i = 0; i < 50000; i++) { // Increased count
        const x = THREE.MathUtils.randFloatSpread(3000); // Increased spread
        const y = THREE.MathUtils.randFloatSpread(3000); // Increased spread
        const z = THREE.MathUtils.randFloatSpread(3000);
        const d = Math.sqrt(x*x + y*y + z*z);
        if (d > 1500 || d < 800) continue; // create a shell of stars

        starVertices.push(x, y, z);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));

    const stars = new THREE.Points(starGeometry, starMaterial);
    return stars;
}
