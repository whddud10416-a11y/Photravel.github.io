import * as THREE from 'three';
import { config } from './config.js';
import { createStars } from './particleSystem.js';

const skyVertexShader = `
varying vec3 vWorldPosition;
void main() {
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const skyFragmentShader = `
uniform vec3 topColor;
uniform vec3 bottomColor;
varying vec3 vWorldPosition;
void main() {
    float h = normalize(vWorldPosition).y;
    float mixFactor = smoothstep(-0.2, 0.2, h);
    gl_FragColor = vec4(mix(bottomColor, topColor, mixFactor), 1.0);
}
`;

export function initScene() {
    const scene = new THREE.Scene();

    // 하늘 그라데이션 설정
    const skyUniforms = {
        topColor: { value: new THREE.Color(0xFFDAB9) }, // PeachPuff
        bottomColor: { value: new THREE.Color(0xE0BBE4) } // Light Lavender/Pink
    };
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: skyUniforms,
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        side: THREE.BackSide
    });
    const skyGeo = new THREE.SphereGeometry(1000, 32, 15);
    const sky = new THREE.Mesh(skyGeo, skyMaterial);
    scene.add(sky);

    // 별 생성
    const stars = createStars();
    scene.add(stars);

    // 은하수 (Milky Way) - 텍스처를 로드하여 사용하세요.
    // 아래 코드는 임시 플레이스홀더입니다.
    // TODO: 'milkyway.jpg'를 실제 은하수 텍스처 파일 경로로 바꾸세요.
    // const textureLoader = new THREE.TextureLoader();
    // const milkyWayTexture = textureLoader.load('milkyway.jpg');
    // const milkyWayMaterial = new THREE.MeshBasicMaterial({
    //     map: milkyWayTexture,
    //     side: THREE.BackSide,
    //     transparent: true,
    //     opacity: 0.2 // 은하수 투명도 조절
    // });
    const milkyWayMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.05
    });

    const milkyWayGeometry = new THREE.SphereGeometry(950, 64, 64);
    const milkyWay = new THREE.Mesh(milkyWayGeometry, milkyWayMaterial);
    milkyWay.rotation.x = Math.PI / 1.8;
    milkyWay.rotation.y = Math.PI / 2;
    scene.add(milkyWay);


    const camera = new THREE.PerspectiveCamera(
        config.camera.fov,
        window.innerWidth / window.innerHeight,
        config.camera.near,
        config.camera.far
    );
    camera.position.set(config.camera.initialPosition.x, config.camera.initialPosition.y, config.camera.initialPosition.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = false;
    document.body.appendChild(renderer.domElement);

    return { scene, camera, renderer, sky, stars, milkyWay };
}