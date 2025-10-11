// --- AudioScheduler ---
class AudioScheduler {
    constructor(audioUrl) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.connect(this.audioCtx.destination);
        this.audioBuffer = null;
        this.scheduled = null;
        this.isMuted = false;
        this.currentSource = null;

        this.loadAudio(audioUrl);
    }

    async loadAudio(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
    }

    schedule(delayMs) {
        if (!this.audioBuffer) return;

        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        // Cancel any previous schedule
        if (this.scheduled) this.cancel();
        if (this.currentSource) {
            this.currentSource.stop();
            this.currentSource = null;
        }

        const timeoutId = setTimeout(() => {
            const source = this.audioCtx.createBufferSource();
            source.buffer = this.audioBuffer;
            source.connect(this.gainNode);
            source.start();
            this.scheduled = null;
            this.currentSource = source;
        }, delayMs);

        this.scheduled = { cancel: () => clearTimeout(timeoutId) };
    }

    cancel() {
        if (this.scheduled) {
            this.scheduled.cancel();
            this.scheduled = null;
            this.currentSource = null;
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.gainNode.gain.value = this.isMuted ? 0 : 1;
    }

    mute() {
        this.isMuted = true;
        this.gainNode.gain.value = 0;
    }

    unmute() {
        this.isMuted = false;
        this.gainNode.gain.value = 1;
    }
}

// --- Variables ---
let ratio = 50; // default ratio, multiplied with 10
let timerInterval = null;
let state = "Focus"; // "Focus" or "Break"
let running = false;
let elapsed = 0; // milliseconds
let breakDuration = 0; // milliseconds
let totalDuration = 0; // milliseconds
let lastTimestamp = null;
let historyData = [];

const focusText = "Focusing...";
const breakText = "On Break";
const pausedText = "Timer Paused";
const audioScheduler = new AudioScheduler("res/alert.wav");

// --- Elements ---
const ratioButtons = document.querySelectorAll(".timer-ratios button");
const customButton = document.getElementById("ratio-custom");
const customButtonText = customButton.querySelector("p");
const totalTimeEl = document.querySelector(".total-time");
const totalTimeMins = totalTimeEl.querySelector("#minutes");
const totalTimeSecs = totalTimeEl.querySelector("#seconds");
const totalTimeMs = totalTimeEl.querySelector("#milliseconds");
const currentTimeEl = document.querySelector(".current-time");
const currentTimeMins = currentTimeEl.querySelector("#minutes");
const currentTimeSecs = currentTimeEl.querySelector("#seconds");
const currentTimeMs = currentTimeEl.querySelector("#milliseconds");
const startButton = document.getElementById("start-button");
const breakButton = document.getElementById("break-button");
const resetButton = document.getElementById("reset-button");
const audioButton = document.getElementById("audio-button");
const progressText = document.querySelector(".progress p");
const progressBar = document.getElementById("progress-bar");
const historyContent = document.querySelector(".history-content");
const downloadButton = document.querySelector(".history-button-download");
const uploadButton = document.querySelector(".history-button-upload");

progressText.textContent = pausedText;

// --- Ratio Buttons ---
ratioButtons.forEach(btn => {
    if (btn !== customButton) {
        btn.addEventListener("click", () => {
            ratio = 10 * parseInt(btn.innerText.split(":")[0]);
            setActiveRatio(btn);
        });
    }
});

let customInputActive = false;
let customInputDefined = false;
customButton.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!customInputActive && (!customInputDefined || customButton.classList.contains("ratio-active"))) {
        customInputActive = true;
        customButtonText.innerHTML = `<input type="number" id="custom-input" placeholder="Custom" min="1" max="20">`;
        const input = document.getElementById("custom-input");
        input.focus();
        
        input.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                saveCustomRatio(input.value);
            }
        });
    }
    setActiveRatio(customButton);
});

document.addEventListener("click", (e) => {
    if (customInputActive) {
        const input = document.getElementById("custom-input");
        if (input && !input.contains(e.target)) {
            saveCustomRatio(input.value);
        }
    }
});

function saveCustomRatio(value) {
    const num = Math.round(parseFloat(value)*10);
    if (!isNaN(num) && num > 0) {
        ratio = num;
        customButtonText.innerHTML = `${ratio/10}:1`;
        customInputDefined = true;
    } else {
        customButtonText.innerHTML = `Custom`;
    }
    customInputActive = false;
}

function setActiveRatio(activeBtn) {
    ratioButtons.forEach(btn => btn.className = "ratio-passive");
    activeBtn.className = "ratio-active";
}

// --- Timer ---
function updateTimerDisplay() {
    updateTimeText(elapsed, currentTimeMins, currentTimeSecs, currentTimeMs);
    updateTimeText(totalDuration, totalTimeMins, totalTimeSecs, totalTimeMs);
}

