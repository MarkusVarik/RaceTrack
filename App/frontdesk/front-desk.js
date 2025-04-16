const socket = io();
const raceList = [];
let currentRaceIndex = null;
let globalDriverId = 1;

const driversTable = document.getElementById('drivers-table');
const newDriverInput = document.getElementById('new-driver');
const addDriverBtn = document.querySelector('.add-driver-btn');
const addRaceBtn = document.querySelector('.add-race-btn');
const raceTableBody = document.querySelector('.race-list tbody');

// Event Listeners
addDriverBtn.addEventListener('click', addDriver);
addRaceBtn.addEventListener('click', saveRace);

// --- Driver Management ---

function addDriver() {
  const driverName = newDriverInput.value.trim();
  if (!driverName) return alert("Please add the driver's name.");
  if (Array.from(driversTable.rows).some(row => row.cells[0].textContent === driverName))
    return alert('Driver already exists');
  if (driversTable.rows.length >= 8) return alert('Max 8 participants');

  const currentNumbers = Array.from(driversTable.rows).map(row => parseInt(row.cells[1].textContent));
  let carNumber;
  for (let i = 1; i <= 8; i++) {
    if (!currentNumbers.includes(i)) {
      carNumber = i;
      break;
    }
  }

  const driverRow = driversTable.insertRow();
  driverRow.dataset.driverId = globalDriverId++;
  driverRow.innerHTML = `
    <td>${driverName}</td>
    <td>${carNumber}</td>
    <td>
      <button type="button" class="edit-btn">Edit</button>
      <button type="button" class="delete-btn">Delete</button>
    </td>
  `;
  driverRow.querySelector('.edit-btn').addEventListener('click', () => editDriver(driverRow));
  driverRow.querySelector('.delete-btn').addEventListener('click', () => deleteDriver(driverRow));
  newDriverInput.value = '';
}

function editDriver(driverRow) {
  const currentName = driverRow.cells[0].textContent;
  const currentCarNumber = driverRow.cells[1].textContent;
  const editPrompt = prompt(`Edit driver name (current: ${currentName}) and car number (current: ${currentCarNumber})\nFormat: name;carNumber`, `${currentName};${currentCarNumber}`);
  if (editPrompt) {
    const editParts = editPrompt.split(';');
    if (editParts.length < 2) {
      alert('Invalid input format.');
      return;
    }
    const newName = editParts[0].trim();
    const newCarNumberStr = editParts[1].trim();
    const newCarNumber = parseInt(newCarNumberStr, 10);
    if (isNaN(newCarNumber) || newCarNumber < 1 || newCarNumber > 8) {
      alert('Car number must be an integer between 1 and 8.');
      return;
    }
    if (Array.from(driversTable.rows).some(row => row.cells[1].textContent === newCarNumber.toString() && row !== driverRow)) {
      alert('A driver with this car number already exists in the list.');
      return;
    }
    if (newName !== currentName && Array.from(driversTable.rows).some(row => row.cells[0].textContent === newName && row !== driverRow)) {
      alert('A driver with this name already exists in the list.');
      return;
    }
    driverRow.cells[0].textContent = newName;
    driverRow.cells[1].textContent = newCarNumber.toString();
  }
}

function deleteDriver(driverRow) {
  driverRow.remove();
}

// --- Race Management ---

async function saveRace() {
  const drivers = Array.from(driversTable.rows).map(row => ({
    driverId: row.dataset.driverId,
    driverName: row.cells[0].textContent,
    carNumber: row.cells[1].textContent
  }));
  if (!drivers.length) return alert('Add at least one driver');

  let raceNumber;
  if (currentRaceIndex !== null) {
    raceNumber = raceList[currentRaceIndex].sessionId;
  } else {
    raceNumber = await new Promise(resolve => {
      socket.emit("getNextSessionId", resolve);
    });
  }
  const raceSession = {
    sessionId: raceNumber,
    driverList: drivers
  };

  if (currentRaceIndex === null) {
    raceList.push(raceSession);
    socket.emit('scheduleRaceSession', {
      sessionDetails: raceSession
    });
  } else {
    raceList[currentRaceIndex] = raceSession;
    socket.emit('driverListChange', {
      sessionId: raceSession.sessionId,
      driverList: raceSession.driverList
    });
  }
  renderRaceList();
  clearForm();
}

function renderRaceList() {
  raceTableBody.innerHTML = '';

  raceList.forEach((race, index) => {
    const raceRow = raceTableBody.insertRow();
    raceRow.innerHTML = `
      <td>${race.sessionId}</td>
      <td>${race.driverList.length}</td>
      <td>
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </td>
    `;

    raceRow.querySelector('.edit-btn').addEventListener('click', () => editRace(index));
    raceRow.querySelector('.delete-btn').addEventListener('click', () => deleteRace(index));
  });
}

function editRace(index) {
  currentRaceIndex = index;
  const race = raceList[index];

  const sessionIdElement = document.querySelector('.session-id') || document.createElement('div');
  sessionIdElement.classList.add('session-id');
  if (!document.querySelector('.session-id')) {
    document.querySelector('.add-race-form h2').after(sessionIdElement);
  }
  sessionIdElement.textContent = `Editing: Race #${index + 1}`;

  driversTable.innerHTML = '';

  race.driverList.forEach(driver => {
    const driverRow = driversTable.insertRow();
    driverRow.dataset.driverId = driver.driverId;
    driverRow.innerHTML = `
      <td>${driver.driverName}</td>
      <td>${driver.carNumber}</td>
      <td>
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </td>
    `;
    driverRow.querySelector('.edit-btn').addEventListener('click', (event) => {
      event.preventDefault();
      editDriver(driverRow);
    });
    driverRow.querySelector('.delete-btn').addEventListener('click', (event) => {
      event.preventDefault();
      deleteDriver(driverRow);
    });
  });
}

function deleteRace(index) {
  const raceSessionId = raceList[index].sessionId;
  raceList.splice(index, 1);
  socket.emit('deleteRaceSession', { sessionId: raceSessionId });
  renderRaceList();
  clearForm();
}

function clearForm() {
  driversTable.innerHTML = '';
  currentRaceIndex = null;
  document.querySelector('.session-id')?.remove();
}

// --- Socket Listeners ---
socket.on('raceSessionsListUpdated', ({ raceSessions }) => {
  raceList.length = 0;
  raceList.push(...raceSessions);
  renderRaceList();
});

socket.on('driverListUpdated', ({ raceSessionId, driverList }) => {
  const raceSession = raceList.find(session => session.sessionId === raceSessionId);
  if (raceSession) {
    raceSession.driverList = driverList;
    renderRaceList();
  }
});

socket.on('reloadedScheduledRace', (sessionsWithDrivers) => {
  raceList.length = 0;
  if (sessionsWithDrivers && sessionsWithDrivers.length > 0) {
    raceList.push(...sessionsWithDrivers.map(session => ({
      sessionId: session.sessionId,
      driverList: session.driverList || []
    })));
  }
  renderRaceList();
});

socket.on("readyToStart", ({ sessionId }) => {
  const raceIndex = raceList.findIndex(race => race.sessionId === sessionId);
  if (raceIndex !== -1) {
    raceList.splice(raceIndex, 1);
    renderRaceList();
    clearForm();
  }
});