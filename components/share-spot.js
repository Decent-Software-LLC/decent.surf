class ShareSpot extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display:inline-flex; margin-left:.2em; vertical-align:.04em; }
        button { display:inline-grid; width:.82em; height:.82em; padding:0; border:0; color:inherit; background:transparent; cursor:pointer; font:inherit; place-items:center; }
        button:hover { color:#147da1; }
        button:focus-visible { border-radius:.12em; outline:3px solid rgb(20 125 161/.25); outline-offset:3px; }
        svg { display:block; width:100%; height:100%; overflow:visible; }
      </style>
      <button type="button" aria-label="Share this surf spot" title="Share this surf spot">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15V3m0 0L8 7m4-4 4 4M6 10H4.8A1.8 1.8 0 0 0 3 11.8v7.4A1.8 1.8 0 0 0 4.8 21h14.4a1.8 1.8 0 0 0 1.8-1.8v-7.4a1.8 1.8 0 0 0-1.8-1.8H18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>`;

    root.querySelector("button").addEventListener("click", () => this.share());
  }

  async share() {
    const heading = this.closest("h1");
    const title = heading?.childNodes[0]?.textContent?.trim() || document.title;
    const data = { title: `${title} Surf Conditions — decent.surf`, text: `Check the surf conditions at ${title}.`, url: location.href };

    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(data.url);
        this.feedback("Link copied");
      }
    } catch (error) {
      if (error.name !== "AbortError") this.feedback("Unable to share");
    }
  }

  feedback(message) {
    const button = this.shadowRoot.querySelector("button");
    const original = button.getAttribute("aria-label");
    button.setAttribute("aria-label", message);
    button.title = message;
    window.setTimeout(() => {
      button.setAttribute("aria-label", original);
      button.title = original;
    }, 1800);
  }
}

customElements.define("share-spot", ShareSpot);
