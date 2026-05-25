const urlParams = new URLSearchParams(window.location.search);

const mode = urlParams.get("mode"); // ADD THIS
class JLPTTestSubmission {
  constructor() {
    this.form = document.getElementById("test-form");
    this.timeController = null;
    this.audioController = null;
    this.testData = window.testData;
    this.JLPTTestResult = null;
    this.resultData = null;
    this.submitButton = document.getElementById("submit-test");
  }

  initialize = (timeController, audioController) => {
    this.timeController = timeController;
    this.audioController = audioController;
    this.setupEventListeners();
    this.JLPTTestResult = new JLPTTestResults(timeController);
  };

  setupEventListeners = () => {
    // Set up submit button listener
    this.submitButton?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (this.resultData) {
        this.JLPTTestResult.showResults(this.resultData);
        return;
      }
      await this.handleSubmit();
    });
  };

  handleSubmit = async () => {
    // Check for unanswered questions
    const totalQuestions = document.querySelectorAll(
      ".question-container"
    ).length;
    const answeredQuestions = document.querySelectorAll(
      'input[type="radio"]:checked'
    ).length;

    if (answeredQuestions < totalQuestions) {
      const unanswered = totalQuestions - answeredQuestions;
      if (
        !confirm(
          `You still have ${unanswered} unanswered question(s). Do you want to submit anyway?`
        )
      ) {
        return; // Don't submit if user clicks "No"
      }
    }

    // Show loading state in modal
    this.JLPTTestResult.showLoadingModal();

    // Submit
    isSubmit = true;
    this.timeController.stop();
    const answers = this.collectAnswer();
    await this.submitTest(answers);
    this.audioController.stopAllAudio();

    // translation
    const passageTranslations = document.querySelectorAll(
      ".passage-translation"
    );

    passageTranslations.forEach((element) => {
      element.style.display = "block";
    });
  };

  collectAnswer = () => {
    const answers = {};
    document
      .querySelectorAll('input[type="radio"]:checked')
      .forEach((input) => {
        const questionId = input.name.replace("question-", "");
        answers[questionId] = input.value;
      });
    return answers;
  };

  submitTest = async (answers) => {
    const formData = new FormData();
    formData.append("action", "submit_jlpt_test");
    formData.append("security", jlptTestData.nonce);
    const testIdField = document.getElementById("test_id");
    if (testIdField) {
      formData.append("test_id", testIdField.value);
    } else {
      console.error("Test ID field not found. Form submission may fail.");
    }
    formData.append("answers", JSON.stringify(answers));
    formData.append(
      "test_slug_in_question_post_type",
      testData.test_slug_in_question_post_type
    );
    const urlParams = new URLSearchParams(window.location.search);
    const sectionId = urlParams.get("section_id");
    const subsectionIndex = urlParams.get("subsection");

    const mode = urlParams.get("mode"); // ADD THIS

    formData.append("mode", mode); // ADD THIS
    // Get time spent from timeController
    const timeSpent = this.timeController.getElapsedSeconds(); // ADD THIS
    formData.append("time_spent", timeSpent); // ADD THIS

    // Add mode parameters if they exist
    if (sectionId) formData.append("section_id", sectionId);
    if (subsectionIndex) formData.append("subsection_index", subsectionIndex);

    await this.sendSubmission(formData);
  };

  afterSubmit = () => {
    this.audioController.enableSeekAudio();
    document.querySelectorAll(".seek-audio-button").forEach((button) => {
      button.style.display = "flex";
    });
  };

  sendSubmission = async (formData) => {
    try {
      const response = await fetch(jlptTestData.ajaxurl, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const text = await response.text();

      if (!response.ok) {
        console.error("Submission failed:", response.status, text);
        throw new Error(`HTTP error! status: ${response.status}, body: ${text.substring(0, 200)}`);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Invalid JSON response:", text.substring(0, 500));
        throw new Error(`Server returned invalid response: ${text.substring(0, 100)}`);
      }

      if (data.success) {
        this.resultData = data.data;
        this.JLPTTestResult.showResults(data.data);
        this.submitButton.textContent = "Show Results";
        this.submitButton.classList.add("show-result");

        this.afterSubmit();
      } else {
        alert("Error: " + (data.data ? data.data.message : "Unknown error"));
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("An error occurred while submitting the test. Please try again.\n\nDetails: " + error.message);
    }
  };
}
class JLPTTestResults {
  constructor(timeController) {
    this.resultModal = document.getElementById("result-modal");
    this.timeController = timeController;
  }

  showResults = (data) => {
    // Restore original modal content if it was replaced by loading
    if (this.originalModalContent) {
      const modalContent = this.resultModal.querySelector(".modal-content");
      if (modalContent) {
        modalContent.innerHTML = this.originalModalContent;
      }
    }

    this.storeAnswers(data.question_results);
    const urlParams = new URLSearchParams(window.location.search);
    const isSubsectionTest = urlParams.has("subsection_index");
    const isSectionTest = urlParams.has("section_id");

    this.showResultModal();

    if (isSubsectionTest || isSectionTest) {
      // Section/subsection test - hide tabs, show section results
      document.getElementById("tab-container").style.display = "none";
      document.getElementById("official-tab").style.display = "none";
      document.getElementById("analysis-tab").style.display = "none";
      document.querySelector(".section-results-wrapper").style.display =
        "block";

      this.renderSectionResults(data); // Goes to section-results-wrapper
    } else {
      // Full test - show tabs
      document.getElementById("tab-container").style.display = "block";
      document.querySelector(".section-results-wrapper").style.display = "none";
      this.setupTabs();

      this.showCertificate(data); // Goes to official-tab
      this.renderDetailedResults(data.detailed_results); // Goes to detailed-results-wrapper in analysis-tab
    }
  };
  showLoadingModal = () => {
    if (this.resultModal) {
      this.resultModal.style.display = "block";
      document.body.classList.add("result-modal-active");

      const modalContent = this.resultModal.querySelector(".modal-content");
      if (modalContent) {
        this.originalModalContent = modalContent.innerHTML;

        modalContent.innerHTML = `
        <div class="loading-modal-content">
          <div class="loading-spinner"></div>
          <h3>Processing your results...</h3>
          <p>Please wait while we calculate your score.</p>
        </div>
      `;
      }
    }
  };

  setupTabs = () => {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(
      "#official-tab, #analysis-tab"
    );

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetTab = button.getAttribute("data-tab");

        // Remove active class from all buttons and contents
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));

        // Add active class to clicked button and corresponding content
        button.classList.add("active");
        document.getElementById(targetTab + "-tab").classList.add("active");
      });
    });
  };
  showResultModal = () => {
    if (this.resultModal) {
      this.resultModal.style.display = "block";
      document.body.classList.add("result-modal-active");
    }
  };

  hideResultModal = () => {
    if (this.resultModal) {
      this.resultModal.style.display = "none";
      document.body.classList.remove("result-modal-active");
    }
  };

  storeAnswers = (questionResults) => {
    window.testResults = questionResults;
  };

  calculateGrade = (points_earned, possible_points) => {
    const percentage = (points_earned / possible_points) * 100;
    if (percentage >= 67) return "A";
    if (percentage >= 34) return "B";
    return "C";
  };

  showCertificate = (data) => {
    const scoreRows = document.getElementById("score-rows");
    const passFailResult = document.getElementById("pass-fail-result");

    let rowsHTML = "";
    passFailResult.textContent = data.passed
      ? "合格 / Passed"
      : "不合格 / Failed";
    passFailResult.style.color = data.passed ? "#28a745" : "#dc3545";
    passFailResult.style.fontWeight = "bold";
    passFailResult.style.marginTop = "5px";

    let isFirst = true;
    Object.entries(data.section_results).forEach(([key, section]) => {
      rowsHTML += `
            <tr>
                <td>${section.title}<br>${section.title_en}</td>
                <td><strong>${section.points_earned} / ${
        section.possible_points
      }</strong></td>
                ${
                  isFirst
                    ? `<td rowspan="3" style="vertical-align: middle; font-size: 18px;"><strong>${data.total_points_earned} / ${data.total_possible_points}</strong></td>`
                    : ""
                }
            </tr>
        `;
      isFirst = false;
    });
    scoreRows.innerHTML = rowsHTML;

    // Update reference grades
    const categories = ["vocabulary", "grammar", "reading"];

    categories.forEach((category) => {
      if (data.detailed_results[category]) {
        const result = data.detailed_results[category];

        const grade = this.calculateGrade(
          result.points_earned,
          result.points_possible
        );

        const elementId = `${
          category === "vocabulary" ? "vocab" : category
        }-grade`;

        const gradeElement = document.getElementById(elementId);

        if (gradeElement) {
          gradeElement.textContent = grade;
        } else {
          console.error(`  ERROR: Element ${elementId} not found!`);
        }
      } else {
        console.warn(`  WARNING: No data for ${category}`);
      }
    });
    document.getElementById("show-details").addEventListener("click", () => {
      document.getElementById("result-modal").style.display = "none";
      this.showDetailedResults();
    });
  };

  renderDetailedResults = (detailedResults) => {
    // Create analysis header
    const header = document.createElement("div");
    // header.className = "analysis-header";
    // header.innerHTML = `
    //     <div class="analysis-title">📊 Detailed Performance Analysis</div>
    //     <div class="analysis-subtitle">Deep dive into your JLPT results with actionable insights</div>
    // `;

    // Create container for detailed results
    const container = document.createElement("div");
    container.className = "section-grid";

    // Create sections for each category
    Object.entries(detailedResults).forEach(([category, categoryData]) => {
      const categorySection = document.createElement("div");
      categorySection.className = `section-card ${category}`;

      // Get icon for category
      const icons = {
        vocabulary: "📚",
        grammar: "📝",
        reading: "📖",
        listening: "🎧",
      };

      // Create category header
      const header = document.createElement("div");
      header.className = "section-header";
      header.innerHTML = `
            <div class="section-icon">${icons[category] || "📝"}</div>
            <div class="section-info">
                <h3>${category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                <div class="section-score">${categoryData.correct}/${
        categoryData.total
      } correct • ${categoryData.percentage}% overall</div>
            </div>
        `;

      // Create subsection list
      const subsectionList = document.createElement("div");
      subsectionList.className = "subsection-list";

      Object.entries(categoryData.details).forEach(([type, typeData]) => {
        const subsectionItem = document.createElement("div");
        subsectionItem.className = "subsection-item";

        // Determine score badge class based on percentage
        let badgeClass = "failed";
        if (typeData.percentage >= 85) badgeClass = "excellent";
        else if (typeData.percentage >= 70) badgeClass = "good";
        else if (typeData.percentage >= 50) badgeClass = "fair";
        else if (typeData.percentage >= 30) badgeClass = "poor";

        subsectionItem.innerHTML = `
                <div class="subsection-name">${type}</div>
                <div class="subsection-score">
 <span class="score-text">
    ${typeData.correct}/${typeData.total}
  questions (${typeData.points_earned}/${typeData.points_possible} pts)
  </span>
                    <span class="score-badge ${badgeClass}">${typeData.percentage}%</span>
                </div>
            `;
        subsectionList.appendChild(subsectionItem);
      });

      categorySection.appendChild(header);
      categorySection.appendChild(subsectionList);
      container.appendChild(categorySection);
    });

    // Add to wrapper
    const detailedWrapper = document.querySelector(".detailed-results-wrapper");
    if (detailedWrapper) {
      detailedWrapper.innerHTML = "";
      detailedWrapper.appendChild(header);
      detailedWrapper.appendChild(container);
    }
  };

  showDetailedResults = () => {
    this.hideResultModal();
    const results = window.testResults;

    for (const questionId in results) {
      const result = results[questionId];
      const questionElement = document.getElementById("question-" + questionId);
      const answerDiv = questionElement?.querySelector(".answer");
      if (answerDiv) {
        answerDiv.innerHTML = `
  Points: ${result.points_earned} / ${result.possible_points}
`;
      }

      const answerWraper = questionElement?.querySelector(".answer-wrapper");
      const explanationDiv = questionElement?.querySelector(".explanation");

      const listeningScriptWraper = questionElement?.querySelector(
        ".listening-script-wrapper"
      );

      const listeningScriptDiv =
        questionElement?.querySelector(".listening-script");

      // const collapseButton = questionElement?.querySelector(".collapse-button");
      const collapseButtons =
        questionElement?.querySelectorAll(".collapse-button");

      const processedExplanation = result.explaination.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );
      if (answerWraper) {
        answerWraper.style.display = "block";
      }
      // if (explanationDiv) {
      //   explanationDiv.innerHTML = processedExplanation;
      // }

      if (explanationDiv) {
        let content = "";

        // Add translation first if it exists
        if (
          result.listening_script_translation &&
          result.listening_script_translation !== ""
        ) {
          content += `<div class="translation-section">${result.listening_script_translation}</div>`;
        }

        // Add the explanation
        content += processedExplanation;

        explanationDiv.innerHTML = content;
      }
      if (
        listeningScriptDiv &&
        result.listening_script &&
        result.listening_script !== ""
      ) {
        listeningScriptWraper.style.display = "block";
        listeningScriptDiv.innerHTML = result.listening_script;
      }

      if (result.is_correct) {
        questionElement?.classList.add("answer-right");

        const checkedInput = questionElement?.querySelector(
          'input[type="radio"]:checked'
        );

        if (checkedInput) {
          checkedInput
            .closest(".answer-choice")
            ?.classList.add("checked-answer");
        }
      } else if (result.user_answer) {
        const checkedInput = questionElement?.querySelector(
          'input[type="radio"]:checked'
        );

        if (checkedInput) {
          checkedInput
            .closest(".answer-choice")
            ?.classList.add("checked-answer");
        }

        // Find the label containing the correct answer order number
        const correctLabel =
          questionElement?.querySelectorAll(".answer-choice")[
            result.correct_answer - 1
          ];

        if (correctLabel) {
          correctLabel.classList.add("correct-answer");
        }
        questionElement?.classList.add("answer-wrong");
      } else {
        questionElement?.classList.add("answer-unanswered");

        const correctLabel =
          questionElement?.querySelectorAll(".answer-choice")[
            result.correct_answer - 1
          ];
        if (correctLabel) {
          correctLabel.classList.add("correct-answer");
        }
      }

      // Update sidebar question indicators
      const links = document.querySelectorAll(
        `a[data-question-id="${questionId}"]`
      );
      links.forEach((link) => {
        if (result.is_correct) {
          link.classList.add("answer-right");
        } else if (result.user_answer) {
          link.classList.add("answer-wrong");
        } else {
          link.classList.add("answer-unanswered");
        }
      });

      // Disable radio buttons
      if (questionElement) {
        questionElement
          .querySelectorAll('input[type="radio"]')
          .forEach((input) => {
            input.disabled = true;
          });
      }
    }

    initReviewFilters();
  };

  renderSectionResults = (data) => {
    const currentSection = testData.sections[0];
    const container = document.createElement("div");
    container.className = "jlpt-test-structure";

    const timeTaken = this.timeController?.getTotalTimeCompleted() || 0;
    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;

    // Create overall performance summary
    const summaryDiv = document.createElement("div");
    summaryDiv.className = "result-summary";
    summaryDiv.innerHTML = `
        <h3>Overall Performance</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <h4>Time Taken</h4>
                <p>${minutes}:${seconds.toString().padStart(2, "0")}</p>
            </div>
            <div class="summary-item">
                <h4>Total Score</h4>
                <p>${data.summary.total_points}/${
      data.summary.possible_points
    }</p>
            </div>
            <div class="summary-item">
                <h4>Accuracy</h4>
                <p>${data.summary.accuracy.toFixed(1)}%</p>
            </div>
            <div class="summary-item">
                <h4>Correct Answers</h4>
                <p>${data.summary.correct_answers}/${
      data.summary.total_questions
    }</p>
            </div>
        </div>
    `;
    container.appendChild(summaryDiv);

    // Create results list for each subsection
    const resultList = document.createElement("div");
    resultList.className = "result-list";

    currentSection.subsections.forEach((subsection) => {
      const subsectionDiv = document.createElement("div");
      subsectionDiv.className = "subsection-results";

      // Add subsection title
      const subtitle = document.createElement("h3");
      subtitle.className = "subsection-title";
      subtitle.textContent = subsection.title;
      subsectionDiv.appendChild(subtitle);

      // Get questions for this subsection
      const subsectionQuestions = Object.entries(data.question_results)
        .filter(([_, q]) => {
          const order = parseInt(q.question_order);
          return (
            order >= subsection.question_from &&
            order <= subsection.question_to &&
            q.question_type_slug === subsection.question_type
          );
        })
        .sort(
          (a, b) =>
            parseInt(a[1].question_order) - parseInt(b[1].question_order)
        );
      // Create question results
      subsectionQuestions.forEach(([questionId, result]) => {
        const resultItem = document.createElement("div");
        resultItem.className = `result-item ${
          result.is_correct ? "correct" : "incorrect"
        }`;

        resultItem.innerHTML = `
                <div class="question-number">Q${result.question_order}</div>
                <div class="result-content">
                    <div class="result-status">
                        <span class="status-icon"></span>
                        <span>${
                          result.is_correct
                            ? "正解 (Correct)"
                            : "不正解 (Incorrect)"
                        }</span>
                        <span class="points">${result.points_earned}/${
          result.possible_points
        } points</span>
                    </div>
                    <div class="choice-grid">
                        ${[1, 2, 3, 4]
                          .map(
                            (choice) => `
                            <div class="choice ${
                              choice === parseInt(result.correct_answer)
                                ? "correct-answer"
                                : ""
                            } ${
                              choice === parseInt(result.user_answer)
                                ? result.is_correct
                                  ? "selected-correct"
                                  : "selected-incorrect"
                                : ""
                            }">
                                ${choice}
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                </div>
            `;

        subsectionDiv.appendChild(resultItem);
      });

      resultList.appendChild(subsectionDiv);
    });

    container.appendChild(resultList);

    document.querySelector(".jlpt-result-certificate").style.display = "none";
    // document.getElementById("result-modal").style.display = "block";

    const sectionWrapper = document.querySelector(".section-results-wrapper");
    if (sectionWrapper) {
      sectionWrapper.innerHTML = "";
      sectionWrapper.appendChild(container);
    }

    document.getElementById("show-details").addEventListener("click", () => {
      document.getElementById("result-modal").style.display = "none";
      this.showDetailedResults();
    });
  };
}

let isSubmit = false;

// Review-mode question filter. Toggles `.filter-active` + per-item `.filter-match`
// on .test-page-container based on which chips in .test-filter-toolbar are active.
// Tracks "has notes" by counting .nihonez-note-card inside each question's notes panel,
// and listens for DOM changes so the chip stays in sync as the user adds/removes notes.
function initReviewFilters() {
  const pageContainer = document.querySelector(".test-page-container");
  const toolbars = pageContainer
    ? pageContainer.querySelectorAll(".test-filter-toolbar")
    : [];
  if (!pageContainer || toolbars.length === 0 || pageContainer.dataset.filtersReady === "1") {
    return;
  }
  pageContainer.dataset.filtersReady = "1";
  pageContainer.classList.add("review-mode");

  const questionEls = Array.from(
    pageContainer.querySelectorAll(".question-container[id^='question-']")
  );

  function questionIdOf(el) {
    return el.id.replace(/^question-/, "");
  }

  function sidebarLinksFor(qId) {
    return pageContainer.querySelectorAll(`a[data-question-id="${qId}"]`);
  }

  function setHasNotes(qEl, hasNotes) {
    qEl.classList.toggle("has-notes", hasNotes);
    sidebarLinksFor(questionIdOf(qEl)).forEach((a) =>
      a.classList.toggle("has-notes", hasNotes)
    );
  }

  questionEls.forEach((qEl) => {
    const list = qEl.querySelector(".nihonez-notes-list");
    if (!list) return;

    const recompute = () => {
      setHasNotes(qEl, list.querySelectorAll(".nihonez-note-card").length > 0);
    };
    recompute();

    new MutationObserver(recompute).observe(list, {
      childList: true,
      subtree: false,
    });
  });

  function applyFilters() {
    // Active state lives on chips themselves — both toolbars are kept in sync,
    // so reading from the first toolbar is enough.
    const activeFilters = Array.from(
      toolbars[0].querySelectorAll('.filter-chip[data-active="true"]')
    ).map((b) => b.dataset.filter);

    if (activeFilters.length === 0) {
      pageContainer.classList.remove("filter-active");
      questionEls.forEach((q) => q.classList.remove("filter-match"));
      pageContainer
        .querySelectorAll(".question-list a[data-question-id]")
        .forEach((a) => a.classList.remove("filter-match"));
      return;
    }

    pageContainer.classList.add("filter-active");

    questionEls.forEach((qEl) => {
      const matches = activeFilters.some((f) => {
        if (f === "correct") return qEl.classList.contains("answer-right");
        if (f === "incorrect") return qEl.classList.contains("answer-wrong");
        if (f === "unanswered")
          return qEl.classList.contains("answer-unanswered");
        if (f === "noted") return qEl.classList.contains("has-notes");
        return false;
      });
      qEl.classList.toggle("filter-match", matches);
      sidebarLinksFor(questionIdOf(qEl)).forEach((a) =>
        a.classList.toggle("filter-match", matches)
      );
    });
  }

  toolbars.forEach((toolbar) => {
    toolbar.addEventListener("click", (e) => {
      const chip = e.target.closest(".filter-chip");
      if (!chip) return;
      const next = chip.dataset.active === "true" ? "false" : "true";
      const filterName = chip.dataset.filter;
      // Mirror state across every toolbar so both stay in sync.
      pageContainer
        .querySelectorAll(`.filter-chip[data-filter="${filterName}"]`)
        .forEach((c) => {
          c.dataset.active = next;
        });
      applyFilters();
      chip.blur();
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // CHECK FOR PREVIOUS ATTEMPT - ADD THIS BLOCK HERE (line 662)
  const urlParams = new URLSearchParams(window.location.search);
  const attemptId = urlParams.get("attempt_id");

  if (attemptId) {
    // Load and display previous attempt results
    loadPreviousAttempt(attemptId);
  }

  async function loadPreviousAttempt(attemptId) {
    // SHOW LOADING MODAL
    const loadingModal = document.createElement("div");
    loadingModal.id = "loading-review-modal";
    loadingModal.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;";
    loadingModal.innerHTML = `
    <div style="background:white;padding:40px;border-radius:12px;text-align:center;">
      <div class="loading-spinner"></div>
      <h3 style="margin-top:20px;">Loading your results...</h3>
      <p>Please wait...</p>
    </div>
  `;
    document.body.appendChild(loadingModal);

    try {
      const formData = new FormData();
      formData.append("action", "get_test_attempt");
      formData.append("attempt_id", attemptId);

      const response = await fetch(jlptTestData.ajaxurl, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const data = await response.json();

      // REMOVE LOADING MODAL
      loadingModal.remove();

      if (data.success) {
        // Wait for test to initialize, then auto-submit with stored results
        setTimeout(() => {
          const testSubmission = window.testSubmissionInstance;
          if (testSubmission) {
            testSubmission.resultData = data.data;
            testSubmission.JLPTTestResult.showResults(data.data);
            testSubmission.afterSubmit();

            // ADD: Mark correct answers visually on the page
            markAnswersOnPage(data.data.question_results);
            // Change button
            testSubmission.submitButton.textContent = "Show Results";
            testSubmission.submitButton.classList.add("show-result");
          }
        }, 500);
      } else {
        alert("Error loading test results: " + data.data.message);
      }
    } catch (error) {
      loadingModal.remove();
      console.error("Error loading attempt:", error);
      alert("Failed to load test results.");
    }
  }

  // Function to visually mark correct/incorrect answers on the page
  function markAnswersOnPage(questionResults) {
    Object.keys(questionResults).forEach((questionId) => {
      const result = questionResults[questionId];
      const questionContainer = document.getElementById(
        `question-${questionId}`
      );

      if (!questionContainer) return;

      // Get all answer choices
      const answerChoices =
        questionContainer.querySelectorAll(".answer-choice");

      // Get the correct answer index (convert from 1-based to 0-based)
      const correctAnswerIndex = parseInt(result.correct_answer) - 1;

      // Mark the correct answer
      const correctOption = answerChoices[correctAnswerIndex];
      if (correctOption) {
        correctOption.classList.add("question-correct-answer");
      }

      // If user answered incorrectly, also mark their wrong answer
      if (!result.is_correct && result.user_answer) {
        const userAnswerIndex = parseInt(result.user_answer) - 1;
        const userOption = answerChoices[userAnswerIndex];
        if (userOption) {
          userOption.classList.add("checked-answer");
        }
      }
    });

    // Show translation sections
    document.querySelectorAll(".passage-translation").forEach((element) => {
      element.style.display = "block";
    });
  }

  // END OF NEW CODE

  const form = document.getElementById("test-form");
  const nextButton = document.getElementById("next-section");
  const submitButton = document.getElementById("submit-test");
  const sidebarLinks = document.querySelectorAll(".question-list a");

  let answers = {};

  let currentSectionIndex = 0;

  const questionLinks = document.querySelectorAll(".question-list a");
  const sidebarSections = document.querySelectorAll(".test-sidebar .section");
  const testSections = document.querySelectorAll(".test-section");

  // add to test

  const mode = testData.mode;

  // const urlParams = new URLSearchParams(window.location.search);
  const isSubsectionMode = urlParams.has("subsection_index");

  const audioController = new JLPTAudioController();
  audioController.initialize();

  const timeController = new JLPTTimerController();

  const testSubmission = new JLPTTestSubmission();
  window.testSubmissionInstance = testSubmission;
  timeController.initialize(
    mode,
    () => testSubmission.handleSubmit(),
    goToNextSection,
    isSubsectionMode
  );

  testSubmission.initialize(timeController, audioController);

  function initializeTest() {
    sidebarSections.forEach((section, index) => {
      section.addEventListener("click", function () {
        if (mode === "practice" || isSubmit) {
          showSection(index);
        }
      });
    });

    if (mode === "practice") {
      const totalTime = testData.sections.reduce((total, section) => {
        // return total + section.duration * 60; // Convert minutes to seconds
        return total + section.duration;
      }, 0);

      timeController.startTotalTimer(totalTime);
      // startTotalTimer(totalTime);
    } else if (mode === "real") {
      const currentSection = testData.sections[currentSectionIndex];
      if (currentSection) {
        timeController.startSectionTimer(currentSection.duration);
      }
      document.querySelectorAll(".seek-audio-button").forEach((button) => {
        button.style.display = "none";
      });
    }
    // Show the first section by default
    showSection(0);
  }

  function markQuestionAsAnswered(questionId) {
    const sidebarLink = document.querySelector(
      `.question-list a[data-question-id="${questionId}"]`
    );
    if (sidebarLink) {
      sidebarLink.classList.add("answered");
    }
  }

  form &&
    form.addEventListener("change", function (e) {
      if (e.target.type === "radio") {
        const questionId = e.target.name.split("-")[1];
        markQuestionAsAnswered(questionId);
        answers[questionId] = e.target.value;
      }
    });

  if (nextButton) {
    nextButton.addEventListener("click", goToNextSection);
  }

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      if (mode === "real") return;
      const targetId = this.getAttribute("href");
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
        });
      }
    });
  });

  // if (mode === "real") {
  //   document.querySelectorAll(".test-sidebar a").forEach((link) => {
  //     link.addEventListener("click", (e) => e.preventDefault());
  //   });
  // }

  function goToNextSection() {
    currentSectionIndex++;
    if (currentSectionIndex < testData.sections.length) {
      showSection(currentSectionIndex);
    } else {
      // handleSubmit();
    }
  }

  function showSection(sectionIndex) {
    currentSectionIndex = sectionIndex;

    testSections.forEach((section, index) => {
      if (index === sectionIndex) {
        section.classList.add("current");
      } else {
        section.classList.remove("current");
      }
    });

    // Get current section and check if it's a listening section
    const currentSection = document.querySelector(".test-section.current");
    const isListeningSection = currentSection?.querySelector("audio");

    if (mode === "real") {
      const sectionDuration = testData.sections[sectionIndex].duration;
      timeController.startSectionTimer(sectionDuration);

      // Handle audio for real mode
      audioController.stopAllAudio(); // Stop any playing audio
      if (isListeningSection) {
        audioController.startListeningSection(); // Start audio if it's listening section
      }
    }

    updateSidebar(sectionIndex);
    updateNextSubmitButton(sectionIndex);
  }

  function updateSidebar(currentSectionIndex) {
    sidebarSections.forEach((section, index) => {
      if (index === currentSectionIndex) {
        section.classList.add("current");
      } else {
        section.classList.remove("current");
      }
    });
  }

  function updateNextSubmitButton(sectionIndex) {
    if (mode === "real") {
      if (sectionIndex >= testData.totalSections - 1) {
        nextButton.style.display = "none";
        submitButton.style.display = "block";
      } else {
        nextButton.style.display = "block";
        submitButton.style.display = "none";
      }
    }
  }

  // questionLinks.forEach((link) => {
  //   link.addEventListener("click", function (e) {
  //     e.preventDefault();
  //     const questionId = this.getAttribute("data-question-id");
  //     const questionElement = document.getElementById(`question-${questionId}`);
  //     if (questionElement) {
  //       questionElement.scrollIntoView({ behavior: "smooth" });
  //       questionElement.classList.add("highlight");
  //       setTimeout(() => {
  //         questionElement.classList.remove("highlight");
  //       }, 1000);
  //     }
  //   });
  // });

  closeSidebar = () => {
    const sidebar = document.querySelector(".test-sidebar");
    const testPageContainer = document.querySelector(".test-page-container");
    const testContainer = document.querySelector(".test-container");
    sidebar.classList.remove("open");
    testContainer.classList.remove("sidebar-open");
    testPageContainer.classList.remove("sidebar-open");
  };

  questionLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      // Close sidebar first on mobile
      if (window.innerWidth <= 768) {
        setTimeout(() => {
          closeSidebar();
        }, 0); // Match the CSS transition time (0.3s)

        setTimeout(() => {
          const questionId = this.getAttribute("data-question-id");
          const questionElement = document.getElementById(
            `question-${questionId}`
          );
          if (questionElement) {
            questionElement.scrollIntoView({ behavior: "smooth" });
            questionElement.classList.add("highlight");
            setTimeout(() => {
              questionElement.classList.remove("highlight");
            }, 1000);
          }
        }, 500); // Match the CSS transition time (0.3s)
      } else {
        // Desktop - scroll immediately
        const questionId = this.getAttribute("data-question-id");
        const questionElement = document.getElementById(
          `question-${questionId}`
        );
        if (questionElement) {
          questionElement.scrollIntoView({ behavior: "smooth" });
          questionElement.classList.add("highlight");
          setTimeout(() => {
            questionElement.classList.remove("highlight");
          }, 1000);
        }
      }
    });
  });

  if (mode === "practice") {
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault(); // Add this to prevent form submission

        const sectionIndex = parseInt(button.dataset.section);
        showSection(sectionIndex);

        // Scroll to top of new section
        const newSection = document.querySelector(`#section-${sectionIndex}`); // Updated selector
        if (newSection) {
          newSection.scrollIntoView({ behavior: "smooth" });
        }
      });
    });
  }
  // Initialize the test
  // Check if this is a view-result page (has attempt_id parameter)
  // If the welcome modal is up, defer initialization (and timer start)
  // until the user dismisses it.
  if (window.JLPT_WELCOME_PENDING) {
    window.JLPT_START_TEST = initializeTest;
  } else {
    initializeTest();
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest(".collapse-button")) {
      const button = e.target.closest(".collapse-button");
      const contentDiv = button.nextElementSibling;
      contentDiv?.classList.toggle("expanded");
      contentDiv?.classList.toggle("collapsed");
      button.classList.toggle("active");
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  // Exit button functionality
  const exitBtn = document.getElementById("exit-test-btn");

  const cancelExitBtn = document.getElementById("cancel-modal");

  const exitModal = document.getElementById("exit-modal");
  // const confirmExitBtn = document.getElementById("confirm-exit");
  const confirmExitBtn = document.getElementById("confirm-modal");

  const cancelModal = document.getElementById("cancel-modal");

  exitBtn.addEventListener("click", () => {
    document.body.classList.add("exit-modal-active");
  });

  cancelModal.addEventListener("click", () => {
    document.body.classList.remove("exit-modal-active");
  });

  confirmExitBtn.addEventListener("click", () => {
    // Return to the test info page (where the user started).
    window.location.href = testData.testInfoUrl || "/jlpt-test/";
  });

  if (window.innerWidth <= 768) {
    document.querySelectorAll(".subsection-close").forEach((closeBtn) => {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const container = e.target.closest(".subsection-sidebar-container");
        container.classList.add("closing");
      });
    });

    // const hamburgerBtn = document.getElementById("hamburger-toggle");
    // const sidebar = document.querySelector(".test-sidebar");

    // hamburgerBtn?.addEventListener("click", () => {
    //   sidebar.classList.toggle("open");
    // });

    // // Close sidebar when clicking outside on mobile
    // document.addEventListener("click", (e) => {
    //   if (window.innerWidth <= 768) {
    //     if (
    //       !sidebar.contains(e.target) &&
    //       !hamburgerBtn.contains(e.target) &&
    //       sidebar.classList.contains("open")
    //     ) {
    //       sidebar.classList.remove("open");
    //     }
    //   }
    // });

    // // Close sidebar when clicking on a question link on mobile
    // document.querySelectorAll(".question-list a").forEach((link) => {
    //   link.addEventListener("click", () => {
    //     if (window.innerWidth <= 768) {
    //       sidebar.classList.remove("open");
    //     }
    //   });
    // });
    const hamburgerBtn = document.getElementById("hamburger-toggle");
    const sidebar = document.querySelector(".test-sidebar");
    const testPageContainer = document.querySelector(".test-page-container");
    const testContainer = document.querySelector(".test-container");

    function closeSidebar() {
      sidebar.classList.remove("open");
      testContainer.classList.remove("sidebar-open");
    }

    hamburgerBtn?.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      testContainer.classList.toggle("sidebar-open");
      testPageContainer.classList.toggle("sidebar-open");
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 768) {
        if (
          !sidebar.contains(e.target) &&
          !hamburgerBtn.contains(e.target) &&
          sidebar.classList.contains("open")
        ) {
          sidebar.classList.remove("open");
          testContainer.classList.remove("sidebar-open");
          testPageContainer.classList.remove("sidebar-open");
        }
      }
    });

    // Close sidebar when clicking on a question link on mobile
    document.querySelectorAll(".question-list a").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove("open");
          testContainer.classList.remove("sidebar-open");
          testPageContainer.classList.add("sidebar-open");
        }
      });
    });
  }
  // Handle submit button position for mobile/desktop
  function handleSubmitButtonPosition() {
    const submitButton = document.getElementById("submit-test");
    const nextButton = document.getElementById("next-section");
    const sidebar = document.querySelector(".test-sidebar");
    const bottomNav = document.querySelector(".bottom-nav");

    if (window.innerWidth <= 768) {
      // Mobile: move buttons to bottom nav
      if (bottomNav) {
        if (submitButton && !bottomNav.contains(submitButton)) {
          bottomNav.appendChild(submitButton);
        }
        if (nextButton && !bottomNav.contains(nextButton)) {
          bottomNav.appendChild(nextButton);
        }
      }
    } else {
      // Desktop: move buttons back to sidebar
      if (sidebar) {
        if (submitButton && !sidebar.contains(submitButton)) {
          sidebar.appendChild(submitButton);
        }
        if (nextButton && !sidebar.contains(nextButton)) {
          sidebar.appendChild(nextButton);
        }
      }
    }
  }

  // Call on load and resize
  handleSubmitButtonPosition();
  window.addEventListener("resize", handleSubmitButtonPosition);

  // Passage controls - Sticky toggle and Split view
  function setupPassageControls() {
    const stickyToggleBtns = document.querySelectorAll(".sticky-toggle-btn");
    const splitViewBtns = document.querySelectorAll(".split-view-btn");

    // Sticky toggle functionality - toggle all passages
    stickyToggleBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        const passageWrapper = this.closest(".jlpt-passages-wrapper");
        if (passageWrapper) {
          // Check current state
          const isCurrentlySticky =
            !passageWrapper.classList.contains("sticky");

          // Toggle all passage wrappers
          document
            .querySelectorAll(".jlpt-passages-wrapper")
            .forEach((wrapper) => {
              if (isCurrentlySticky) {
                wrapper.classList.add("sticky");
              } else {
                wrapper.classList.remove("sticky");
              }
            });

          // Toggle all sticky buttons
          stickyToggleBtns.forEach((b) => {
            if (isCurrentlySticky) {
              b.classList.add("active");
            } else {
              b.classList.remove("active");
            }
          });
        }
      });
    });

    // Split view functionality (desktop only)
    splitViewBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        // Only allow on desktop (1028px and above)
        if (window.innerWidth < 1028) {
          return;
        }

        // Find the specific passage-question-group for this button
        const passageGroup = this.closest(".passage-question-group");
        if (passageGroup) {
          const wasSplitViewActive = passageGroup.classList.contains("split-view-active");
          passageGroup.classList.toggle("split-view-active");
          this.classList.toggle("active");

          // Initialize resize functionality after split view is activated
          setTimeout(setupResizeDividers, 100);

          // Adjust passage height to match questions container or reset to default
          if (passageGroup.classList.contains("split-view-active")) {
            setTimeout(() => adjustPassageHeight(passageGroup), 150);
          } else {
            // Reset height back to default 250px when exiting split view
            const passageElement = passageGroup.querySelector(".jlpt-passages");
            if (passageElement) {
              passageElement.style.height = "250px";
            }
          }
        }
      });
    });

    // Function to adjust passage height to match questions container
    function adjustPassageHeight(passageGroup) {
      const questionsContainer = passageGroup.querySelector(".questions-under-passage");
      const passageElement = passageGroup.querySelector(".jlpt-passages");

      if (questionsContainer && passageElement) {
        // Get all .question-container elements
        const questionContainers = questionsContainer.querySelectorAll(".question-container");
        let totalHeight = 0;

        // Sum up height of each question-container (including padding but not margin)
        questionContainers.forEach(container => {
          // offsetHeight includes padding and border, but not margin
          totalHeight += container.offsetHeight;
        });

        // Add 2px as requested
        totalHeight += 2;

        // Set the passage height, respecting max-height of 90vh
        const maxHeight = window.innerHeight * 0.9;
        const finalHeight = Math.min(totalHeight, maxHeight);

        passageElement.style.height = `${finalHeight}px`;
      }
    }

    // Disable split view on mobile/tablet resize
    window.addEventListener("resize", function () {
      if (window.innerWidth < 1028) {
        document
          .querySelectorAll(".passage-question-group")
          .forEach((group) => {
            group.classList.remove("split-view-active");
          });
        splitViewBtns.forEach((btn) => {
          btn.classList.remove("active");
        });
      } else {
        // Re-adjust heights on resize for active split views
        document
          .querySelectorAll(".passage-question-group.split-view-active")
          .forEach((group) => {
            adjustPassageHeight(group);
          });
      }
    });

    // Resize divider functionality
    function setupResizeDividers() {
      const dividers = document.querySelectorAll(".resize-divider");

      dividers.forEach((divider) => {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        let passageWrapper = null;
        let passageGroup = null;

        divider.addEventListener("mousedown", function (e) {
          if (window.innerWidth < 1028) return;

          passageGroup = this.closest(".passage-question-group");
          if (
            !passageGroup ||
            !passageGroup.classList.contains("split-view-active")
          ) {
            return;
          }

          passageWrapper = passageGroup.querySelector(".jlpt-passages-wrapper");
          if (!passageWrapper) return;

          isResizing = true;
          startX = e.clientX;
          startWidth = passageWrapper.offsetWidth;

          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";

          e.preventDefault();
        });

        document.addEventListener("mousemove", function (e) {
          if (!isResizing || !passageWrapper || !passageGroup) return;

          const delta = e.clientX - startX;
          const groupWidth = passageGroup.offsetWidth;
          const newWidth = startWidth + delta;
          const newPercentage = (newWidth / groupWidth) * 100;

          // Limit between 20% and 80%
          if (newPercentage >= 20 && newPercentage <= 80) {
            passageWrapper.style.flexBasis = newPercentage + "%";

            // Adjust passage height during resize
            requestAnimationFrame(() => {
              adjustPassageHeight(passageGroup);
            });
          }
        });

        document.addEventListener("mouseup", function () {
          if (isResizing) {
            isResizing = false;
            // Re-adjust passage height after resize
            if (passageGroup) {
              adjustPassageHeight(passageGroup);
            }
            passageWrapper = null;
            passageGroup = null;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
          }
        });
      });
    }

    // Initialize resize dividers on page load
    setupResizeDividers();

    // Setup observer for dynamic content changes
    function setupHeightObserver() {
      const observer = new MutationObserver(() => {
        document
          .querySelectorAll(".passage-question-group.split-view-active")
          .forEach((group) => {
            adjustPassageHeight(group);
          });
      });

      // Observe changes in question containers
      document.querySelectorAll(".questions-under-passage").forEach((container) => {
        observer.observe(container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style"],
        });
      });
    }

    setupHeightObserver();
  }

  // Initialize passage controls
  setupPassageControls();
});

