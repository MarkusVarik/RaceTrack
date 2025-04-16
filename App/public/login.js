document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault(); // Prevent form from submitting normally

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;


  // Send login request to the server
  const response = await fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  const result = await response.json();
  if (result.success) {
    // Redirect to the original page user was trying to access
    window.location.href = result.redirectTo;
  } else {
    // Show error message if login fails
    document.getElementById("error-message").textContent = result.message;
  }
});
