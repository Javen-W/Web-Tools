class ReportModal {
  constructor() {
    this.modal = null;
    this.currentQuestionId = null;
    this.currentQuestionTitle = null;
    this.testId = window.testData?.testId || null; // Optional - null if not on test page
    this.testTitle = this.getTestTitle();

    this.createModal();
    this.setupEventListeners();
  }

  getTestTitle() {
    // Try multiple selectors for different page types
    // const selectors = [
    //   ".test-title h1", // Test page
    //   ".entry-title", // Post/Page
    //   "h1.page-title", // Archive
    //   "article h1", // Generic
    // ];
    const selectors = [
      "h1", // Test page
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }

    return document.title || "";
  }

  detectReportType() {
    const path = window.location.pathname;

    // Check URL patterns
    if (path.includes("/reading/")) return "reading";
    if (path.includes("/dictation/")) return "dictation";
    if (path.includes("/jlpt-test/")) return "question";

    // Check page elements
    if (document.querySelector(".reading-content")) return "reading";
    if (document.querySelector(".dictation-exercise")) return "dictation";
    if (document.querySelector(".question-container")) return "question";

    return "general"; // Fallback
  }

  createModal() {
    const modalHTML = `
      <div id="report-modal" class="report-modal" style="display: none;">
        <div class="report-modal-overlay"></div>
        <div class="report-modal-content">
          <button class="report-modal-close">&times;</button>
          <h3>🚩 Report an Error</h3>
          <p>Please describe the error you found in this question:</p>
          <textarea id="report-message" placeholder="Example: The correct answer should be option 2, not option 3..." rows="5"></textarea>
          <div class="report-email-section" style="margin-top: 8px;">
            ${jlptTestData.isLoggedIn
              ? `<p style="font-size: 13px; color: #666; margin: 0 0 6px;">If we need more details, we'll reach out to your account email. To use a different email, enter it below:</p>
                 <input type="email" id="report-email" placeholder="Alternative email (optional)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" />`
              : `<p style="font-size: 13px; color: #666; margin: 0 0 6px;">If we need more details, we may reach out via email:</p>
                 <input type="email" id="report-email" placeholder="Your email (optional)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" />`
            }
          </div>
          <div class="report-modal-buttons">
            <button type="button" class="report-cancel-btn">Cancel</button>
            <button type="button" class="report-submit-btn">Submit Report</button>
          </div>
          <div class="report-result" style="display: none;"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
    this.modal = document.getElementById("report-modal");
  }

  setupEventListeners() {
    // Report button clicks
    document.addEventListener("click", (e) => {
      if (e.target.closest(".report-question-btn")) {
        const btn = e.target.closest(".report-question-btn");
        this.currentQuestionId = btn.dataset.questionId;
        this.currentQuestionTitle = btn.dataset.questionTitle;
        this.openModal();
      }
    });

    // Close modal
    this.modal
      .querySelector(".report-modal-close")
      .addEventListener("click", () => this.closeModal());
    this.modal
      .querySelector(".report-cancel-btn")
      .addEventListener("click", () => this.closeModal());
    this.modal
      .querySelector(".report-modal-overlay")
      .addEventListener("click", () => this.closeModal());

    // Submit report
    this.modal
      .querySelector(".report-submit-btn")
      .addEventListener("click", () => this.submitReport());

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.modal.style.display === "block") {
        this.closeModal();
      }
    });
  }

  openModal() {
    this.modal.style.display = "block";
    document.body.classList.add("report-modal-open");
    document.getElementById("report-message").value = "";
    this.modal.querySelector(".report-result").style.display = "none";
  }

  closeModal() {
    this.modal.style.display = "none";
    document.body.classList.remove("report-modal-open");
  }

  // async submitReport() {
  //   const message = document.getElementById("report-message").value.trim();
  //   const submitBtn = this.modal.querySelector(".report-submit-btn");
  //   const resultDiv = this.modal.querySelector(".report-result");

  //   if (!message) {
  //     this.showResult("Please describe the error.", "error");
  //     return;
  //   }

  //   // Disable button and show loading
  //   submitBtn.disabled = true;
  //   submitBtn.textContent = "Submitting...";

  //   try {
  //     const formData = new FormData();
  //     formData.append("action", "submit_report");
  //     formData.append("security", jlptTestData.reportNonce);
  //     formData.append("report_type", "question");
  //     formData.append("reported_item_id", this.currentQuestionId);
  //     formData.append("reported_item_title", this.currentQuestionTitle);
  //     formData.append("report_message", message);
  //     formData.append("test_id", this.testId);
  //     formData.append("test_title", this.testTitle);

  //     const response = await fetch(jlptTestData.ajaxurl, {
  //       method: "POST",
  //       body: formData,
  //     });

  //     const data = await response.json();

  //     if (data.success) {
  //       this.showResult(data.data.message, "success");
  //       setTimeout(() => this.closeModal(), 2000);
  //     } else {
  //       this.showResult(data.data.message, "error");
  //     }
  //   } catch (error) {
  //     this.showResult("An error occurred. Please try again.", "error");
  //   } finally {
  //     submitBtn.disabled = false;
  //     submitBtn.textContent = "Submit Report";
  //   }
  // }

  async submitReport() {
    const message = document.getElementById("report-message").value.trim();
    const submitBtn = this.modal.querySelector(".report-submit-btn");

    if (!message) {
      this.showResult("Please describe the error.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      const formData = new FormData();
      formData.append("action", "submit_report");
      formData.append("security", jlptTestData.reportNonce);
      formData.append("report_type", this.detectReportType()); // ✅ Auto-detect type
      formData.append("reported_item_id", this.currentQuestionId);
      formData.append("reported_item_title", this.currentQuestionTitle);
      formData.append("report_message", message);
      formData.append("test_id", this.testId || ""); // ✅ Optional
      formData.append("test_title", this.testTitle || ""); // ✅ Optional
      formData.append("reporter_email", document.getElementById("report-email").value.trim());
      formData.append("user_agent", navigator.userAgent);
      formData.append("platform", navigator.platform || "");
      formData.append("screen_size", `${window.screen.width}x${window.screen.height}`);
      formData.append("page_url", window.location.href);

      const response = await fetch(jlptTestData.ajaxurl, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        this.showResult(data.data.message, "success");
        setTimeout(() => this.closeModal(), 2000);
      } else {
        this.showResult(data.data.message, "error");
      }
    } catch (error) {
      this.showResult("An error occurred. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Report";
    }
  }

  showResult(message, type) {
    const resultDiv = this.modal.querySelector(".report-result");
    resultDiv.textContent = message;
    resultDiv.className = "report-result " + type;
    resultDiv.style.display = "block";
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new ReportModal();
});
