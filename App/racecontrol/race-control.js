const socket = io();

// Commonly used elements
const safetyControlButtons = ["safe", "hazard", "danger", "finish"];
const startRaceBtn = document.getElementById("start-race");
const safeToStartBtn = document.getElementById("safe-to-start");
const endSessionBtn = document.getElementById("end-session");
const raceSession = document.getElementById("race-session");
const racesessionBody = document.getElementById("racesession-body");
const timerDisplay = document.querySelector(".timer");
let timerInterval;
let sessionId;
const sessionIdElement = document.getElementById("session-id");
let raceState;
let startTime;
let configuration = {
  isDeveloperMode: false,
};

socket.on("setConfiguration", (configurationFromServer) => {
  configuration = configurationFromServer;
});

// --- For restore race ---
socket.on("sessionStarted", (data) => {
  if (!data.source) return;

  raceState = "running";
  console.log(`Resumed session ${data.sessionId} started at ${data.startTime}`);
  sessionId = data.sessionId;
  configuration.isDeveloperMode = data.isDeveloperMode;

  // Timer logic
  startTime = new Date(data.startTime).getTime();
  startCountdown(configuration.isDeveloperMode ? 60 : 600);

  // Restore safety button states
  document.querySelectorAll(".safety-buttons").forEach((button) => {
    button.classList.remove("hidden", "disabled", "currentMode");
  });

  // Highlight the current race mode from the database
  document.getElementById(data.raceMode)?.classList.add("currentMode");

  // Disable the start button and show safety buttons
  startRaceBtn.classList.add("disabled");
  toggleVisibility(startRaceBtn, false);
  toggleVisibility(safeToStartBtn, false);

  // Restore race session UI
  if (data.driverList && data.driverList.length > 0) {
    renderRacesession([
      { sessionId: data.sessionId, driverList: data.driverList },
    ]);
  }

});

// Helper function to change race mode and emit event
function changeRaceMode(mode) {
  console.log(`${mode} mode activated`);
  socket.emit("raceModeChange", mode);
  console.log(`Emit successful: raceModeChange -> ${mode}`);
}

// Helper function to toggle visibility of buttons
function toggleVisibility(element, shouldShow) {
  if (element) {
    element.classList.toggle("hidden", !shouldShow);
  }
}

// Helper function to enable/disable safety buttons
function setButtonsState(disable) {
  document.querySelectorAll(".safety-buttons").forEach((button) => {
    button.classList.toggle("disabled", disable);
  });
}

// Event listener for safety control buttons
safetyControlButtons.forEach((id) => {
  const button = document.getElementById(id);
  if (button) {
    button.addEventListener("click", () => {
      changeRaceMode(id);

      // Disable all buttons when "finish" is clicked
      if (id === "finish") {
        setButtonsState(true);
        resetTimer();
        socket.emit("timerUpdate", "00:00");
      }

      // Highlight the active mode button
      safetyControlButtons.forEach((btnId) =>
        document.getElementById(btnId)?.classList.remove("currentMode")
      );
      button.classList.add("currentMode");
    });
  }
});

// Emit "Safe to Start" event and update UI
safeToStartBtn?.addEventListener("click", () => {
  document.querySelectorAll(".safety-buttons").forEach((button) => {
    toggleVisibility(button, false); // Hides safety buttons after the race session ends
  });
  toggleVisibility(safeToStartBtn, false);
  toggleVisibility(startRaceBtn, true);
  console.log("Race is safe to start");
  socket.emit("safeToStart", sessionId);
  raceState = "safe to start";
  console.log("Emit successful: safeToStart event sent");
});

// Emit "Race Start" event, make safety controls visible, and start countdown
startRaceBtn?.addEventListener("click", () => {
  document.querySelectorAll(".safety-buttons").forEach((button) => {
    button.classList.remove("hidden", "disabled");
  });
  startRaceBtn.classList.add("disabled");
  document.getElementById("safe")?.classList.add("currentMode");

  console.log("Race has started");
  changeRaceMode("safe");
  raceState = "running";
  startTime = Date.now();

  socket.emit("raceStart", { sessionId, startTime });
  console.log("Emit successful: raceStart event sent");

  startCountdown(configuration.isDeveloperMode ? 60 : 600);
});

// Emit "End Session" event and hide controls
endSessionBtn?.addEventListener("click", () => {
  document.querySelectorAll(".safety-buttons").forEach((safetyButton) => {
    safetyButton.classList.add("hidden");
  });
  setButtonsState(true);
  toggleVisibility(safeToStartBtn, true);
  startRaceBtn.classList.remove("disabled");
  toggleVisibility(startRaceBtn, false);
  resetTimer();
  socket.emit("timerUpdate", "00:00");

  console.log("Race session has ended");
  raceState = "session ended";
  socket.emit("raceEnd", sessionId);
  console.log("Emit successful: raceEnd event sent");
  changeRaceMode("danger");
});

// Countdown function
function startCountdown(countdownTime) {
  timerInterval = setInterval(() => {
    const timeElapsed = Math.floor((Date.now() - startTime) / 1000); //Calculate elapsed time in seconds
    const timeRemaining = countdownTime - timeElapsed;

    if (timeRemaining <= 0) {
      resetTimer();
      console.log("Timer is up");
      socket.emit("timerUpdate", "00:00");
      changeRaceMode("finish");
      setButtonsState(true);
      return;
    }

    // Format and update UI
    const timeFormatted = new Date(timeRemaining * 1000)
      .toISOString()
      .slice(14, 19);
    timerDisplay.textContent = timeFormatted;

    // Emit updated time
    socket.emit("timerUpdate", timeFormatted);
  }, 1000);
}

/**
 * resets timer to 00:00
 */
function resetTimer() {
  clearInterval(timerInterval);
  timerDisplay.textContent = "00:00";
}

//Get race session list from the frontdesk
socket.on("nextRaceSession", (nextRaceInfo) => {
  console.log("⚠️ Received nextRaceSession:", nextRaceInfo);
  //don't update the race session if there is a race already in progress
  if (raceState === "running") {
    return;
  }

  if (nextRaceInfo && nextRaceInfo.length > 0) {
    sessionId = nextRaceInfo[0].sessionId;
    const driverList = nextRaceInfo.map((driver) => ({
      driverName: driver.driverName,
      carNumber: driver.carNumber,
    }));
    const raceSession = { sessionId, driverList };
    renderRacesession([raceSession]);
  } else {
    renderRacesession([]);
  }
});

function renderRacesession(raceSessions) {
  console.log("🎨 Rendering race session(s):", raceSessions);
  racesessionBody.innerHTML = ""; // Clear existing rows

  // Check if there are any race sessions
  if (raceSessions.length > 0) {
    safeToStartBtn.classList.remove("disabled");
    const upcomingSession = raceSessions[0];

    // Update Session ID in UI
    sessionIdElement.textContent = upcomingSession.sessionId;

    // Use the driverList from the first session
    upcomingSession.driverList.forEach((driver) => {
      const row = document.createElement("tr");
      row.innerHTML = `
          <td>${driver.carNumber}</td>
          <td>${driver.driverName}</td>
      `;
      racesessionBody.appendChild(row);
    });
  } else {
    // Reset session ID if no races available
    sessionIdElement.textContent = "N/A";
    sessionId = undefined;
    safeToStartBtn.classList.add("disabled");

    racesessionBody.innerHTML =
      '<tr><td colspan="5">No race sessions available.</td></tr>';
  }
}
