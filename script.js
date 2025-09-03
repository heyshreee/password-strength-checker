const passwordInput = document.getElementById("password");
const strengthDiv = document.getElementById("strength");

const togglePassword = document.getElementById("togglePassword");
if (togglePassword) {
  togglePassword.addEventListener("click", function () {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePassword.textContent = type === "password" ? "🙈" : "👁️";
  });
}


passwordInput.addEventListener("input", function () {
  const password = passwordInput.value;
  let strength = 0;

  // Check criteria
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  // Set strength
  if (strength <= 2) {
    strengthDiv.textContent = "Weak";
    strengthDiv.className = "strength weak";
  } else if (strength === 3 || strength === 4) {
    strengthDiv.textContent = "Medium";
    strengthDiv.className = "strength medium";
  } else if (strength === 5) {
    strengthDiv.textContent = "Strong";
    strengthDiv.className = "strength strong";
  } else {
    strengthDiv.textContent = "Enter a password";
    strengthDiv.className = "strength";
  }
});
