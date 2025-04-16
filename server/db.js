// Import sqlite3 library
const sqlite3 = require("sqlite3").verbose();
// Database file path, in server directory
const dbFilePath = "./racetrack.db";

// Open or create the SQLite database file
const db = new sqlite3.Database(dbFilePath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

function initializeDatabase() {
  // Return a new Promise to handle the asynchronous database initialization process
  return new Promise((resolve, reject) => {
    // Use db.serialize() to execute database operations sequentially
    db.serialize(() => {
      // Create the RaceSessions table
      db.run(
        // SQL command to create the 'RaceSessions' table
        `CREATE TABLE IF NOT EXISTS RaceSessions (
                    sessionId INTEGER PRIMARY KEY,
                    /* 
                    Store Unix timestamp (milliseconds) for time difference calculations 
                    without needing to convert from an ISO string 
                    */
                    startTime INTEGER, 
                    raceMode TEXT,
                    status TEXT
                )`,
        (err) => {
          if (err) {
            // Callback function executed after db.run() attempts to execute the SQL command
            // If an error occurred during table creation (e.g., SQL syntax error, database error)
            console.error("Error creating RaceSessions table:", err.message);
            reject(err); // Reject the Promise, indicating database initialization failed
            return; // Stop further execution within this callback and db.serialize()
          }
          console.log("RaceSessions table created or already exists.");
        }
      );
      // Create the SessionDrivers table
      db.run(
        `CREATE TABLE IF NOT EXISTS SessionDrivers (
                    sessionId INTEGER,
                    driverId INTEGER,
                    driverName TEXT,
                    carNumber INTEGER,
                    /*
                     * Primary key is a combination here.
                     * This means that within a specific race session (sessionId), each driver (driverId) can only appear once.
                     */
                    PRIMARY KEY (sessionId, driverId),
                    FOREIGN KEY (sessionId) REFERENCES RaceSessions(sessionId),
                    /* 
                     * This creates a unique constraint on the combination of sessionId and carNumber.
                     * This ensures that within a single race session, each car number can only be assigned to one driver.
                     */
                    UNIQUE (sessionId, carNumber)
                )`,
        (err) => {
          if (err) {
            console.error("Error creating SessionDrivers table:", err.message);
            reject(err);
            return;
          }
          console.log("SessionDrivers table created or already exists.");
        }
      );
      // Create the LapTimes table
      db.run(
        `CREATE TABLE IF NOT EXISTS LapTimes (
                    lapId INTEGER PRIMARY KEY AUTOINCREMENT,
                    sessionId INTEGER,
                    carNumber INTEGER,
                    lapNumber INTEGER,
                    lapTime REAL,
                    timestamp INTEGER, /* Store Unix timestamp (milliseconds) */
                    FOREIGN KEY (sessionId) REFERENCES RaceSessions(sessionId)
                )`,
        (err) => {
          if (err) {
            console.error("Error creating LapTimes table:", err.message);
            reject(err);
            return;
          }
          console.log("LapTimes table created or already exists.");
        }
      );

      /* Create indexes to speed up query performance
       * by allowing the database engine to locate data without scanning the entire table
       * Once created, SQLite automatically uses indexes when we include indexed columns in queries
       */
      db.run(
        // Create index for LapTimes on sessionId and car
        `CREATE INDEX IF NOT EXISTS idx_laptimes_session_car 
        ON LapTimes (sessionId, carNumber)`,
        (err) => {
          if (err)
            console.error("Error creating index on LapTimes:", err.message);
          else console.log("Index on LapTimes(sessionId, carNumber) created.");
        }
      );
      db.run(
        // Create index for SessionDrivers on sessionId
        `CREATE INDEX IF NOT EXISTS idx_sessiondrivers_sessionid ON SessionDrivers (sessionId)`,
        (err) => {
          if (err)
            console.error(
              "Error creating index on SessionDrivers.sessionId:",
              err.message
            );
          else console.log("Index on SessionDrivers.sessionId created.");
        }
      );
      db.run(
        // Create index for SessionDrivers on carNumber
        `CREATE INDEX IF NOT EXISTS idx_sessiondrivers_carNumber ON SessionDrivers (carNumber)`,
        (err) => {
          if (err)
            console.error(
              "Error creating index on SessionDrivers.carNumber:",
              err.message
            );
          else console.log("Index on SessionDrivers.carNumber created.");
        }
      );
      resolve(); // Resolve the promise when all commands are done
    });
  });
}

// --- Race Session Management ---

// To schedule a new race session in the RaceSessions table
function scheduleRaceSession(sessionDetails) {
  return new Promise((resolve, reject) => {
    // Extract the session details
    const { sessionId, driverList } = sessionDetails;
    // Insert the race session into RaceSessions table, set status to 'Pending'
    db.run(
      `INSERT INTO RaceSessions (sessionId, status) VALUES (?, ?)`,
      [sessionId, "Pending"],
      function (err) {
        if (err) {
          console.error("Error scheduling race session:", err.message);
          reject(err);
          return;
        }
        // Insert the drivers into SessionDrivers table in a batch
        if (driverList && driverList.length > 0) {
          const placeholders = driverList.map(() => "(?, ?, ?, ?)").join(",");
          const values = driverList.flatMap((driver) => [
            sessionId,
            driver.driverId,
            driver.driverName,
            driver.carNumber,
          ]);

          db.run(
            `INSERT INTO SessionDrivers (sessionId, driverId, driverName, carNumber) VALUES ${placeholders}`,
            values,
            function (err) {
              if (err) {
                console.error("Error adding drivers in batch:", err.message);
              }
              resolve();
            }
          );
        } else {
          console.warn(
            `Race session ${sessionId} scheduled without any drivers.`
          );
          resolve(); // Resolve even if no drivers are present
        }
      }
    );
  });
}

// To start a race session by recording the startTime, setting the status to 'Running', and setting the raceMode to 'Safe'
function startRaceSession(sessionId, startTime) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE RaceSessions 
            SET startTime = ?, status = ?, raceMode = ? 
            WHERE sessionId = ?`,
      [startTime, "Running", "safe", sessionId],
      function (err) {
        if (err) {
          console.error("Error starting race session:", err.message);
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

// To get the next upcoming race session info for the Next Race Interface
function getNextRaceInfo() {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT rs.sessionId, sd.driverName, sd.carNumber
            FROM RaceSessions rs
            LEFT JOIN SessionDrivers sd ON rs.sessionId = sd.sessionId
            WHERE rs.status = 'Pending'
            AND rs.sessionId = (SELECT MIN(sessionId) FROM RaceSessions WHERE status = 'Pending')
            ORDER BY sd.carNumber ASC
        `;
    db.all(sql, (err, rows) => {
      if (err) {
        console.error("Error getting next race:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
}

// To update the race mode of current race session in the RaceSessions table
function updateRaceMode(raceMode) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE RaceSessions SET raceMode = ? WHERE status = ?`,
      [raceMode, "Running"],
      function (err) {
        if (err) {
          console.error("Error updating race mode:", err.message);
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

// To delete a complete race session by removing all related data
async function deleteRaceSession(sessionId) {
  try {
    // Delete all lap time records related to the session
    await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM LapTimes WHERE sessionId = ?`,
        [sessionId],
        function (err) {
          if (err) {
            console.error("Error deleting LapTimes:", err.message);
            return reject(err);
          }
          resolve();
        }
      );
    });

    // Delete all drivers associated with the session
    await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM SessionDrivers WHERE sessionId = ?`,
        [sessionId],
        function (err) {
          if (err) {
            console.error("Error deleting SessionDrivers:", err.message);
            return reject(err);
          }
          resolve();
        }
      );
    });

    // Finally, delete the session itself
    await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM RaceSessions WHERE sessionId = ?`,
        [sessionId],
        function (err) {
          if (err) {
            console.error("Error deleting RaceSessions:", err.message);
            return reject(err);
          }
          resolve();
        }
      );
    });
  } catch (error) {
    console.error(`Failed to delete session ${sessionId}:`, error.message);
  }
}