// Question image load-failure handler: replace broken image with alt text + retry button.
function replaceQuestionImageWithError(img) {
  if (!img.isConnected) return;
  const wrapper = document.createElement("div");
  wrapper.className = "question-image-error";
  wrapper.dataset.src = img.src;

  const altText = document.createElement("span");
  altText.className = "question-image-error-alt";
  altText.textContent = img.alt || "Image";

  const statusText = document.createElement("span");
  statusText.className = "question-image-error-status";
  statusText.textContent = "⚠️ Image failed to load";

  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "question-image-retry";
  retryBtn.textContent = "🔄 Reload image";

  wrapper.append(altText, statusText, retryBtn);
  img.replaceWith(wrapper);
}

// The `error` event does not bubble, so we listen in the capture phase on document.
// Catches images that error AFTER this script runs.
document.addEventListener(
  "error",
  function (e) {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (!img.closest(".question-images")) return;
    if (!img.src) return;
    replaceQuestionImageWithError(img);
  },
  true
);

// This script loads in the footer, so some images may have already errored
// before our listener was attached. `complete && naturalWidth === 0` means
// the browser finished its load attempt but produced no pixel data (i.e. error).
function scanForAlreadyBrokenQuestionImages() {
  document
    .querySelectorAll(".question-images img")
    .forEach(function (img) {
      if (img.complete && img.naturalWidth === 0 && img.src) {
        replaceQuestionImageWithError(img);
      }
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scanForAlreadyBrokenQuestionImages);
} else {
  scanForAlreadyBrokenQuestionImages();
}

document.addEventListener("click", function (e) {
  const btn = e.target.closest(".question-image-retry");
  if (!btn) return;
  const wrapper = btn.closest(".question-image-error");
  if (!wrapper) return;

  const originalSrc = wrapper.dataset.src;
  const altText =
    wrapper.querySelector(".question-image-error-alt")?.textContent || "";

  const newImg = document.createElement("img");
  newImg.alt = altText;
  newImg.loading = "eager";
  newImg.decoding = "async";
  // Cache-buster so the browser re-fetches instead of replaying a cached failure.
  const separator = originalSrc.includes("?") ? "&" : "?";
  newImg.src = originalSrc + separator + "_retry=" + Date.now();

  wrapper.replaceWith(newImg);
});
