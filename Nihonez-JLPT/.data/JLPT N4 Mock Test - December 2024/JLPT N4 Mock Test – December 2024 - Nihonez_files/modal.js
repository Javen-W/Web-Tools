function logToScreen(message) {
  const logDiv = document.getElementById("debug-log");
  if (logDiv) {
    const timestamp = new Date().toLocaleTimeString();
    logDiv.innerText += `[${timestamp}] ${message}\n`;
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}
