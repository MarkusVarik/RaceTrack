const socket = io();

document.addEventListener("DOMContentLoaded", () => {
  const flagDisplay = document.getElementById("flag-display");
  const flagLabel = document.getElementById("flag-label");
  const fullscreenBtn = document.getElementById("fullscreen-btn");

  // Full screen mode for flags
  fullscreenBtn.addEventListener("click", toggleFullScreen);
  function toggleFullScreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      flagDisplay.requestFullscreen();
    }
  }

  function handleRaceModeChange(mode) {
    // Remove previous chequered class if it exists
    flagDisplay.classList.remove("chequered-flag");
    
    const flagColors = {
      safe: "green",
      hazard: "yellow",
      danger: "red",
      finish: "transparent",
    };

    if (mode === "finish") {
      flagDisplay.classList.add("chequered-flag");
    }

    flagDisplay.style.backgroundColor = flagColors[mode] || "red";
    flagLabel.textContent = `Race in ${mode} mode`;
  }
  socket.on("raceModeUpdate", handleRaceModeChange);
});



