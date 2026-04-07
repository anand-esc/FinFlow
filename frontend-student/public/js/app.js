// --- DOM Elements ---
const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');
const webcamStatus = document.getElementById('webcamStatus');
const statusMsg = document.getElementById('statusMessage');

// Gamification Elements
const targetLetterEl = document.getElementById('targetLetter');
const predictionEl = document.getElementById('currentPrediction');
const confidenceEl = document.getElementById('confidenceText');
const progressBar = document.getElementById('progressBar');
const skipBtn = document.getElementById('skipBtn');
const practiceSelector = document.getElementById('practiceSelector');

// --- Game State ---
let availableLetters = ['-'];
let currentTarget = '-';
let practiceMode = 'RANDOM';
let currentPredictionRaw = '?';
let socketConnected = false;
let holdScore = 0;
const REQUIRED_HOLD_FRAMES = 20; // Lowered from 30: needs about 1s of holding instead of 1.5s
const CONFIDENCE_THRESHOLD = 0.40; // Lowered from 60%: more forgiving if the match is decent
const HOLD_PENALTY = 0.5; // Lowered from 2.0: doesn't wipe out progress instantly if you twitch

async function loadAIConfig() {
    try {
        const response = await fetch('http://localhost:8000/config');
        const data = await response.json();
        if (data.available_letters && data.available_letters.length > 0) {
            availableLetters = data.available_letters;
            console.log("Dynamically loaded AI letters:", availableLetters);

            // Populate Dropdown
            availableLetters.forEach(letter => {
                const opt = document.createElement('option');
                opt.value = letter;
                opt.innerText = `Practice '${letter}'`;
                practiceSelector.appendChild(opt);
            });

            setRandomTarget();
        }
    } catch (e) {
        console.error("Failed to load AI config from backend", e);
    }
}
// Load the config right away
loadAIConfig();

skipBtn.addEventListener('click', () => {
    setRandomTarget();
});

practiceSelector.addEventListener('change', (e) => {
    practiceMode = e.target.value;
    setRandomTarget();
});

function setRandomTarget() {
    if (practiceMode !== 'RANDOM') {
        currentTarget = practiceMode;
    } else {
        // Pick a new letter different from current
        let newTarget = currentTarget;
        // If we only have 1 letter trained, just pick it
        if (availableLetters.length === 1) {
            newTarget = availableLetters[0];
        } else {
            while (newTarget === currentTarget) {
                newTarget = availableLetters[Math.floor(Math.random() * availableLetters.length)];
            }
        }
        currentTarget = newTarget;
    }

    targetLetterEl.innerText = currentTarget;
    holdScore = 0;
    progressBar.style.width = '0%';
    predictionEl.classList.remove('success');
}

// --- WebSocket Connection ---
const ws = new WebSocket('ws://localhost:8000/ws/predict');

ws.onopen = () => {
    socketConnected = true;
    statusMsg.innerText = "Connected to AI Engine";
    statusMsg.className = "status-message connected";
};

ws.onclose = () => {
    socketConnected = false;
    statusMsg.innerText = "Backend Disconnected. Start Python Backend!";
    statusMsg.className = "status-message error";
};

ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (data.prediction) {
            currentPredictionRaw = data.prediction;
            predictionEl.innerText = data.prediction;
            confidenceEl.innerText = `Confidence: ${(data.confidence * 100).toFixed(0)}%`;

            // Gamification Logic
            if (data.prediction === currentTarget && data.confidence > CONFIDENCE_THRESHOLD) {
                holdScore = Math.min(holdScore + 1, REQUIRED_HOLD_FRAMES + 1);
                predictionEl.classList.add('success');
            } else {
                holdScore = Math.max(0, holdScore - HOLD_PENALTY); // Gentle penalty for breaking form
                predictionEl.classList.remove('success');
            }

            // Update Progress Bar
            const progress = Math.min((holdScore / REQUIRED_HOLD_FRAMES) * 100, 100);
            progressBar.style.width = `${progress}%`;

            // Success Condition
            if (holdScore >= REQUIRED_HOLD_FRAMES) {
                // Flash entire target letter green
                targetLetterEl.style.color = '#10b981';
                setTimeout(() => {
                    targetLetterEl.style.color = 'var(--accent-color)';
                    setRandomTarget();
                }, 1000);
            }

        } else if (data.error) {
            console.warn("Backend Error:", data.error);
        }
    } catch (e) {
        console.error("Error parsing AI response", e);
    }
};

// --- Mathematical Normalization (Mirroring Python) ---
function normalizeLandmarks(landmarks) {
    if (!landmarks || landmarks.length !== 21) return null;

    // 1. Translation: Wrist (0) to origin
    const base_x = landmarks[0].x;
    const base_y = landmarks[0].y;
    const base_z = landmarks[0].z;

    let translated = landmarks.map(lm => ({
        x: lm.x - base_x,
        y: lm.y - base_y,
        z: lm.z - base_z
    }));

    // 2. Scaling
    let max_abs = 0;
    for (let point of translated) {
        max_abs = Math.max(max_abs, Math.abs(point.x), Math.abs(point.y), Math.abs(point.z));
    }

    if (max_abs > 0) {
        translated = translated.map(lm => ({
            x: lm.x / max_abs,
            y: lm.y / max_abs,
            z: lm.z / max_abs
        }));
    }

    // 3. Flatten
    let flat_array = [];
    for (let point of translated) {
        flat_array.push(point.x, point.y, point.z);
    }
    return flat_array;
}

// --- MediaPipe Pipeline ---
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
});

hands.onResults((results) => {
    webcamStatus.style.display = 'none'; // Hide loading text

    // Draw Camera Frame
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const handLandmarks = results.multiHandLandmarks[0];

        // Draw Skeleton overlay (using MediaPipe Canvas styles)
        drawConnectors(canvasCtx, handLandmarks, HAND_CONNECTIONS, { color: '#10b981', lineWidth: 4 }); // Emerald lines
        drawLandmarks(canvasCtx, handLandmarks, { color: '#8b5cf6', lineWidth: 2, radius: 4 }); // Violet dots

        // Prepare data for ML Backend
        if (socketConnected && ws.readyState === WebSocket.OPEN) {
            const normalized = normalizeLandmarks(handLandmarks);

            // Stream to backend via WebSocket instantaneously
            ws.send(JSON.stringify({
                landmarks: normalized
            }));
        }
    } else {
        // No hand - degrade progress slowly
        holdScore = Math.max(0, holdScore - 1);
        progressBar.style.width = `${Math.min((holdScore / REQUIRED_HOLD_FRAMES) * 100, 100)}%`;
        predictionEl.innerText = '?';
        confidenceEl.innerText = `Waiting for hand...`;
        predictionEl.classList.remove('success');
    }

    canvasCtx.restore();
});

// --- Start Camera ---
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

camera.start().catch((err) => {
    console.error(err);
    webcamStatus.innerText = "Camera Access Denied or Unavailable.";
});
