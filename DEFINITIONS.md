
## **Front Desk:**

* **Actions**: Schedule race sessions, register drivers, manage driver lists for sessions, view next race.
* **Events (Inbound - to Server):** `scheduleRaceSession`, `driverListChange`.
* **Events (Outbound - from Server):** `driverListUpdated`, `nextRaceSession`, `raceSessionsListUpdated`.

## **Race Control:**
*   **Actions:** Start race session, end race session, change race mode (Safe, Hazard, Danger, Finish), view current race mode, view next race info.
*   **Events (Inbound - to Server):** `raceModeChange`, `raceStart`, `raceEnd`.
*   **Events (Outbound - from Server):** `raceModeUpdate`, `nextRaceSession`, `driverListUpdated`, `raceSessionsListUpdated`.

## **Lap-line Tracker:**
*   **Actions:** Register lap times for cars.
*   **Events (Inbound - to Server):** `lapLineCrossed`.
*   **Events (Outbound - from Server):** `raceStart`, `raceModeUpdate`, `raceEnd`.

## **Leaderboard:**
*   **Actions:** Display real-time leaderboard, lap times, driver info, race mode.
*   **Events (Outbound - from Server):** `raceStart`, `lapDataUpdated`, `raceModeUpdate`, `driverListUpdated`, `raceEnd`.

## **Race Flags:**
*   **Actions:** Display race flag color and label based on race mode.
*   **Events (Outbound - from Server):** `raceStart`, `raceModeUpdate`, `raceEnd`.

## **Next Race:**
*   **Actions:** Display information about the upcoming "Next Race Session".
*   **Events (Outbound - from Server):** `nextRaceSession`.

---
## Data Structures

---

### 1. `RaceSession` 

**Description:** Represents a single race session at the racetrack.

**Properties:**

*   `sessionId` (String):  Unique identifier for the race session.
*   `actualStartTime` (String):  The actual start time of the session.
*   `raceMode` (String):  Current race mode of the session (e.g., "Safe", "Hazard", "Danger", "Finish").
*   `status` (String):  Current status of the session (e.g., "Pending", "Running", "Finished", "Ended").

### 2. `Driver`

**Description:** Represents a driver participating in a race session.

**Properties:**

*   `driverId` (String):  Unique identifier for the driver (e.g., "driver-1").
*   `driverName` (String):  Driver's full name (e.g., "John Smith").
*   `carNumber` (String):  Car number assigned to the driver for the current race session (e.g., "7").

### 3. `LapData`

**Description:** Represents data for a single lap recorded by a car during a race session.

**Properties:**
* `lapId` (Number): Unique identifier for the lap record in the database.
*   `sessionId` (String):  ID of the `RaceSession` to which this lap data belongs.
*   `carNumber` (String):  Car number that completed the lap.
*   `lapNumber` (Number):  Sequential lap number (1, 2, 3, ...).
*   `lapTime` (Number):  Lap time in milliseconds.
*   `timestamp` (Timestamp):  Time when the lap line was crossed.


---

## Real-time Events: 

---

### 1. Handle schedule new session

#### `scheduleRaceSession` --- > `nextRaceSession` --- >

**Description:** Event sent by the Front Desk to the server to request the scheduling of a new race session.

**Direction:** Sender: Front Desk  ->  Receiver: Server

**socket.on('scheduleRaceSession', sessionDetails),
io.emit('nextRaceSession', nextRaceInfo)**

### 2. Handle ready to start

#### `safeToStart` --- > `readyToStart` --- >

**socket.on('safeToStart', sessionId), io.emit('readyToStart', sessionId)**

### 3. Handle race start

#### `raceStart` --- > `sessionStarted` --- >

**Description:** Event sent by the Race Control to the server to explicitly signal the start of a race session.

**Direction:** Sender: Race Control -> Receiver: Server

**socket.on('raceStart', sessionId, actualStartTime), 
io.emit('sessionStarted', sessionId, actualStartTime)**

### 4. Handle race mode change

#### `raceModeChange`--- > `raceModeUpdate` --- > 

**Description:**  Event sent by the Race Control Interface to the server when the Safety Official changes the race mode (e.g., to "Hazard", "Safe", "Danger", or "Finish").

**Direction:** Sender: Race Control Interface  ->  Receiver: Server

**socket.on('raceModeChange', mode), io.emit('raceModeUpdate', mode)**

### 5. Handle lap-line

#### `lapLineCrossed` --- > `updateLeaderboard` --- >

**Description:** Event sent by the Lap-line Tracker Interface to the server when the Lap-line Observer registers a car crossing the lap line (e.g., by clicking a button)

**Direction:** Sender: Lap-line Tracker Interface  ->  Receiver: Server

**socket.on('lapLineCrossed', lapData), io.emit('updateLeaderboard', leaderboardData)**


### 6. Handle race end

#### `raceEnd` --- >  `sessionEnded` --- >

**Description:** Event sent by the Race Control to the server to explicitly signal the end of a race session.

**Direction:** Sender: Race Control -> Receiver: Server

**socket.on('raceEnd', sessionId), io.emit('sessionEnded', sessionId)**

### 7. Handle driver change in existing session

#### `driverListChange`  --- > 

#### `driverListUpdated` --- >

 **When:** The receptionist adds, removes, or edits drivers for an existing session.

**Direction:** Sender: Front Desk -> Receiver: Server

**socket.on('driverListChange', sessionId, driverList),
io.emit('driverListUpdated', sessionId, driverList)**


### 8. Handle delete race session

#### `deleteRaceSession` --- > `nextRaceSession` --- >

**socket.on('deleteRaceSession', sessionId), 
io.emit('nextRaceSession', nextRaceInfo)**


