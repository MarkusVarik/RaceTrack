const express = require("express");

const http = require("http");
const { tunnelmole } = require("tunnelmole");
process.env.TUNNELMOLE_QUIET_MODE = "1";

//real time bidirectional event based communication
const { Server } = require("socket.io");

//Helps in dealing with file and directory paths
const path = require("path");
const { env } = require("process");

//for login and access keys
const session = require("express-session");
const bcrypt = require("bcrypt");
// Load environment variables from .env file
require("dotenv").config({ path: path.join(__dirname, "..", "keys.env") });

//This creates an Express application.
// This object will allow defining routes and middleware.
const app = express();

// This creates an HTTP server from the app
const server = http.createServer(app);

//This initializes a new instance of the Socket.IO server by passing the server object.
//io allows for real-time WebSocket communication.
const io = new Server(server);

// Importing the Database module
const db = require("./db");
// For data persistence
const { restoreRaceState } = require("./raceStateRestorer");

// Static files from the 'App' folder, which is at the root level
app.use(express.static(path.join(__dirname, "..", "App")));

//for adding developer mode - which would make the timer run for 1 minute instead of 10 minutes
const isDeveloperMode = env.DEVELOPER == "true";

// Ensure required environment variables are set
if (!process.env.RACE_CONTROL_PASSWORD || !process.env.FRONT_DESK_PASSWORD) {
  console.error(
    "ERROR: Missing required environment variables for access keys."
  );
  process.exit(1); // Stop server execution
}

//passwords
const users = {
  "race-control": {
    username: "raceadmin",
    password: process.env.RACE_CONTROL_PASSWORD, // Password from environment variable
  },
  "front-desk": {
    username: "frontadmin",
    password: process.env.FRONT_DESK_PASSWORD, // Password from environment variable
  },
  "lap-line-tracker": {
    username: "laplineadmin",
    password: process.env.LAP_LINE_PASSWORD, // Password from environment variable
  },
};

app.use(express.json());
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret", // Use environment secret
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware to protect race control and front desk
function isAuthenticated(interfaceType) {
  return (req, res, next) => {
    if (req.session.user && req.session.interfaceType === interfaceType) {
      return next();
    } else {
      // Save the interfaceType to session or as a query param
      req.session.interfaceType = interfaceType; // Storing the original requested interface
      res.redirect("/login"); // Redirect to login page
    }
  };
}

//Route for login:
app.get("/login", (req, res) => {
  console.log("Serving login.html");
  res.sendFile(path.join(__dirname, "..", "App", "public", "login.html"));
});

// Login Route
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const { interfaceType } = req.session;

  // Check the credentials
  const user = users[interfaceType];
  if (
    username === user.username &&
    bcrypt.compareSync(password, user.password)
  ) {
    req.session.user = user; // Save user in session
    // Redirect back to the intended interface, if available
    const redirectTo = `/${interfaceType}`;

    res.json({ success: true, redirectTo });
  } else {
    setTimeout(() => {
      res.json({ success: false, message: "Invalid credentials.Try Again" });
    }, 500); // Delay response by 500ms
  }
});

// Route for homepage:
app.get("/", (req, res) => {
  console.log("Serving homepage.html");
  res.sendFile(path.join(__dirname, "..", "App", "public", "homepage.html"));
});

// Route for race-control
app.get("/race-control", isAuthenticated("race-control"), (req, res) => {
  console.log("Serving race-control.html");
  //sends a specific file in response to a request
  res.sendFile(
    //this path is ugly but helps running the server from any directory without any issues
    path.join(__dirname, "..", "App", "racecontrol", "race-control.html")
  );
});

// Route for race-flags
app.get("/race-flags", (req, res) => {
  console.log("Serving race-flags.html");
  res.sendFile(
    path.join(__dirname, "..", "App", "raceflags", "race-flags.html")
  );
});

// Route for lap-line-tracker
app.get(
  "/lap-line-tracker",
  isAuthenticated("lap-line-tracker"),
  (req, res) => {
    console.log("Serving lap-line-tracker.html");
    res.sendFile(
      path.join(
        __dirname,
        "..",
        "App",
        "laplinetracker",
        "lap-line-tracker.html"
      )
    );
  }
);

//Route for race-countdown
app.get("/race-countdown", (req, res) => {
  console.log("Serving race-countdown.html");
  res.sendFile(
    path.join(__dirname, "..", "App", "racecountdown", "race-countdown.html")
  );
});

// Route for /front-desk
app.get("/front-desk", isAuthenticated("front-desk"), (req, res) => {
  console.log("Serving front-desk.html");
  res.sendFile(
    path.join(__dirname, "..", "App", "frontdesk", "front-desk.html")
  );
});

