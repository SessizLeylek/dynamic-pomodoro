// --- Variables ---
let ratio = 5; // default ratio
let timerInterval = null;
let state = "Focus"; // "Focus" or "Break"
let running = false;
let elapsed = 0; // milliseconds
let breakDuration = 0; // milliseconds
let totalDuration = 0; // milliseconds
let historyData = [];

const focusText = "Focusing...";
const breakText = "On Break";
const pausedText = "Timer Paused";

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
            ratio = parseInt(btn.innerText.split(":")[0]);
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
        customButtonText.innerHTML = `<input type="number" id="custom-input" placeholder="Custom" min="1">`;
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
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
        ratio = num;
        customButtonText.innerHTML = `${ratio}:1`;
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

function startTimer() {
    if (running) return;
    running = true;
    startButton.textContent = "Pause";
    breakButton.disabled = (state !== "Focus");
    resetButton.disabled = false;
    progressText.textContent = state === "Focus" ? focusText : breakText;

    timerInterval = setInterval(() => {
        if (state === "Focus") {
            elapsed += 25;
        } else {
            elapsed -= 25;
            if (elapsed <= 0) {
                switchState("Focus");
            }
        }
        updateTimerDisplay();
        updateProgressBar();
        totalDuration += 25;
    }, 25);
    saveHistory("Start");
}

function pauseTimer() {
    if (!running) return;
    running = false;
    clearInterval(timerInterval);
    startButton.textContent = "Start";
    breakButton.disabled = true;
    progressText.textContent = pausedText;
    saveHistory("Pause");
}

function resetTimer() {
    // Stop timer
    running = false;
    clearInterval(timerInterval);

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
        breakDuration = elapsed / ratio;
        elapsed = breakDuration;
        breakButton.disabled = true;
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
    const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "history.json";
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
