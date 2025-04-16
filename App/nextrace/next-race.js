const socket = io();

const driverListTable = document.getElementById('driver-list');

function renderNextRace(raceSessions) {
    driverListTable.innerHTML = ''; // Clear existing rows

    if (raceSessions.length > 0) {
        const firstSession = raceSessions[0];
        //Use drivers from firstSession available in the list
        firstSession.driverList.forEach(driver => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${driver.carNumber}</td>
                <td>${driver.driverName}</td>
            `;
            driverListTable.appendChild(row);
            document.getElementById('system-message').innerHTML = 'Proceed to paddock';
        });
    } else {
        document.getElementById('system-message').innerHTML = 'No race sessions available.';
    }
}

socket.on('nextRaceSession', (nextRaceInfo) => {
    if (nextRaceInfo && nextRaceInfo.length > 0) {
        const sessionId = nextRaceInfo[0].sessionId;
        const driverList = nextRaceInfo.map(driver => ({
            driverName: driver.driverName,
            carNumber: driver.carNumber
        }));
        const raceSession = { sessionId, driverList };
        renderNextRace([raceSession]);
    } else {
        renderNextRace([]);
    }
});

// Listen for timer updates from the server
socket.on("timerUpdate", (timeFormatted) => {
    const timerDisplay = document.getElementById("race-timer");
    if (timerDisplay) {
        timerDisplay.textContent = timeFormatted;
    }
});

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}