// Route for /leader-board
app.get("/leader-board", (req, res) => {
  console.log("Serving leader-board.html");
  res.sendFile(
    path.join(__dirname, "..", "App", "leaderboard", "leader-board.html")
  );
});

// Route for /next-race
app.get("/next-race", (req, res) => {
  console.log("Serving next-race.html");
  res.sendFile(path.join(__dirname, "..", "App", "nextrace", "next-race.html"));
});

let isRaceInProgress = false;

// "connection" is a special event that fires when a client connects to the server.
//This event happens at the global level—it is fired for every new client that connects.
io.on("connection", async (socket) => {
  console.log("A user connected:", socket.id);

  socket.emit("setConfiguration", { isDeveloperMode });

  /* Listen for built-in client-side event that fires automatically 
  if the client fails to connect (e.g., server is down, bad port, dropped network) */
  socket.on("connect_error", (err) => {
    console.error("❌ Socket connection failed:", err.message);
    setTimeout(() => {
      window.location.reload();
    }, 3000); // Try reloading after 3 seconds
  });

  // --- For data persistence, ensure new clients receive all necessary state ---
  // Send running race session if exists
  const ongoingRace = await db.getOngoingRace();
  if (ongoingRace) {
    console.log(`🔁 Sending resume info to client ${socket.id} for race ${ongoingRace.sessionId}`);
    const driverList = await db.getDriversForSession(ongoingRace.sessionId);
    
    socket.emit("sessionStarted", {
      sessionId: ongoingRace.sessionId,
      startTime: ongoingRace.startTime,
      raceMode: ongoingRace.raceMode,
      isDeveloperMode,
      source: "resume",
      driverList,
    });

    socket.emit("raceModeUpdate", ongoingRace.raceMode);
    const leaderboard = await db.getLeaderboardForSession(ongoingRace.sessionId);
    socket.emit("updateLeaderboard", leaderboard);
  }

  const nextRaceInfo = await db.getNextRaceInfo();
  socket.emit("nextRaceSession", nextRaceInfo);

  // Send all pending sessions
  const pendingSessions = await db.getPendingSessions();
  const sessionsWithDrivers = await Promise.all(
    pendingSessions.map(async ({ sessionId }) => {
      const driverList = await db.getDriversForSession(sessionId);
      return { sessionId, driverList };
    })
  );
  socket.emit("reloadedScheduledRace", sessionsWithDrivers);
  // ---

  // Handle schedule a new race session
  socket.on("scheduleRaceSession", async ({ sessionDetails }) => {
    console.log(
      `Received 'scheduleRaceSession' event for session ${sessionDetails.sessionId}`
    );
    try {
      await db.scheduleRaceSession(sessionDetails);
      console.log(`Scheduled a new race in DB`);
      /* After a new race session is successfully scheduled in the database,
       the server will immediately fetch the information for the next upcoming race */
      if (!isRaceInProgress) {
        const nextRaceInfo = await db.getNextRaceInfo();
        io.emit("nextRaceSession", nextRaceInfo);
      }
    } catch (err) {
      console.error("Error scheduling race session:", err);
    }
  });

  // Handle race mode change
  socket.on("raceModeChange", async (mode) => {
    console.log(`Race mode changed to: ${mode}`);
    try {
      await db.updateRaceMode(mode);
      console.log(`Current session updated new race mode to ${mode} in DB`);

      // Broadcast the new mode to all clients
      io.emit("raceModeUpdate", mode);
    } catch (err) {
      console.error("Error updating race mode in DB:", err);
    }
  });

  // Handle race ready to start
  socket.on("safeToStart", async (sessionId) => {
    console.log(`Received 'safeToStart' event for race session ${sessionId}`);
    try {
      isRaceInProgress = true;
      const driverList = await db.getDriversForSession(sessionId);
      io.emit("readyToStart", { sessionId, driverList });
    } catch (error) {
      console.error("Error fetching drivers for safeToStart:", error);
    }
  });

  // Handle race start
  socket.on("raceStart", async ({ sessionId, startTime }) => {
    console.log(`Received 'raceStart' event for race session ${sessionId}`);
    try {
      io.emit("sessionStarted", { sessionId, startTime });
      await db.startRaceSession(sessionId, startTime);
      console.log(
        `Updated race session ${sessionId} started at ${startTime} in DB`
      );
      const nextRaceInfo = await db.getNextRaceInfo();
      io.emit("nextRaceSession", nextRaceInfo);
    } catch (err) {
      console.error(`Error starting race session ${sessionId}:`, err);
    }
  });

  // Handle race mode change
  socket.on("raceModeChange", async (mode) => {
    console.log(`Received 'raceModeChange' event: ${mode}`);
    try {
      await db.updateRaceMode(mode);
      console.log(`Current session updated new race mode to ${mode} in DB`);
      io.emit("raceModeUpdate", mode);
    } catch (err) {
      console.error("Error updating race mode in DB:", err);
    }
  });

  // Handle the event when driver cross the lap line
  socket.on("lapLineCrossed", async (lapData) => {
    console.log(`Received 'lapLineCrossed' event:`, lapData);
    try {
      // Calculate lap time and lap number, record lap data in database
      await db.recordLapTime(lapData);
      // Retrieve the updated leaderboard data for the current session
      const leaderboardData = await db.getLeaderboardForSession(lapData.sessionId);
      console.log(`Get leaderboardData from DB:`, leaderboardData);
      // Broadcast the updated leaderboard data
      io.emit("updateLeaderboard", leaderboardData);
    } catch (error) {
      console.error(
        `Error recording lap time for car ${lapData.carNumber}`,
        error
      );
    }
  });

  // Handle race end
  socket.on("raceEnd", async (sessionId) => {
    console.log(`Received 'raceEnd' event for race session ${sessionId}`);
    try {
      await db.endRaceSession(sessionId);
      await db.deleteRaceSession(sessionId);
      console.log(`Race session ${sessionId} ended`);
      io.emit("sessionEnded", sessionId);
      isRaceInProgress = false;
      const nextRaceInfo = await db.getNextRaceInfo();
      io.emit("nextRaceSession", nextRaceInfo);
    } catch (err) {
      console.error(`Error ending race session ${sessionId} in DB:`, err);
    }
  });

  //timer update
  socket.on("timerUpdate", (timeFormatted) => {
    io.emit("timerUpdate", timeFormatted);
  });

  // Handle driver list change in existing session
  socket.on("driverListChange", async ({ sessionId, driverList }) => {
    console.log(
      `Received 'driverListChange' event for session ${sessionId} with ${driverList.length} drivers.`
    );
    try {
      await db.updateSessionDrivers(sessionId, driverList);
      console.log(`Updated driver list for session ${sessionId} in DB`);
      io.emit("driverListUpdated", { sessionId, driverList }); // Use the received driverList
      const nextRaceInfo = await db.getNextRaceInfo();
      io.emit("nextRaceSession", nextRaceInfo);
    } catch (error) {
      console.error(
        `Error updating driver list for session ${sessionId}:`,
        error
      );
    }
  });

  // Handle delete race session
  socket.on("deleteRaceSession", async ({ sessionId }) => {
    console.log(`Received 'deleteRaceSession' event for session ${sessionId}`);
    try {
      await db.deleteRaceSession(sessionId);
      console.log(`Deleted race session ${sessionId} from DB`);
      const nextRaceInfo = await db.getNextRaceInfo();
      io.emit("nextRaceSession", nextRaceInfo);
    } catch (error) {
      console.error(`Error deleting race session ${sessionId}:`, error);
    }
  });

  socket.on("getNextSessionId", async (callback) => {
    try {
      const maxId = await db.getMaxSessionId();
      callback(maxId + 1);
    } catch (err) {
      console.error("Error getting next session ID:", err);
      callback(1);
    }
  });

  // This event is handled on the socket level, because each client can disconnect independently.
  //"disconnect" only affects the client that leaves, while "connection" applies to every new client.
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start the server
const PORT = 3000;
db.initializeDatabase()
    .then(async () => {
      const ongoingRace = await db.getOngoingRace();
      if (ongoingRace) {
        isRaceInProgress = true;
      }
      await restoreRaceState(io, isDeveloperMode);
      server.listen(PORT, async () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        // Start tunnel AFTER server is running
        try {
          const url = await tunnelmole({ port: PORT });
          console.log(`🌐 Public URL: ${url}`);
          // Auto-open local homepage in default browser
          const open = (await import("open")).default;
          await open(`http://localhost:${PORT}/`);
        } catch (err) {
          console.error("Failed to start tunnelmole:", err);
        }
      });
    })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

// Graceful shutdown function
async function gracefulShutdown() {
  console.log("Closing server...");

  // First close the server to stop accepting new connections
  // Wrap server.close in a Promise to wait for the server to fully close
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        console.error("Error closing server:", err);
        return reject(err);
      }
      console.log("HTTP server closed.");
      resolve();
    });
  });

  try {
    // Then close the database connection
    await db.closeDatabase();
    console.log("Database closed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error closing the database:", error);
    process.exit(1);
  }
}

// Handle application shutdown signals
// SIGINT is triggered by Ctrl+C in the terminal
process.on("SIGINT", async () => {
  console.log("Application shutting down from SIGINT (Ctrl+C)...");
  await gracefulShutdown();
});

// SIGTERM is typically sent by process managers or via a GUI "stop" command
process.on("SIGTERM", async () => {
  console.log("Application shutting down from SIGTERM...");
  await gracefulShutdown();
});
