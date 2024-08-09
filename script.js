const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('scene-container').appendChild(renderer.domElement);

const instructions = document.getElementById('instructions');
const audioFileInput = document.getElementById('audioFileInput');
const playPauseButton = document.getElementById('playPauseButton');

camera.position.z = 9;

let audioContext;
let analyser, dataArray, bufferLength;
let sphere, sphereGeometry;
let bufferSource;
let audioBuffer;
let isPlaying = false;
let startTime = 0;
let pausedAt = 0;

const vertexShader = `
varying vec3 vNormal;

void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float time;
varying vec3 vNormal;

void main() {
    float r = 0.5 + 0.5 * sin(vNormal.x * 10.0 + time);
    float g = 0.5 + 0.5 * sin(vNormal.y * 10.0 + time + 2.0);
    float b = 0.5 + 0.5 * sin(vNormal.z * 10.0 + time + 4.0);
    gl_FragColor = vec4(r, g, b, 1.0);
}
`;

const sphereMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: {
        time: { value: 0.0 }
    }
});

const gui = new dat.GUI();
const settings = {
    sphereRadius: 50,
    rotationSpeedX: 0.01,
    rotationSpeedY: 0.01,
    colorIntensity: 10.0,
    audioSensitivity: 128
};

gui.add(settings, 'sphereRadius', 10, 100).onChange(value => {
    if (sphere) {
        sphereGeometry.dispose();
        sphereGeometry = new THREE.SphereGeometry(value, 64, 64);
        sphere.geometry = sphereGeometry;
    }
});

gui.add(settings, 'rotationSpeedX', 0.001, 0.1);
gui.add(settings, 'rotationSpeedY', 0.001, 0.1);
gui.add(settings, 'colorIntensity', 5.0, 20.0);
gui.add(settings, 'audioSensitivity', 50, 255);

function createSphere() {
    if (sphere) {
        scene.remove(sphere);
    }
    sphereGeometry = new THREE.SphereGeometry(settings.sphereRadius, 64, 64);
    sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);
}

function setupAudio(file) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Stop the current audio if playing
    if (bufferSource && isPlaying) {
        bufferSource.stop();
        isPlaying = false;
        playPauseButton.textContent = 'Play';
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        const audioData = event.target.result;
        audioContext.decodeAudioData(audioData, function (buffer) {
            audioBuffer = buffer;

            if (!analyser) {
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
            }

            createSphere();
            animate();

            playPauseButton.disabled = false;
            playPauseButton.textContent = 'Play';
            isPlaying = false;
            startTime = 0;
            pausedAt = 0;
        }, function (e) {
            console.log("Erro ao decodificar o arquivo de áudio", e);
        });
    };
    reader.readAsArrayBuffer(file);
}

function playAudio() {
    bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(analyser);
    analyser.connect(audioContext.destination);
    bufferSource.start(0, pausedAt);
    startTime = audioContext.currentTime;
}

function togglePlayPause() {
    if (bufferSource && isPlaying) {
        // Pause the audio
        bufferSource.stop();
        pausedAt += audioContext.currentTime - startTime;
        playPauseButton.textContent = 'Play';
        isPlaying = false;
    } else {
        // Play or resume the audio
        playAudio();
        playPauseButton.textContent = 'Pause';
        isPlaying = true;
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (analyser && dataArray && isPlaying) {
        analyser.getByteFrequencyData(dataArray);

        const positions = sphereGeometry.attributes.position;
        const vertex = new THREE.Vector3();

        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);
            const scale = 1 + dataArray[i % bufferLength] / settings.audioSensitivity;
            vertex.normalize().multiplyScalar(scale);
            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        positions.needsUpdate = true;
    }

    sphere.rotation.x += settings.rotationSpeedX;
    sphere.rotation.y += settings.rotationSpeedY;
    sphereMaterial.uniforms.time.value += 0.05;

    renderer.render(scene, camera);
}

audioFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        instructions.style.display = 'none';
        setupAudio(file);
    }
});

playPauseButton.addEventListener('click', togglePlayPause);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});