// To end a race session by updating the status to 'Ended'
function endRaceSession(sessionId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE RaceSessions SET status = ? WHERE sessionId = ?`,
      ["Ended", sessionId],
      function (err) {
        if (err) {
          console.error("Error ending race session:", err.message);
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

// --- Driver Management ---

// To retrieve a list of drivers for a specific race session
function getDriversForSession(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT driverId, driverName, carNumber FROM SessionDrivers WHERE sessionId = ?`,
      [sessionId],
      (err, rows) => {
        if (err) {
          console.error("Error getting drivers for session:", err.message);
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

// To update driver list in existing race session
function updateSessionDrivers(sessionId, driverList) {
  return new Promise(async (resolve, reject) => {
    try {
      // Clear existing drivers for the session
      await new Promise((res, rej) => {
        db.run(
          `DELETE FROM SessionDrivers WHERE sessionId = ?`,
          [sessionId],
          (err) => {
            if (err) {
              console.error("Error clearing session drivers:", err.message);
              rej(err);
              return;
            }
            res();
          }
        );
      });

      // Insert the new driver list
      if (driverList && driverList.length > 0) {
        const placeholders = driverList.map(() => "(?, ?, ?, ?)").join(",");
        const values = driverList.flatMap((driver) => [
          sessionId,
          driver.driverId,
          driver.driverName,
          driver.carNumber,
        ]);

        await new Promise((res, rej) => {
          db.run(
            `INSERT INTO SessionDrivers (sessionId, driverId, driverName, carNumber) VALUES ${placeholders}`,
            values,
            function (err) {
              if (err) {
                console.error(
                  "Error inserting new session drivers:",
                  err.message
                );
                rej(err);
                return;
              }
              res();
            }
          );
        });
      }
      resolve();
    } catch (error) {
      console.error("Error in updateSessionDrivers:", error);
      reject(error);
    }
  });
}

// --- Lap Data Managment ---

// To record a lap time for a specific car in a specific race session
async function recordLapTime(lapData) {
  const { sessionId, carNumber, timestamp, startTime } = lapData;
  const currentTime = timestamp || Date.now();

  // Get the last lap data
  const lastLap = await new Promise((resolve, reject) => {
    db.get(
      `SELECT lapNumber, timestamp
       FROM LapTimes
       WHERE sessionId = ? AND carNumber = ?
       ORDER BY lapNumber DESC
       LIMIT 1`,
      [sessionId, carNumber],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  // Calculate lap number and lap time
  const lapNumber = lastLap ? lastLap.lapNumber + 1 : 1;
  const lapTime = lastLap
    ? currentTime - lastLap.timestamp
    : currentTime - startTime;

  // Insert the new lap
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO LapTimes (sessionId, carNumber, lapNumber, lapTime, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, carNumber, lapNumber, lapTime, currentTime],
      function (err) {
        if (err) reject(err);
        else resolve(true); // Just return true to indicate success
      }
    );
  });
}

// To get leaderboard data (current lap, fastest lap times for each car)
function getLeaderboardForSession(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT
        lt.carNumber,
        MIN(lt.lapTime) AS fastestLap,
        MAX(lt.lapNumber) AS currentLap
      FROM LapTimes lt
      WHERE lt.sessionId = ?
      GROUP BY lt.carNumber
      ORDER BY fastestLap ASC`,
      [sessionId],
      (err, rows) => {
        if (err) {
          console.error("Error getting leaderboard data:", err.message);
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

// --- Implementing Database Closure ---

// To close the database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error("Error closing database:", err.message);
          reject(err);
        } else {
          console.log("Database connection closed");
          resolve();
        }
      });
    } else {
      /* The second resolve() handles the case where db is already null or undefined, 
            meaning there's no database connection to close */
      resolve();
    }
  });
}

// --- Implementing Race Restore ---

// To get running session
function getOngoingRace() {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT sessionId, startTime, raceMode 
      FROM RaceSessions 
      WHERE status = 'Running'`,
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

// To get all the pending sessions
function getPendingSessions() {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT sessionId FROM RaceSessions 
      WHERE status = 'Pending' 
      ORDER BY sessionId ASC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getMaxSessionId() {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT MAX(sessionId) as maxId FROM RaceSessions`,
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.maxId || 0);
            }
        );
    });
}

// Export all functions at once
module.exports = {
  initializeDatabase,
  scheduleRaceSession,
  startRaceSession,
  getNextRaceInfo,
  updateRaceMode,
  deleteRaceSession,
  endRaceSession,
  getDriversForSession,
  updateSessionDrivers,
  recordLapTime,
  getLeaderboardForSession,
  closeDatabase,
  getOngoingRace,
  getPendingSessions,
    getMaxSessionId
};
