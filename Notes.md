# Notes

1. Express
2. Static Files
3. Middleware
4. setInterval

### Express (Web Framework)
Express refers to a popular web framework for Node.js that is used to simplify building server-side applications, particularly those that handle HTTP requests and static files.

> *Express and Socket.IO are often used together to create a real-time web application. Express handles HTTP requests, while Socket.IO manages WebSocket-based communication.*

### Static Files
Static files are files that the server does not process dynamically; instead, they are served directly to the client as-is. These include:

- HTML files
- CSS stylesheets
- JavaScript files (client-side)
- Images (PNG, JPG, SVG, etc.)
- Fonts

### Middleware
Middleware functions in Express are functions that process requests before they reach the final route handler or response. Middleware can:

- Modify the request object (req)
- Modify the response object (res)
- Execute additional code
- End the request-response cycle
- Call the next middleware function
> Example: express.static() used in the server.js (racetrack)

### Set Interval  
`setInterval` is a built-in JavaScript function that executes a specified block of code repeatedly at fixed time intervals (in milliseconds). The function runs the code inside it at the specified time gap, and it continues to run until it's stopped using `clearInterval`.