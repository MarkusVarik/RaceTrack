const socket = io();
const leaderboardBody = document.getElementById('leaderboard-body');
const timerDisplay = document.getElementById("race-timer");

// Data stores for drivers and lap times
let currentDriverList = [];
let currentLapData = [];

function formatLapTime(milliseconds) {
    if (!milliseconds) return 'N/A';
    // Convert using ISO string and extract relevant time portion
    return new Date(milliseconds).toISOString().slice(14, 23).replace('.', ':');
}

function renderLeaderboard() {
    leaderboardBody.innerHTML = currentDriverList.length ?
        // Combine driver info with their lap data (if any)
        currentDriverList.map(driver => ({
            ...driver,
            ...(currentLapData.find(lap => lap.carNumber === driver.carNumber) || {}),
            driverName: driver.driverName || 'Unknown Driver'  // Default if missing
        }))
            // Sort by fastest lap (untimed drivers go to bottom)
            .sort((a, b) => (a.fastestLap || Infinity) - (b.fastestLap || Infinity))
            // Generate HTML rows
            .map((driver, index) => `
            <tr>
                <td>${index + 1}</td>  <!-- Position -->
                <td>${driver.carNumber || 'N/A'}</td>
                <td>${driver.driverName}</td>
                <td>${formatLapTime(driver.fastestLap)}</td> 
                <td>${driver.currentLap || 0}</td>  
            </tr>
        `).join('')
        : '<tr><td colspan="5">No drivers to display. Waiting for race data...</td></tr>';
}

// Race mode updates
socket.on('raceModeUpdate', (mode) => {
    const messageElement = document.getElementById('system-message');
    let messageText;
    let color;

    switch (mode) {
        case 'safe':
            messageText = '✅ Safe';
            color = 'green';
            break;
        case 'hazard':
            messageText = '⚠️ Hazard';
            color = 'yellow';
            break;
        case 'danger':
            messageText = '🛑 Danger';
            color = 'red';
            break;
        case 'finish':
            messageText = '🏁 Finish';
            color = 'white';
            break;
        default:
            messageText = '🛑 Unknown';
            color = 'red';
    }

    if (messageElement) {
        messageElement.textContent = messageText;
        messageElement.style.color = color;
    }
});

// Initial driver data after race start
socket.on('readyToStart', (raceData) => {
    currentDriverList = raceData?.driverList || [];
    currentLapData = [];
    renderLeaderboard();
});

// Live lap time updates
socket.on('updateLeaderboard', (lapData) => {
    currentLapData = lapData || [];
    renderLeaderboard();
});

// Race timer updates
socket.on("timerUpdate", (timeFormatted) => {
    if (timerDisplay) timerDisplay.textContent = timeFormatted;
});


socket.on('reloadedScheduledRace', (sessionsWithDrivers) => {
    if (sessionsWithDrivers && sessionsWithDrivers.length > 0) {
        const nextRace = sessionsWithDrivers[0];
        if (nextRace.driverList && (!currentDriverList.length || currentDriverList.length === 0)) {
            currentDriverList = nextRace.driverList;
            renderLeaderboard();
        }
    }
});


socket.on("sessionEnded", (sessionId) => {
    currentDriverList = [];
    currentLapData = [];
    renderLeaderboard();

    if (timerDisplay) timerDisplay.textContent = "00:00";
});

socket.on('sessionStarted', (raceData) => {
    if (!raceData.source) return;
    if (raceData.driverList && raceData.driverList.length > 0) {
        currentDriverList = raceData?.driverList || [];
        currentLapData = [];
        renderLeaderboard();
    }
});

// Initial render. "No drivers to display..."
renderLeaderboard();