class AiSurfReport extends HTMLElement {
  connectedCallback() {
    this.renderLoading();
    this.load();
  }

  escape(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  inline(value) {
    return this.escape(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  markdown(value) {
    const lines = String(value).split("\n");
    const output = [];
    let listOpen = false;
    const closeList = () => {
      if (listOpen) output.push("</ul>");
      listOpen = false;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { closeList(); continue; }
      if (/^#{1,3}\s/.test(line)) {
        closeList();
        output.push(`<h3>${this.inline(line.replace(/^#{1,3}\s+/, ""))}</h3>`);
      } else if (/^[-*]\s+/.test(line)) {
        if (!listOpen) { output.push("<ul>"); listOpen = true; }
        output.push(`<li>${this.inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      } else {
        closeList();
        output.push(`<p>${this.inline(line)}</p>`);
      }
    }
    closeList();
    return output.join("");
  }

  renderLoading() {
    this.innerHTML = `<section class="ai-report-card ai-report-loading" aria-live="polite">
      <div class="ai-report-heading"><div><span class="ai-report-kicker">AI surf report</span><h2>Reading the next 72 hours…</h2></div><span class="ai-report-badge">Building</span></div>
      <div class="ai-report-pulse"><i></i><i></i><i></i></div>
      <p>Combining modeled waves, wind and weather for this break.</p>
    </section>`;
  }

  renderError(message) {
    this.innerHTML = `<section class="ai-report-card ai-report-error" aria-live="polite">
      <div class="ai-report-heading"><div><span class="ai-report-kicker">AI surf report</span><h2>Report unavailable</h2></div></div>
      <p>${this.escape(message)}</p><button type="button">Try again</button>
    </section>`;
    this.querySelector("button").addEventListener("click", () => { this.renderLoading(); this.load(); });
  }

  renderReport(data) {
    const generated = new Date(data.generatedAt);
    this.innerHTML = `<section class="ai-report-card" aria-labelledby="ai-report-heading">
      <div class="ai-report-heading"><div><span class="ai-report-kicker">AI surf report</span><h2 id="ai-report-heading">Your 72-hour read</h2></div><span class="ai-report-badge">Fresh</span></div>
      <div class="ai-report-copy">${this.markdown(data.markdown)}</div>
      <p class="ai-report-meta">Generated ${generated.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} from Open-Meteo modeled marine and weather data. Verify local conditions before entering the water.</p>
    </section>`;
  }

  async load() {
    const slug = this.getAttribute("spot-slug");
    if (!slug) return this.renderError("This location is missing its report identifier.");
    if (window.location.protocol === "file:") return this.renderError("Open this page through its Vercel preview to generate the report.");

    try {
      const response = await fetch(`/api/surf-report?slug=${encodeURIComponent(slug)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Report service returned ${response.status}`);
      this.renderReport(data);
    } catch (error) {
      console.error(error);
      this.renderError("The forecast remains available below while the AI report service recovers.");
    }
  }
}

customElements.define("ai-surf-report", AiSurfReport);

