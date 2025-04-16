document.addEventListener("DOMContentLoaded", function () {
  const carButtonsContainer = document.getElementById("car-buttons");
  const sessionEnded = document.getElementById("session-ended");
  const statusText = document.getElementById("status-text");

  // Connect to the Socket.IO server
  const socket = io();

  let sessionId = null;
  let startTime = null;
  let carNumbers = [];

  // Capture car numbers when readyToStart event is received
  function handleReadyToStart(data) {
    // Safely check if driverList is a real array before calling .map() to avoid runtime errors
    if (data.driverList && Array.isArray(data.driverList)) {
      // Extract assigned car numbers
      carNumbers = data.driverList.map(driver => driver.carNumber);
    }
    sessionId = data.sessionId;
    // Update status text
    statusText.textContent = `🏎️ Race# ${sessionId} is ready to start!`;
  }
  
  function handleSessionStarted(data) {

    sessionId = data.sessionId;
    startTime = data.startTime; 

    // Ensure it's hidden when a new race starts
    sessionEnded.style.display = "none";
    // Update status text with session ID and green emoji for safe mode
    statusText.textContent = `🏎️ Race# ${sessionId} - Safe Mode 🟢`;
    // Clear any existing buttons
    carButtonsContainer.innerHTML = "";

    // If sessionStarted came with a driverList, use it ( when resume race)
    if (data.driverList && Array.isArray(data.driverList)) {
      carNumbers = data.driverList.map(driver => driver.carNumber);
    }
    
    // Create buttons based on stored car numbers
    if (carNumbers.length > 0) {
      // Use the car numbers we captured earlier
      carNumbers.forEach(carNumber => {
        const button = document.createElement("button");
        button.textContent = carNumber;
        button.classList.add("car-button");
        button.dataset.carNumber = carNumber;
        button.addEventListener("click", handleLapLineCrossed);
        carButtonsContainer.appendChild(button);
      });
    } else {
      // Fallback: Create default numbered buttons 1-8
      for (let i = 1; i <= 8; i++) {
        const button = document.createElement("button");
        button.textContent = i;
        button.classList.add("car-button");
        button.dataset.carNumber = i;
        button.addEventListener("click", handleLapLineCrossed);
        carButtonsContainer.appendChild(button);
      }
    }
  }

  function handleSessionEnded(sessionId) {
    // Update UI status
    statusText.textContent =  `🏎️ Race# ${sessionId} Finished 🏁`;
    // Disable all buttons
    document.querySelectorAll(".car-button").forEach(button => {
      button.disabled = true;
    });

    // Show session-ended message
    sessionEnded.style.display = "flex";
    // Clear car numbers when session ends
    carNumbers = [];
  }

  function handleLapLineCrossed(event) {
    const carNumber = event.target.dataset.carNumber;
    const timestamp = Date.now();

    // Follow the best practice, explicitly define its structure
    const lapData = {
      sessionId,
      carNumber,
      timestamp,
      startTime,
    };
    // Emit event to server with lap data
    socket.emit("lapLineCrossed", lapData);
  }

  function handleRaceModeChange(mode) {
    let emoji;
    
    switch (mode) {
      case "safe": emoji = "🟢"; break;
      case "hazard": emoji = "🟡"; break;
      case "danger": emoji = "🔴"; break;
      case "finish": emoji = "🏁"; break;
      default: mode = "danger"; emoji = "🔴";
  }
    // Update status text with emoji
    statusText.textContent = `🏎️ Race# ${sessionId} - ${mode} mode ${emoji}`;
  }

  // Listen for real-time events from the server
  socket.on("readyToStart", handleReadyToStart);
  socket.on("sessionStarted", handleSessionStarted);
  socket.on("sessionEnded", handleSessionEnded);
  socket.on("raceModeUpdate", handleRaceModeChange);
});


