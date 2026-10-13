if (typeof window.firebaseInitialized === "undefined") {
  window.firebaseInitialized = false;
}

document.addEventListener("DOMContentLoaded", function () {
  // Initialize Firebase
  if (!window.firebaseInitialized) {
    firebase.initializeApp(firebaseConfig);
    firebase
      .auth()
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch((error) => console.error("Error setting persistence:", error));
    window.firebaseInitialized = true;
  }

  const forgotPasswordForm = document.getElementById("forgot-password-form");
  const showForgotPassword = document.getElementById("show-forgot-password");
  const backToLogin = document.getElementById("back-to-login");

  const loginView = document.getElementById("login-view");
  const signupView = document.getElementById("signup-view");
  const forgotPasswordView = document.getElementById("forgot-password-view");

  const emailLoginForm = document.getElementById("email-login-form");
  const signupForm = document.getElementById("signup-form");
  const googleLoginBtn = document.getElementById("google-login");
  const switchToSignup = document.getElementById("switch-to-signup");
  const switchToLogin = document.getElementById("switch-to-login");

  // Function to hide error message when user starts typing
  function setupInputListeners(formId, errorMessageId) {
    const form = document.getElementById(formId);
    const errorElement = document.getElementById(errorMessageId);

    if (form && errorElement) {
      form.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", function () {
          errorElement.style.display = "none";
          errorElement.classList.remove("success-style");
        });
      });
    }
  }

  setupInputListeners("email-login-form", "login-error-message");
  setupInputListeners("signup-form", "signup-error-message");
  setupInputListeners("forgot-password-form", "forgot-password-error-message");

  function clearErrors() {
    const errorElements = document.querySelectorAll(".error-message");
    const successElements = document.querySelectorAll(".success-message");
    errorElements.forEach((el) => {
      el.style.display = "none";
      el.classList.remove("success-style");
    });
    successElements.forEach((el) => (el.style.display = "none"));
  }

  function showView(viewElement) {
    clearErrors();
    if (loginView) loginView.classList.remove("active");
    if (signupView) signupView.classList.remove("active");
    if (forgotPasswordView) forgotPasswordView.classList.remove("active");
    if (viewElement) viewElement.classList.add("active");
  }

  function showLoginView() {
    showView(loginView);
  }

  function showSignupView() {
    const successMessageElement = document.getElementById(
      "signup-success-message"
    );
    if (signupForm) signupForm.style.display = "block";
    if (successMessageElement) successMessageElement.style.display = "none";
    showView(signupView);
  }

  if (showForgotPassword)
    showForgotPassword.addEventListener("click", function (e) {
      e.preventDefault();
      showView(forgotPasswordView);
    });
  if (backToLogin)
    backToLogin.addEventListener("click", function (e) {
      e.preventDefault();
      showLoginView();
    });

  if (switchToSignup)
    switchToSignup.addEventListener("click", function (e) {
      e.preventDefault();
      showSignupView();
    });
  if (switchToLogin)
    switchToLogin.addEventListener("click", function (e) {
      e.preventDefault();
      showLoginView();
    });

  // Handle email/password login
  if (emailLoginForm) {
    emailLoginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = document.getElementById("email-input").value;
      const password = document.getElementById("password-input").value;
      const errorMessageElement = document.getElementById(
        "login-error-message"
      );
      const submitButton = this.querySelector('button[type="submit"]');

      errorMessageElement.style.display = "none";

      submitButton.disabled = true;
      submitButton.classList.add("loading-btn");
      submitButton.originalText = submitButton.textContent;
      submitButton.textContent = "Logging in...";

      firebase
        .auth()
        .signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          return userCredential.user.getIdToken(true).then((idToken) => {
            return { user: userCredential.user, idToken };
          });
        })
        .then(({ user, idToken }) => {
          sendTokenToBackend(user, "login", idToken);
        })
        .catch((error) => {
          submitButton.disabled = false;
          submitButton.classList.remove("loading-btn");
          submitButton.textContent = submitButton.originalText;

          console.error("Login error:", error);

          let errorMsg = "Login failed. Please try again.";

          if (
            typeof error.message === "string" &&
            error.message.includes("INVALID_LOGIN_CREDENTIALS")
          ) {
            errorMsg = "Invalid email or password. Please try again.";
          } else if (error.code) {
            switch (error.code) {
              case "auth/invalid-credential":
              case "auth/user-not-found":
              case "auth/wrong-password":
              case "auth/invalid-email":
                errorMsg = "Invalid email or password. Please try again.";
                break;
              default:
                errorMsg = error.message;
            }
          }

          errorMessageElement.textContent = errorMsg;
          errorMessageElement.style.display = "block";
        });
    });
  }

  // Handle signup
  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const name = document.getElementById("signup-name").value;
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;
      const errorMessageElement = document.getElementById(
        "signup-error-message"
      );
      const successMessageElement = document.getElementById(
        "signup-success-message"
      );
      const submitButton = this.querySelector('button[type="submit"]');

      errorMessageElement.style.display = "none";
      successMessageElement.style.display = "none";

      submitButton.disabled = true;
      submitButton.classList.add("loading-btn");
      submitButton.originalText = submitButton.textContent;
      submitButton.textContent = "Signing up...";

      firebase
        .auth()
        .createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
          return userCredential.user
            .updateProfile({ displayName: name })
            .then(() => userCredential.user.sendEmailVerification())
            .then(() => {
              // Sign out since email is not verified yet
              return firebase.auth().signOut();
            })
            .then(() => {
              signupForm.style.display = "none";
              successMessageElement.style.display = "block";
            });
        })
        .catch((error) => {
          console.error("Signup error:", error);
          submitButton.disabled = false;
          submitButton.classList.remove("loading-btn");
          submitButton.textContent = submitButton.originalText;

          let errorMsg = "Signup failed. Please try again.";

          if (error.code) {
            switch (error.code) {
              case "auth/email-already-in-use":
                errorMsg =
                  "This email is already registered. Please use a different email or try logging in.";
                break;
              case "auth/weak-password":
                errorMsg =
                  "Password is too weak. Please use a stronger password.";
                break;
              case "auth/invalid-email":
                errorMsg =
                  "Invalid email format. Please check your email address.";
                break;
              default:
                errorMsg = error.message;
            }
          }

          errorMessageElement.textContent = errorMsg;
          errorMessageElement.style.display = "block";
        });
    });
  }

  // Handle Google login
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", function () {
      const provider = new firebase.auth.GoogleAuthProvider();
      const errorMessageElement = document.getElementById(
        "login-error-message"
      );
      const btn = this;

      errorMessageElement.style.display = "none";

      btn.disabled = true;
      btn.classList.add("loading-btn");
      btn.originalText = btn.textContent;
      btn.textContent = "Connecting...";

      firebase
        .auth()
        .signInWithPopup(provider)
        .then((result) => {
          return result.user.getIdToken(true).then((idToken) => {
            sendTokenToBackend(result.user, "login", idToken);
          });
        })
        .catch((error) => {
          console.error("Google login error:", error);
          btn.disabled = false;
          btn.classList.remove("loading-btn");
          btn.textContent = btn.originalText;

          let errorMsg = "Google login failed. Please try again.";

          if (error.code) {
            switch (error.code) {
              case "auth/popup-closed-by-user":
                errorMsg = "Login popup was closed. Please try again.";
                break;
              case "auth/cancelled-popup-request":
                errorMsg = "Too many popup requests. Please try again.";
                break;
              case "auth/popup-blocked":
                errorMsg =
                  "Login popup was blocked by your browser. Please allow popups for this site.";
                break;
              default:
                errorMsg = error.message;
            }
          }

          errorMessageElement.textContent = errorMsg;
          errorMessageElement.style.display = "block";
        });
    });
  }

  // Handle forgot password
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = document.getElementById("forgot-password-email").value;
      const errorMessageElement = document.getElementById(
        "forgot-password-error-message"
      );

      errorMessageElement.style.display = "none";

      firebase
        .auth()
        .sendPasswordResetEmail(email)
        .then(() => {
          showLoginView();

          const loginMsg = document.getElementById("login-error-message");
          loginMsg.textContent =
            "Password reset email sent. Please check your inbox.";
          loginMsg.classList.add("success-style");
          loginMsg.style.display = "block";
        })
        .catch((error) => {
          console.error("Password reset error:", error);

          let errorMsg = "Password reset failed. Please try again.";

          if (error.code) {
            switch (error.code) {
              case "auth/user-not-found":
                errorMsg = "No account found with this email address.";
                break;
              case "auth/invalid-email":
                errorMsg =
                  "Invalid email format. Please check your email address.";
                break;
              default:
                errorMsg = error.message;
            }
          }

          errorMessageElement.textContent = errorMsg;
          errorMessageElement.style.display = "block";
        });
    });
  }

  // Helper to reset all loading buttons
  function resetAllAuthButtons() {
    const buttons = document.querySelectorAll(".loading-btn");
    buttons.forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove("loading-btn");
      if (btn.originalText) btn.textContent = btn.originalText;
    });
  }

  // Send Firebase token to WordPress backend
  function sendTokenToBackend(user, authAction, idToken = null) {
    if (user && !user.emailVerified) {
      resetAllAuthButtons();
      var errorMessageElement = document.getElementById("login-error-message");
      if (errorMessageElement) {
        errorMessageElement.innerHTML =
          'Please verify your email before logging in. ' +
          'Didn\'t receive the email? <a href="#" id="resend-verification">Click here to resend</a>';
        errorMessageElement.style.display = "block";

        document.getElementById("resend-verification").addEventListener("click", function (e) {
          e.preventDefault();
          this.textContent = "Sending...";
          this.style.pointerEvents = "none";
          user
            .sendEmailVerification()
            .then(function () {
              errorMessageElement.innerHTML =
                'Verification email sent to <strong>' +
                user.email +
                '</strong>. Please check your inbox.';
              errorMessageElement.classList.add("success-style");
            })
            .catch(function (error) {
              if (error.code === "auth/too-many-requests") {
                errorMessageElement.textContent =
                  "Too many requests. Please wait a few minutes before trying again.";
              } else {
                errorMessageElement.textContent =
                  "Failed to send verification email. Please try again later.";
              }
            })
            .finally(function () {
              firebase.auth().signOut();
            });
        });
      }
      return;
    }

    const data = {
      action: "firebase_auth",
      auth_action: authAction,
      nonce: authenVariable.nonce,
    };

    if (user) {
      data.id_token = idToken;
      data.user_email = user.email;
      data.user_display_name = user.displayName || user.email;
      data.user_photo_url = user.photoURL || "";
    }

    fetch(authenVariable.ajaxUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          if (authAction === "logout") {
            window.location.href = "/";
          } else {
            window.location.reload();
          }
        } else {
          console.error("Auth action failed:", data.data);
          resetAllAuthButtons();
          const errorMessageElement = document.getElementById("login-error-message");
          if (errorMessageElement) {
            const msg =
              typeof data.data === "string" && data.data.length < 200
                ? data.data
                : "Login failed. Please try again.";
            errorMessageElement.textContent = msg;
            errorMessageElement.style.display = "block";
          }
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        resetAllAuthButtons();
        const errorMessageElement = document.getElementById("login-error-message");
        if (errorMessageElement) {
          errorMessageElement.textContent =
            "A network error occurred. Please try again.";
          errorMessageElement.style.display = "block";
        }
      });
  }

  // Password visibility toggle
  document.querySelectorAll(".password-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = this.parentElement.querySelector("input");
      var eyeIcon = this.querySelector(".eye-icon");
      var eyeOffIcon = this.querySelector(".eye-off-icon");

      if (input.type === "password") {
        input.type = "text";
        eyeIcon.style.display = "none";
        eyeOffIcon.style.display = "block";
      } else {
        input.type = "password";
        eyeIcon.style.display = "block";
        eyeOffIcon.style.display = "none";
      }
    });
  });

  // Handle logout button click (delegated)
  document.body.addEventListener("click", function (e) {
    if (
      e.target &&
      (e.target.id === "logout-btn" || e.target.id === "profile-logout-btn")
    ) {
      e.preventDefault();
      firebase
        .auth()
        .signOut()
        .then(() => {
          sendTokenToBackend(null, "logout");
        })
        .catch((error) => {
          console.error("Logout error:", error);
        });
    }
  });
});