function updateTimeText(time, minText, secText, msText) {
    let mins = Math.floor(time / 60000);
    let secs = Math.floor((time % 60000) / 1000);
    let ms = Math.floor((time % 1000) / 100);
    minText.textContent = mins;
    secText.textContent = secs.toString().padStart(2, '0');
    msText.textContent = ms;
}

function scheduleAudio() {
    if (state === "Focus") return;
    
    let alertTime = elapsed - 10000; // 10 seconds before break ends
    if (alertTime < 1) alertTime = 1;

    audioScheduler.schedule(alertTime);
    
}

function startTimer() {
    if (running) return;
    running = true;
    startButton.textContent = "Pause";
    breakButton.disabled = (state !== "Focus");
    resetButton.disabled = false;
    progressText.textContent = state === "Focus" ? focusText : breakText;

    timerInterval = setInterval(() => {
        const deltaTime = lastTimestamp ? Date.now() - lastTimestamp : 0;
        lastTimestamp = Date.now();

        if (state === "Focus") {
            elapsed += deltaTime;
        } else {
            elapsed -= deltaTime;
            if (elapsed <= 0) {
                switchState("Focus");
            }
        }
        updateTimerDisplay();
        updateProgressBar();
        totalDuration += deltaTime;
    }, 25);
    saveHistory("Start");

    scheduleAudio();
}

function pauseTimer() {
    if (!running) return;
    running = false;
    clearInterval(timerInterval);
    audioScheduler.cancel();
    lastTimestamp = null;
    startButton.textContent = "Start";
    breakButton.disabled = true;
    progressText.textContent = pausedText;
    saveHistory("Pause");
}

function resetTimer() {
    // Stop timer
    running = false;
    clearInterval(timerInterval);
    audioScheduler.cancel();
    lastTimestamp = null;

    // Reset state to Focus
    state = "Focus";
    elapsed = 0;
    breakDuration = 0;
    progressText.textContent = pausedText;

    // Reset buttons
    startButton.textContent = "Start";
    breakButton.disabled = true;
    resetButton.disabled = true;

    // Update display and progress
    updateTimerDisplay();
    updateProgressBar();

    // Save history
    saveHistory("Reset");
}

function switchState(newState) {
    state = newState;
    if (state === "Focus") {
        progressText.textContent = focusText;
        elapsed = 0;
        breakButton.disabled = false;
    } else {
        progressText.textContent = breakText;
        breakDuration = elapsed / ratio * 10;
        elapsed = breakDuration;
        breakButton.disabled = true;

        scheduleAudio();
    }
    saveHistory(`Switch to ${state}`);
}

// --- Progress Bar ---
function updateProgressBar() {
    if (state === "Break") {
        progressBar.max = breakDuration;
        progressBar.value = elapsed;
    } else {
        progressBar.max = 1000;
        progressBar.value = 0;
    }
}

// --- Buttons ---
startButton.addEventListener("click", () => {
    if (running) pauseTimer();
    else startTimer();
});

breakButton.addEventListener("click", () => {
    if (running && state === "Focus") switchState("Break");
    breakButton.disabled = true;
});

resetButton.addEventListener("click", () => {
    resetTimer();
});

audioButton.addEventListener("click", () => {
    audioScheduler.toggleMute();
    let audioEnabled = !audioScheduler.isMuted;

    const iconSrc = audioEnabled ? "res/speaker-on.svg" : "res/speaker-off.svg";
    const iconTitle = audioEnabled ? "Sound is On" : "Sound is Off";
    const audioIcon = audioButton.querySelector(".button-icon");
    audioIcon.src = iconSrc;
    audioIcon.title = iconTitle;
});

// --- History ---
function saveHistory(action) {
    const timestamp = new Date().toISOString();
    const record = { action, state, elapsed, ratio, totalDuration, timestamp };
    historyData.push(record);
    renderHistory();
}

function renderHistory() {
    historyContent.innerHTML = "";
    historyData.slice(-20).forEach(item => {
        const p = document.createElement("p");
        p.textContent = `[${new Date(item.timestamp).toLocaleString()}] ${item.action} | ${item.state} | ${item.elapsed}ms | ${item.totalDuration}ms | ${item.ratio}:1`;
        historyContent.appendChild(p);
    });
}

downloadButton.addEventListener("click", () => {
    let dateString = new Date().toISOString().replace(/-/g, '').substring(0, 8);

    const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pomodoro_history_${dateString}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

uploadButton.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                historyData = JSON.parse(ev.target.result);
                renderHistory();
            } catch (err) {
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

// --- History Drawer Toggle ---

const drawer = document.querySelector(".history-drawer");
const header = drawer.querySelector(".history-header");

header.addEventListener("click", (e) => {
  // Ignore clicks on the Save/Load buttons
  if (e.target.tagName === "BUTTON" || e.target.tagName === "IMG") return;
  drawer.classList.toggle("expanded");
});
