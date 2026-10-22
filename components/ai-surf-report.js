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
      <div class="ai-report-copy-wrap is-collapsed">
        <div class="ai-report-copy" id="ai-report-copy">${this.markdown(data.markdown)}</div>
      </div>
      <div class="ai-report-actions">
        <button class="ai-report-audio" type="button" data-provider="elevenlabs" aria-label="Play ElevenLabs audio surf report">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9H5Zm11.5 3a3.5 3.5 0 0 0-1.5-2.87v5.74A3.5 3.5 0 0 0 16.5 12Zm-1.5-6.92v2.06a5.5 5.5 0 0 1 0 9.72v2.06a7.5 7.5 0 0 0 0-13.84Z"/></svg>
          <span>ElevenLabs</span><small>Play</small>
        </button>
        <button class="ai-report-audio" type="button" data-provider="google" aria-label="Play Google Gemini audio surf report">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9H5Zm11.5 3a3.5 3.5 0 0 0-1.5-2.87v5.74A3.5 3.5 0 0 0 16.5 12Zm-1.5-6.92v2.06a5.5 5.5 0 0 1 0 9.72v2.06a7.5 7.5 0 0 0 0-13.84Z"/></svg>
          <span>Google Gemini</span><small>Play</small>
        </button>
        <button class="ai-report-toggle" type="button" aria-expanded="false" aria-controls="ai-report-copy">Read more</button>
      </div>
      <p class="ai-report-audio-status" role="status" aria-live="polite"></p>
      <p class="ai-report-meta">Generated ${generated.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} from modeled marine, weather and available NOAA/NWS safety data. Verify local conditions before entering the water.</p>
    </section>`;

    const wrap = this.querySelector(".ai-report-copy-wrap");
    const copy = this.querySelector(".ai-report-copy");
    const toggle = this.querySelector(".ai-report-toggle");
    const audioButtons = [...this.querySelectorAll(".ai-report-audio")];
    requestAnimationFrame(() => {
      const bestWindowHeading = [...copy.querySelectorAll("h3")].find((heading) => heading.textContent.trim().toLowerCase() === "best window");
      const cutoff = bestWindowHeading ? bestWindowHeading.offsetTop + bestWindowHeading.offsetHeight + 18 : 250;
      wrap.style.setProperty("--ai-report-collapsed-height", `${cutoff}px`);
    });
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      toggle.textContent = expanded ? "Read more" : "Show less";
      wrap.classList.toggle("is-collapsed", expanded);
    });
    audioButtons.forEach((button) => button.addEventListener("click", () => this.toggleAudio(data, button)));
  }

  setAudioButton(button, state) {
    const label = button.querySelector("small");
    button.classList.toggle("is-playing", state === "playing");
    button.disabled = state === "loading";
    label.textContent = state === "loading" ? "Preparing…" : state === "playing" ? "Pause" : "Play";
    button.setAttribute("aria-label", `${label.textContent.replace("…", "")} ${button.querySelector("span").textContent} audio surf report`);
  }

  async toggleAudio(data, button) {
    const provider = button.dataset.provider;
    const status = this.querySelector(".ai-report-audio-status");
    this.audioPlayers ||= new Map();
    for (const [otherProvider, player] of this.audioPlayers) {
      if (otherProvider !== provider && !player.audio.paused) {
        player.audio.pause();
        this.setAudioButton(player.button, "ready");
      }
    }
    const existing = this.audioPlayers.get(provider);
    if (existing) {
      if (existing.audio.paused) {
        await existing.audio.play();
        this.setAudioButton(button, "playing");
      } else {
        existing.audio.pause();
        this.setAudioButton(button, "ready");
      }
      return;
    }

    this.setAudioButton(button, "loading");
    const providerLabel = provider === "google" ? "Google Gemini" : "ElevenLabs";
    status.textContent = `Generating the ${providerLabel} version…`;
    try {
      const response = await fetch("/api/report-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spot: data.spot, markdown: data.markdown, provider })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Audio service returned ${response.status}`);
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      this.audioPlayers.set(provider, { audio, url, button });
      audio.addEventListener("ended", () => this.setAudioButton(button, "ready"));
      audio.addEventListener("error", () => {
        status.textContent = "Audio playback was interrupted. Please try again.";
        this.setAudioButton(button, "ready");
      });
      await audio.play();
      status.textContent = "";
      this.setAudioButton(button, "playing");
    } catch (error) {
      console.error(error);
      status.textContent = "Audio is temporarily unavailable. Please try again.";
      this.setAudioButton(button, "ready");
    }
  }

  disconnectedCallback() {
    for (const player of this.audioPlayers?.values() || []) {
      player.audio.pause();
      URL.revokeObjectURL(player.url);
    }
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
