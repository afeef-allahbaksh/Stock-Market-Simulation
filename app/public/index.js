
let statusElement = document.getElementById('api-status');
async function checkApiStatus() {
    try {
        let response = await fetch('/api/status');
        let data = await response.json();


        if (data.status === 'connected') {
            statusElement.textContent = 'API is connected';
            statusElement.style.color = 'green';
        } else {
            statusElement.textContent = 'API is not connected';
            statusElement.style.color = 'red';
        }
    } catch (error) {
        console.error('Error checking API status:', error);
    }
}

document.getElementById("signupButton").addEventListener("click", function () {
    window.location.href = 'signup.html';
});

document.getElementById("loginButton").addEventListener("click", function () {
    window.location.href = 'login.html';
});

document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
      const response = await fetch("/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      if (response.ok) {
        alert("Logout successful!");
        window.location.href = "/"; // Redirect to the homepage or login page
      } else {
        const error = await response.json();
        alert(`Logout failed: ${error.message}`);
      }
    } catch (err) {
      console.error("Error during logout:", err);
      alert("An error occurred while trying to log out.");
    }
  });
  


checkApiStatus();
