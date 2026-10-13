class JLPTTimerController {
  constructor() {
    this.timer = null;
    this.timeDisplay = document.getElementById("time-display");
    this.mode = null;
    this.onTimeUp = null;
    this.onSectionTimeUp = null;
    this.elapsedTime = 0;
    this.isSubsectionMode = false;
    this.totalTimeCompleted = 0; // Add this to track total time

    // Modal elements
    this.timeupModal = document.getElementById("timeup-modal");
    this.continueBtn = document.getElementById("continue-practice");
    this.submitTimeupBtn = document.getElementById("submit-test-timeup");
  }

  initialize = (mode, onTimeUp, onSectionTimeUp, isSubsectionMode = false) => {
    this.mode = mode;
    this.onTimeUp = onTimeUp;
    this.onSectionTimeUp = onSectionTimeUp;
    this.isSubsectionMode = isSubsectionMode;
    this.clearTimer();
    this.initializeModalListeners();
  };

  initializeModalListeners = () => {
    this.continueBtn?.addEventListener("click", () => {
      this.hideTimeUpModal();
      this.startStopWatch();
    });

    this.submitTimeupBtn?.addEventListener("click", () => {
      this.hideTimeUpModal();
      if (this.onTimeUp) this.onTimeUp();
    });
  };

  clearTimer = () => {
    if (this.timer) clearInterval(this.timer);
  };

  startTotalTimer = (totalTimeInMinutes) => {
    if (this.isSubsectionMode) {
      this.startStopWatch();
      return;
    }
    this.clearTimer();
    let remainingTime = totalTimeInMinutes * 60;

    this.updateTimeDisplay(this.timeDisplay, remainingTime);

    this.timer = setInterval(() => {
      remainingTime--;
      this.totalTimeCompleted++; // Increment total time as well

      this.updateTimeDisplay(this.timeDisplay, remainingTime);
      if (remainingTime <= 0) {
        this.clearTimer();
        if (this.mode === "real") {
          if (this.onTimeUp) this.onTimeUp();
        } else {
          this.showTimeUpModal();
        }
      }
    }, 1000);
  };

  startSectionTimer = (sectionDurationInMinutes) => {
    this.clearTimer();
    let remainingTime = sectionDurationInMinutes * 60;

    this.updateTimeDisplay(this.timeDisplay, remainingTime);

    this.timer = setInterval(() => {
      remainingTime--;
      this.totalTimeCompleted++; // Increment total time as well

      this.updateTimeDisplay(this.timeDisplay, remainingTime);

      if (remainingTime <= 0) {
        this.clearTimer();
        if (this.onSectionTimeUp) this.onSectionTimeUp();
      }
    }, 1000);
  };

  startStopWatch = () => {
    this.clearTimer();
    this.elapsedTime = 0;
    this.updateTimeDisplay(this.timeDisplay, this.elapsedTime);

    this.timer = setInterval(() => {
      this.elapsedTime++;
      this.totalTimeCompleted++; // Increment total time as well
      this.updateTimeDisplay(this.timeDisplay, this.elapsedTime);
    }, 1000);
  };

  updateTimeDisplay = (element, timeInSeconds) => {
    if (!element) return;

    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;

    element.textContent = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  showTimeUpModal = () => {
    const modal = document.getElementById("timeup-modal");
    if (modal) {
      modal.classList.add("primary-modal-active");
    }
  };
  hideTimeUpModal = () => {
    if (this.timeupModal) {
      this.timeupModal.classList.remove("primary-modal-active");
    }
  };
  stop() {
    this.clearTimer();
  }

  getElapsedTime = () => {
    return this.elapsedTime;
  };
  getTotalTimeCompleted = () => {
    return this.totalTimeCompleted;
  };

  getElapsedSeconds() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
