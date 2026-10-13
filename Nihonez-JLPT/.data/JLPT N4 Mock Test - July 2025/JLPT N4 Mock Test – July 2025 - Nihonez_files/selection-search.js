/**
 * NihonEZ Selection Dictionary
 * Global text selection-based dictionary lookup system
 * Allows users to highlight any Japanese text and look it up
 */

/**
 * Simple HTML Renderer for Yomitan Dictionary Content
 * Directly converts structured content to HTML elements
 */
class SimpleYomitanRenderer {
  /**
   * Convert structured content directly to HTML with semantic formatting
   */
  static toHTML(content) {
    if (!content) return "";

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map((item) => this.toHTML(item)).join("");
    }

    if (typeof content === "object") {
      // Check for semantic content types
      if (content.data && content.data.content) {
        return this.renderSemanticContent(content);
      }
      return this.renderElement(content);
    }

    return "";
  }

  /**
   * Render semantic content with proper styling and labels
   */
  static renderSemanticContent(element) {
    const contentType = element.data.content;

    switch (contentType) {
      case "glossary":
        return this.renderGlossary(element);
      case "examples":
        return this.renderExamples(element);
      case "references":
        return this.renderReferences(element);
      case "antonyms":
        return this.renderAntonyms(element);
      case "notes":
        return this.renderNotes(element);
      case "formsTable":
        return this.renderFormsTable(element);
      default:
        return this.renderElement(element);
    }
  }

  /**
   * Render glossary section
   */
  static renderGlossary(element) {
    let html = '<div class="glossary-section">';

    if (element.content && Array.isArray(element.content)) {
      element.content.forEach((item) => {
        if (item.tag === "li") {
          html += `<div class="definition-item">• ${item.content}</div>`;
        }
      });
    } else if (element.content && element.content.tag === "li") {
      html += `<div class="definition-item">• ${element.content.content}</div>`;
    }

    html += "</div>";
    return html;
  }

  /**
   * Render examples section with label
   */
  static renderExamples(element) {
    let html = '<div class="examples-section">';
    html += "<strong>Examples:</strong><br>";

    if (element.content && Array.isArray(element.content)) {
      element.content.forEach((item) => {
        if (item.tag === "li") {
          const lang = item.lang || "ja";
          const langFlag = lang === "en" ? "🇬🇧" : "🇯🇵";
          html += `<div class="example-item">${langFlag} ${item.content}</div>`;
        }
      });
    }

    html += "</div>";
    return html;
  }

  /**
   * Render references section
   */
  static renderReferences(element) {
    let html = '<div class="references-section">';
    html += "<small><em>";
    html += this.toHTML(element.content);
    html += "</em></small>";
    html += "</div>";
    return html;
  }

  /**
   * Render antonyms section
   */
  static renderAntonyms(element) {
    let html = '<div class="antonyms-section">';
    html += "<strong>Antonym:</strong> ";
    html += this.toHTML(element.content);
    html += "</div>";
    return html;
  }

  /**
   * Render notes section
   */
  static renderNotes(element) {
    let html = '<div class="notes-section">';
    html += "<small><em>📝 ";

    if (element.content && element.content.tag === "li") {
      html += element.content.content;
    } else {
      html += this.toHTML(element.content);
    }

    html += "</em></small>";
    html += "</div>";
    return html;
  }

  /**
   * Render forms table
   */
  static renderFormsTable(element) {
    let html = '<div class="forms-section">';
    html += "<strong>Forms:</strong><br>";
    html += '<table class="forms-table">';
    html += this.toHTML(element.content);
    html += "</table>";
    html += "</div>";
    return html;
  }

  /**
   * Render individual HTML element
   */
  static renderElement(element) {
    const tag = element.tag || "span";
    const content = this.toHTML(element.content);

    // Handle special cases
    if (tag === "a" && element.href) {
      const query = this.extractQuery(element.href);
      // Make dictionary links clickable with data attribute
      return `<a href="#" class="dict-link" data-query="${query}" onclick="lookupDictWord('${query.replace(
        /'/g,
        "\\'"
      )}'); return false;">${content}</a>`;
    }

    // Apply styles if present
    let styleAttr = "";
    if (element.style) {
      const styles = Object.entries(element.style)
        .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
        .join("; ");
      styleAttr = ` style="${styles}"`;
    }

    // Apply other attributes
    let attrs = "";
    if (element.lang) attrs += ` lang="${element.lang}"`;
    if (element.class) attrs += ` class="${element.class}"`;

    return `<${tag}${styleAttr}${attrs}>${content}</${tag}>`;
  }

  /**
   * Render complete dictionary entry
   */
  static renderEntry(group, entryIndex = 1) {
    const mainEntry = group.main_entry || group;
    let html = "";

    html += '<div class="jmdict-entry">';

    // Entry header
    html += '<div class="entry-header">';
    html += `<span class="headword">${mainEntry.headword || ""}</span>`;

    if (mainEntry.reading && mainEntry.reading !== mainEntry.headword) {
      html += `<span class="reading">【${mainEntry.reading}】</span>`;
    }

    if (mainEntry.tags) {
      html += `<span class="tags">${this.formatTags(mainEntry.tags)}</span>`;
    }
    html += "</div>";

    // Process all senses
    if (group.senses && group.senses.length > 0) {
      group.senses.forEach((sense, index) => {
        html += this.renderSense(sense, entryIndex + index);
      });
    } else {
      html += this.renderSense(mainEntry, entryIndex);
    }

    html += "</div>";
    return html;
  }

  /**
   * Render individual sense
   */
  static renderSense(sense, index) {
    let html = '<div class="sense-entry">';

    // Sense header
    html += '<div class="sense-header">';
    html += `<span class="sense-number">${index}. </span>`;

    if (sense.pos_tags || sense.pos_info) {
      const posInfo = sense.pos_tags || sense.pos_info;
      html += `<span class="pos-tags">${this.formatPOSTags(posInfo)}</span>`;
    }
    html += "</div>";

    // Render definitions directly as HTML
    html += '<div class="definitions">';
    html += this.renderDefinitions(sense.definitions_json);
    html += "</div>";

    html += "</div>";
    return html;
  }

  /**
   * Render definitions - parse JSON and convert to HTML
   */
  static renderDefinitions(definitionsJson) {
    try {
      const definitions = JSON.parse(definitionsJson);

      if (!Array.isArray(definitions)) {
        return "<em>No definitions available</em>";
      }

      let html = "";
      definitions.forEach((def) => {
        if (def.type === "structured-content" && def.content) {
          html += this.toHTML(def.content);
        } else if (typeof def === "string") {
          html += `<div class="definition-item">${def}</div>`;
        }
      });

      return html || "<em>No definitions available</em>";
    } catch (e) {
      console.error("Definition parsing error:", e);
      return "<em>Definition format error</em>";
    }
  }

  // Utility functions
  static extractQuery(href) {
    const match = href.match(/query=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  static camelToKebab(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  }

  static formatTags(tagsString) {
    if (!tagsString) return "";

    const tags = tagsString.split(" ");
    const formatted = [];

    tags.forEach((tag) => {
      if (tag === "⭐") {
        formatted.push('<span class="tag priority">⭐ Priority</span>');
      } else if (tag === "ichi") {
        formatted.push('<span class="tag common">📌 Common</span>');
      } else if (tag.indexOf("news") !== -1) {
        formatted.push(`<span class="tag freq">📰 ${tag}</span>`);
      }
    });

    return formatted.join(" ");
  }

  static formatPOSTags(posTags) {
    if (!posTags) return "";

    const cleaned = posTags.replace(/^\d+\s*/, "");
    const mapping = {
      n: "noun",
      v5s: "godan verb",
      vi: "intransitive",
      vt: "transitive",
      "aux-v": "auxiliary verb",
      pol: "polite",
      "adj-i": "i-adjective",
      "adj-na": "na-adjective",
    };

    return mapping[cleaned] || cleaned;
  }
}

class NihonEZSelectionDictionary {
  constructor(options = {}) {
    this.options = {
      apiBaseUrl:
        options.apiBaseUrl || window.location.origin + "/wp-json/jmdict/v1",
      position: options.position || "bottom-right", // bottom-right, bottom-left, top-right, top-left
      maxResults: options.maxResults || 10,
      enableOnMobile:
        options.enableOnMobile !== undefined ? options.enableOnMobile : true,
    };

    this.currentPopup = null;
    this.selectionIcon = null;
    this.currentTab = "meaning"; // meaning, sentences, kanji
    this.currentResults = null;
    this.dictionaryCache = {};
    this.showAllResults = false; // Track if showing all results

    this.init();
  }

  /**
   * Initialize the selection dictionary
   */
  init() {
    // Add selection listener
    document.addEventListener("mouseup", (e) => this.handleSelection(e));
    document.addEventListener("touchend", (e) => this.handleSelection(e));

    // Initialize global reference
    if (!window.nihonezSelectionDict) {
      window.nihonezSelectionDict = this;
    }
  }

  /**
   * Handle text selection
   */
  handleSelection(e) {
    if (typeof isSubmit !== "undefined" && isSubmit === false) {
      return;
    }
    setTimeout(() => {
      const selection = window.getSelection();
      let selectedText = selection.toString().trim();

      // NEW: Clean the selected text by getting only visible text from ruby elements
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.cloneContents();

        // Remove rt (furigana) and tooltip elements
        container.querySelectorAll("rt, .tooltip").forEach((el) => el.remove());

        selectedText = container.textContent.trim();
      }

      // Remove selection icon if no text selected
      if (!selectedText) {
        this.hideSelectionIcon();
        return;
      }

      // Check if selected text contains Japanese characters
      if (!this.containsJapanese(selectedText)) {
        this.hideSelectionIcon();
        return;
      }

      // Show selection icon near selected text
      this.showSelectionIcon(selectedText, selection);
    }, 10);
  }

  /**
   * Check if text contains Japanese characters
   */
  // containsJapanese(text) {
  //   // Check for Hiragana, Katakana, or Kanji
  //   return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  // }

  containsJapanese(text) {
    // Allow ONLY Japanese characters (Hiragana, Katakana, Kanji)
    // Plus common whitespace and Japanese punctuation
    const isOnlyJapanese =
      /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\s]+$/.test(
        text.trim()
      );

    // Must contain at least one Japanese character (not just punctuation/spaces)
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);

    return isOnlyJapanese && hasJapanese;
  }
  /**
   * Show selection icon near selected text
   */
  showSelectionIcon(text, selection) {
    // Remove existing icon
    this.hideSelectionIcon();

    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Create icon
    this.selectionIcon = document.createElement("button");
    this.selectionIcon.className = "nihonez-selection-icon";
    this.selectionIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
    `;
    this.selectionIcon.title = "Look up in dictionary";

    // Position icon near selection (above and to the right)
    this.selectionIcon.style.position = "absolute";
    // this.selectionIcon.style.left = `${rect.right + window.scrollX + 5}px`;
    // this.selectionIcon.style.top = `${rect.top + window.scrollY - 5}px`;
    // Position icon slightly above the selection (centered)
    this.selectionIcon.style.left = `${
      rect.left + rect.width / 2 + window.scrollX - 15
    }px`; // Center horizontally, -15px to center the 30px icon
    this.selectionIcon.style.top = `${rect.top + window.scrollY - 35}px`; // 35px above the selection
    this.selectionIcon.style.zIndex = "999998";

    // Add click handler
    this.selectionIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      this.lookupText(text);
      this.hideSelectionIcon();
    });

    document.body.appendChild(this.selectionIcon);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideSelectionIcon();
    }, 5000);
  }

  /**
   * Hide selection icon
   */
  hideSelectionIcon() {
    if (this.selectionIcon) {
      this.selectionIcon.remove();
      this.selectionIcon = null;
    }
  }

  /**
   * Look up selected text in dictionary
   */
  async lookupText(text) {
    // Show loading state - popup appears immediately (reuses existing if available)
    this.showPopup(null, text, true);

    // Check cache first
    if (this.dictionaryCache[text]) {
      this.currentResults = this.dictionaryCache[text];
      this.updatePopupContent();
      return;
    }

    try {
      // Use new search endpoint for fuzzy/contains matching
      const response = await fetch(
        `${this.options.apiBaseUrl}/search?query=${encodeURIComponent(
          text
        )}&format=jitendex`
      );

      const data = await response.json();

      if (
        response.ok &&
        data.success &&
        data.results &&
        data.results.length > 0
      ) {
        // SUCCESS - Results found
        const sortedResults = this.sortResults(data.results, text);

        // Cache results
        this.dictionaryCache[text] = sortedResults;
        this.currentResults = sortedResults;

        this.updatePopupContent();
      } else if (
        response.status === 404 ||
        (data.success === false && data.message)
      ) {
        // NO RESULTS - 404 or empty results
        this.currentResults = [];
        this.updatePopupContent();
      } else {
        // SERVER ERROR - 500 or other error
        this.currentResults = [];
        this.updatePopupContent();
      }
    } catch (error) {
      // NETWORK ERROR - fetch failed
      console.error("Dictionary lookup error:", error);
      this.currentResults = [];
      this.updatePopupContent();
    }
  }
  /**
   * Sort results: exact matches first, then by score
   */
  sortResults(results, searchText) {
    return results.sort((a, b) => {
      const aHeadword = a.main_entry?.headword || "";
      const bHeadword = b.main_entry?.headword || "";

      // Exact match gets highest priority
      const aExact = aHeadword === searchText ? 1 : 0;
      const bExact = bHeadword === searchText ? 1 : 0;

      if (aExact !== bExact) {
        return bExact - aExact;
      }

      // Then sort by score
      const aScore = a.main_entry?.score || 0;
      const bScore = b.main_entry?.score || 0;
      return bScore - aScore;
    });
  }

  /**
   * Show popup with results
   */
  // showPopup(results, searchText, isLoading = false) {
  //   // Remove existing popup
  //   this.hidePopup();

  //   // Create popup
  //   this.currentPopup = document.createElement("div");
  //   this.currentPopup.className = `nihonez-selection-popup nihonez-selection-popup-${this.options.position}`;

  //   const popupContent = `
  //     <div class="nihonez-selection-popup-header">
  //       <div class="nihonez-selection-tabs">
  //         <button class="nihonez-selection-tab active" data-tab="meaning">Meaning</button>
  //         <button class="nihonez-selection-tab" data-tab="sentences">Sentences</button>
  //         <button class="nihonez-selection-tab" data-tab="kanji">Kanji</button>
  //       </div>
  //       <button class="nihonez-selection-close" aria-label="Close">×</button>
  //     </div>
  //     <div class="nihonez-selection-popup-body">
  //       <div class="nihonez-selection-search-term">
  //         Searching for: <strong>${searchText}</strong>
  //       </div>
  //       <div class="nihonez-selection-tab-content" data-tab-content="meaning">
  //         ${isLoading ? this.getLoadingHTML() : this.getMeaningHTML(results)}
  //       </div>
  //       <div class="nihonez-selection-tab-content" data-tab-content="sentences" style="display: none;">
  //         ${this.getSentencesHTML(searchText)}
  //       </div>
  //       <div class="nihonez-selection-tab-content" data-tab-content="kanji" style="display: none;">
  //         ${this.getKanjiHTML(searchText)}
  //       </div>
  //     </div>
  //   `;

  //   this.currentPopup.innerHTML = popupContent;
  //   document.body.appendChild(this.currentPopup);

  //   // Add event listeners
  //   this.attachPopupListeners();

  //   // Show with animation
  //   setTimeout(() => {
  //     this.currentPopup.classList.add("show");
  //   }, 10);
  // }

  /**
   * Show popup with results - REUSE existing popup if available
   */
  showPopup(results, searchText, isLoading = false) {
    // If popup already exists, just update it instead of recreating
    if (this.currentPopup) {
      this.updatePopupForNewSearch(searchText, isLoading);
      return;
    }

    // Create popup only if it doesn't exist
    this.currentPopup = document.createElement("div");
    this.currentPopup.className = `nihonez-selection-popup nihonez-selection-popup-${this.options.position}`;

    const popupContent = `
    <div class="nihonez-selection-popup-header">
      <div class="nihonez-selection-tabs">
        <button class="nihonez-selection-tab active" data-tab="meaning">Meaning</button>
        <button class="nihonez-selection-tab" data-tab="sentences">Sentences</button>
        <button class="nihonez-selection-tab" data-tab="kanji">Kanji</button>
      </div>
      <button class="nihonez-selection-close" aria-label="Close">×</button>
    </div>
    <div class="nihonez-selection-popup-body">
    <div class="nihonez-selection-search-term">
  <span>Search:</span>
  <input 
    type="text" 
    class="nihonez-selection-search-input" 
    value="${searchText}"
    placeholder="Enter Japanese text..."
    id="search-dictionary"
  />
  <button class="nihonez-selection-search-btn" aria-label="Search">🔍</button>
</div>
      <div class="nihonez-selection-tab-content" data-tab-content="meaning">
        ${isLoading ? this.getLoadingHTML() : this.getMeaningHTML(results)}
      </div>
      <div class="nihonez-selection-tab-content" data-tab-content="sentences" style="display: none;">
        ${this.getSentencesHTML(searchText)}
      </div>
      <div class="nihonez-selection-tab-content" data-tab-content="kanji" style="display: none;">
        ${this.getKanjiHTML(searchText)}
      </div>
    </div>
  `;

    this.currentPopup.innerHTML = popupContent;
    document.body.appendChild(this.currentPopup);

    // Add event listeners
    this.attachPopupListeners();

    // Show with animation
    setTimeout(() => {
      this.currentPopup.classList.add("show");
    }, 10);
  }

  /**
   * Update existing popup for a new search (reuse popup)
   */
  updatePopupForNewSearch(searchText, isLoading) {
    if (!this.currentPopup) return;

    // Reset to meaning tab
    this.switchTab("meaning");
    this.showAllResults = false;

    // Update search term
    const searchTermEl = this.currentPopup.querySelector(
      ".nihonez-selection-search-term"
    );
    // if (searchTermEl) {
    //   searchTermEl.innerHTML = `Searching for: <strong>${searchText}</strong>`;
    // }
    if (searchTermEl) {
      const inputEl = searchTermEl.querySelector(
        ".nihonez-selection-search-input"
      );
      if (inputEl) {
        inputEl.value = searchText;
      }
    }

    // Update meaning content
    const meaningContent = this.currentPopup.querySelector(
      '[data-tab-content="meaning"]'
    );
    if (meaningContent) {
      meaningContent.innerHTML = isLoading
        ? this.getLoadingHTML()
        : this.getMeaningHTML(null);
    }

    // Update sentences tab
    const sentencesContent = this.currentPopup.querySelector(
      '[data-tab-content="sentences"]'
    );
    if (sentencesContent) {
      sentencesContent.innerHTML = this.getSentencesHTML(searchText);
    }

    // Update kanji tab
    const kanjiContent = this.currentPopup.querySelector(
      '[data-tab-content="kanji"]'
    );
    if (kanjiContent) {
      kanjiContent.innerHTML = this.getKanjiHTML(searchText);
    }
  }
  /**
   * Update popup content after loading
   */
  updatePopupContent() {
    if (!this.currentPopup) return;

    const meaningContent = this.currentPopup.querySelector(
      '[data-tab-content="meaning"]'
    );
    if (meaningContent) {
      meaningContent.innerHTML = this.getMeaningHTML(this.currentResults);
    }
  }

  /**
   * Get loading HTML
   */
  getLoadingHTML() {
    return `
      <div class="nihonez-selection-loading">
        <div class="nihonez-selection-spinner"></div>
        <p>Looking up word...</p>
      </div>
    `;
  }

  /**
   * Get meaning tab HTML
   */
  getMeaningHTML(results) {
    if (!results || results.length === 0) {
      return `
        <div class="nihonez-selection-no-results">
          <p>No dictionary entries found.</p>
          <p class="hint">Try selecting a shorter word or base form.</p>
        </div>
      `;
    }

    // Check if we should show limited or all results
    const showAll = this.showAllResults || false;
    const displayResults = showAll
      ? results
      : results.slice(0, this.options.maxResults);

    return `
      <div class="nihonez-selection-results">
        ${displayResults
          .map((result, index) => this.renderDictionarySection(result, index))
          .join("")}
        ${
          !showAll && results.length > this.options.maxResults
            ? `<div class="nihonez-selection-more">
                 Showing ${this.options.maxResults} of ${results.length} results
                 <button class="nihonez-show-more-btn" onclick="window.nihonezSelectionDict.showMoreResults()">
                   Show All ${results.length} Results
                 </button>
               </div>`
            : ""
        }
        ${
          showAll && results.length > this.options.maxResults
            ? `<div class="nihonez-selection-more">
                 Showing all ${results.length} results
                 <button class="nihonez-show-more-btn" onclick="window.nihonezSelectionDict.showLessResults()">
                   Show Less
                 </button>
               </div>`
            : ""
        }
      </div>
    `;
  }

  /**
   * Show all results
   */
  showMoreResults() {
    this.showAllResults = true;
    this.updatePopupContent();
  }

  /**
   * Show limited results
   */
  showLessResults() {
    this.showAllResults = false;
    this.updatePopupContent();

    // Scroll to top of results
    const popupBody = this.currentPopup?.querySelector(
      ".nihonez-selection-popup-body"
    );
    // if (popupBody) {
    //   popupBody.scrollTop = 0;
    // }
  }

  /**
   * Render individual dictionary section (like tokenizer popup)
   */
  renderDictionarySection(result, index) {
    console.log("result", result);
    // Use the existing SimpleYomitanRenderer if available
    if (typeof SimpleYomitanRenderer !== "undefined") {
      return `
        <div class="nihonez-selection-section">
          ${SimpleYomitanRenderer.renderEntry(result, index + 1)}
        </div>
      `;
    }

    // Fallback: basic rendering
    const mainEntry = result.main_entry || result;
    return `
      <div class="nihonez-selection-section">
        <div class="jmdict-entry">
          <div class="entry-header">
            <span class="headword">${mainEntry.headword || ""}</span>
            ${
              mainEntry.reading && mainEntry.reading !== mainEntry.headword
                ? `<span class="reading">【${mainEntry.reading}】</span>`
                : ""
            }
          </div>
          <div class="sense-entry">
            <div class="sense-number">${index + 1}.</div>
            <div class="definitions">Basic definition placeholder</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get sentences tab HTML
   */
  getSentencesHTML(searchText) {
    return `
      <div class="nihonez-selection-placeholder">
        <p>📝 Example sentences for "${searchText}"</p>
        <p class="hint">Coming soon! This will show example sentences using this word.</p>
      </div>
    `;
  }

  /**
   * Get kanji tab HTML
   */
  getKanjiHTML(searchText) {
    // Extract kanji from search text
    const kanjiChars = searchText.match(/[\u4E00-\u9FAF]/g);

    if (!kanjiChars || kanjiChars.length === 0) {
      return `
        <div class="nihonez-selection-placeholder">
          <p>No kanji found in "${searchText}"</p>
        </div>
      `;
    }

    return `
      <div class="nihonez-selection-placeholder">
        <p>🈯 Kanji breakdown for: ${kanjiChars.join(", ")}</p>
        <p class="hint">Coming soon! This will show detailed kanji information.</p>
      </div>
    `;
  }

  /**
   * Attach event listeners to popup
   */
  attachPopupListeners() {
    if (!this.currentPopup) return;

    // Close button - ONLY way to close popup
    const closeBtn = this.currentPopup.querySelector(
      ".nihonez-selection-close"
    );
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hidePopup());
    }

    // Tab buttons
    const tabButtons = this.currentPopup.querySelectorAll(
      ".nihonez-selection-tab"
    );
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // NOTE: No escape key handler - popup only closes via X button
    // NOTE: No outside click handler - popup stays open until user closes it
    // NEW: Search input - search on Enter key
    const searchInput = this.currentPopup.querySelector(
      ".nihonez-selection-search-input"
    );
    if (searchInput) {
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const searchText = e.target.value.trim();
          if (searchText) {
            this.lookupText(searchText);
          }
        }
      });
    }
    const searchBtn = this.currentPopup.querySelector(
      ".nihonez-selection-search-btn"
    );
    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        const searchInput = this.currentPopup.querySelector(
          ".nihonez-selection-search-input"
        );
        const searchText = searchInput?.value.trim();
        if (searchText) {
          this.lookupText(searchText);
        }
      });
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    if (!this.currentPopup) return;

    this.currentTab = tabName;

    // Update tab buttons
    const tabButtons = this.currentPopup.querySelectorAll(
      ".nihonez-selection-tab"
    );
    tabButtons.forEach((btn) => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Update tab content
    const tabContents = this.currentPopup.querySelectorAll(
      ".nihonez-selection-tab-content"
    );
    tabContents.forEach((content) => {
      if (content.dataset.tabContent === tabName) {
        content.style.display = "block";
      } else {
        content.style.display = "none";
      }
    });
  }

  /**
   * Hide popup
   */
  hidePopup() {
    if (this.currentPopup) {
      this.currentPopup.classList.remove("show");
      setTimeout(() => {
        if (this.currentPopup) {
          this.currentPopup.remove();
          this.currentPopup = null;
        }
      }, 300);
    }
  }

  /**
   * Destroy the selection dictionary
   */
  destroy() {
    this.hidePopup();
    this.hideSelectionIcon();

    document.removeEventListener("mouseup", this.handleSelection);
    document.removeEventListener("touchend", this.handleSelection);

    const styles = document.getElementById("nihonez-selection-styles");
    if (styles) {
      styles.remove();
    }
  }
}

// Auto-initialize if included in page
if (typeof window !== "undefined") {
  window.NihonEZSelectionDictionary = NihonEZSelectionDictionary;

  // Auto-create instance if not manually initialized
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.nihonezSelectionDict) {
      window.nihonezSelectionDict = new NihonEZSelectionDictionary();
    }
  });
}
