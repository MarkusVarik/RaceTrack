const db = require("./db");

async function emitNextRaceSession(io) {
    const nextRaceInfo = await db.getNextRaceInfo();
    io.emit("nextRaceSession", nextRaceInfo);
}

async function resumeOngoingRace(io, isDeveloperMode) {
    try {
        const row = await db.getOngoingRace();
        if (!row) {
            // Log and return if there are no ongoing races
            console.log("🔍 No ongoing race session");
            return;
        }
        // Check for finish condition before resuming
        const elapsed = (Date.now() - new Date(row.startTime).getTime()) / 1000;
        const duration = isDeveloperMode ? 60 : 600;

        if (elapsed >= duration) {
            console.log(`Race session ${row.sessionId} already expired. Ending now...`);
            
            const leaderboardData = await db.getLeaderboardForSession(row.sessionId);
            io.emit("updateLeaderboard", leaderboardData);

            await db.endRaceSession(row.sessionId);

            io.emit("raceModeUpdate", "finish");
            io.emit("timerUpdate", "00:00");
            io.emit("sessionEnded", row.sessionId);
            return; // Stop resume logic
        }

        console.log(`✅ Resuming race session ${row.sessionId} | Mode: ${row.raceMode}`);

        const driverList = await db.getDriversForSession(row.sessionId);

        io.emit("sessionStarted", {
            sessionId: row.sessionId,
            startTime: row.startTime,
            raceMode: row.raceMode,
            isDeveloperMode,
            source: "resume",
            driverList,
        });

        io.emit("raceModeUpdate", row.raceMode);

        const leaderboardData = await db.getLeaderboardForSession(row.sessionId);
        io.emit("updateLeaderboard", leaderboardData);
        
    } catch (err) {
        console.error("❌ Error resuming ongoing race:", err);
    }
}

async function getAllPendingSessionsWithDrivers() {
    const sessions = await db.getPendingSessions();
  
    // To fetch drivers for all sessions in parallel with Promise.all, making it much faster
    const sessionsWithDrivers = await Promise.all(
      sessions.map(async ({ sessionId }) => {
        const driverList = await db.getDriversForSession(sessionId);
        return { sessionId, driverList };
      })
    );
    return sessionsWithDrivers;
}

async function resumeScheduledRaces(io) {
    try {
        const sessions = await getAllPendingSessionsWithDrivers();
        io.emit("reloadedScheduledRace", sessions);
    } catch (err) {
        console.error("Error in resumeScheduledRaces:", err);
    }
}

async function restoreRaceState(io, isDeveloperMode) {
    await resumeOngoingRace(io, isDeveloperMode);
    await resumeScheduledRaces(io);
    await emitNextRaceSession(io);
}

module.exports = {
    restoreRaceState,
};