class JLPTAudioController {
  constructor() {
    this.audioElements = [];
    this.currentAudioIndex = 0;
    this.isListeningSection = false;
    this.initialized = false;
    this.setupSeekButtons();
  }

  initialize() {
    if (this.initialized) return;

    try {
      // Use a more compatible way to find audio sections
      const allSections = document.querySelectorAll(".test-section");
      const listeningSection = Array.from(allSections).find((section) =>
        section.querySelector("audio")
      );

      if (listeningSection) {
        // Store all audio elements
        this.audioElements = Array.from(
          listeningSection.querySelectorAll("audio")
        );

        // Disable controls in real mode
        if (testData.mode === "real") {
          const isTouchDevice = navigator.maxTouchPoints > 0;

          this.audioElements.forEach((audio) => {
            if (isTouchDevice) {
              // Touch devices: allow play/pause but prevent seeking
              let lastAllowedTime = 0;

              audio.addEventListener("timeupdate", () => {
                lastAllowedTime = audio.currentTime;
              });

              audio.addEventListener("seeking", () => {
                const diff = Math.abs(audio.currentTime - lastAllowedTime);
                if (diff > 1) {
                  audio.currentTime = lastAllowedTime;
                }
              });
            } else {
              // Desktop: fully disable audio controls
              audio.setAttribute("controls", "");
              audio.style.pointerEvents = "none";
              audio.parentNode.style.cursor = "not-allowed";
            }
          });
        }

        // Add ended event listener to each audio
        this.audioElements.forEach((audio, index) => {
          audio.addEventListener("ended", () => {
            this.playNextAudio(index);
          });
        });
      }
    } catch (error) {
      console.error("Audio initialization error:", error);
    }

    this.initialized = true;
  }

  enableSeekAudio = () => {
    this.audioElements.forEach((audio) => {
      audio.style.pointerEvents = "auto";
      audio.parentNode.style.cursor = "pointer";
    });
  };

  setupSeekButtons() {
    document.addEventListener("click", (e) => {
      if (e.target.closest(".seek-audio-button")) {
        const button = e.target.closest(".seek-audio-button");
        const startTime = parseFloat(button.dataset.startTime);

        // Find the question container
        const questionContainer = button.closest(".question-container");
        if (!questionContainer) return;

        // Find the parent subsection
        const subsection = questionContainer.closest(".test-subsection");
        if (!subsection) return;

        // Find the audio element within this subsection
        const audio = subsection.querySelector("audio");
        if (!audio) return;

        this.seekToTime(audio, startTime);
      }
    });
  }

  seekToTime(audio, seconds) {
    if (audio) {
      audio.currentTime = seconds;
      audio
        .play()
        .catch((error) => console.error("Error playing audio:", error));

      // Scroll the audio player into view
      // const audioContainer = audio.closest(".audio-player-container");
      // if (audioContainer) {
      //   audioContainer.scrollIntoView({ behavior: "smooth", block: "center" });
      // }
    }
  }

  startListeningSection() {
    this.isListeningSection = true;
    this.currentAudioIndex = 0;

    // Play immediately — no setTimeout so it works on mobile (requires user gesture)
    if (this.audioElements.length > 0) {
      this.audioElements[0]
        .play()
        .catch((error) => console.error("Error playing audio:", error));
    }
  }

  playNextAudio(currentIndex) {
    if (!this.isListeningSection) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < this.audioElements.length) {
      // Small delay between audios — works because audio was unlocked in startListeningSection
      setTimeout(() => {
        this.audioElements[nextIndex]
          .play()
          .catch((error) => console.error("Error playing audio:", error));
      }, 2000);
    }
  }

  stopAllAudio() {
    this.isListeningSection = false;
    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }
}
