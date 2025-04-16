const socket = io();

socket.on("timerUpdate", (timeFormatted) => {
  const bigTimer = document.querySelector(".bigtimer");
  bigTimer.textContent = timeFormatted;
});
