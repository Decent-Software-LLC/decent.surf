const CAMERA_SPOTS = new Set([
  "ala-moana-bowls",
  "asbury-park",
  "banzai-pipeline",
  "cape-hatteras-lighthouse",
  "carolina-beach-pier",
  "cowell-beach",
  "crystal-pier",
  "diamond-head-cliffs",
  "first-street-jetty",
  "lahaina-breakwall",
  "linda-mar",
  "lincoln-boulevard",
  "manasquan-inlet",
  "matunuck-point",
  "narragansett-town-beach",
  "new-smyrna-inlet",
  "ocean-city-inlet",
  "rodanthe-pier",
  "sebastian-inlet",
  "steamer-lane",
  "the-washout",
  "venice-breakwater",
  "waimea-bay",
  "westport-jetty",
  "jennettes-pier"
]);

const CAMERA_SLUGS = {
  "carolina-beach-pier": "carolina-beach",
  "crystal-pier": "wrightsville-beach",
  "first-street-jetty": "first-street-jetty-vb",
  "jennettes-pier": "jennettes-pier",
  "lincoln-boulevard": "long-beach-ny",
  "matunuck-point": "matunuck",
  "narragansett-town-beach": "narragansett-beach",
  "new-smyrna-inlet": "new-smyrna-beach-inlet",
  "rodanthe-pier": "rodanthe",
  "the-washout": "folly-beach-washout"
};

class LiveCamera extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;

    const spotSlug = location.pathname.match(/\/spots\/([^/]+)/)?.[1];
    if (!spotSlug || !CAMERA_SPOTS.has(spotSlug)) {
      this.hidden = true;
      return;
    }

    const cameraSlug = CAMERA_SLUGS[spotSlug] || spotSlug;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display:flex; justify-content:flex-end; margin:-20px 4px 34px; }
        a { display:inline-flex; align-items:center; gap:8px; padding:9px 14px; border:1px solid #c9e0e8; border-radius:999px; color:#07536f; background:#fff; box-shadow:0 7px 20px rgb(21 74 96/.08); font:800 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; text-decoration:none; transition:border-color 160ms ease,color 160ms ease,transform 160ms ease; }
        a:hover,a:focus-visible { border-color:#147da1; color:#147da1; transform:translateY(-1px); }
        a:focus-visible { outline:3px solid rgb(20 125 161/.2); outline-offset:2px; }
        .dot { width:8px; height:8px; border-radius:50%; background:#19a878; box-shadow:0 0 0 3px rgb(25 168 120/.13); }
        @media (max-width:600px) { :host { justify-content:center; margin-top:-18px; } a { padding:11px 17px; font-size:13px; } }
      </style>
      <a href="https://stormypetrel.surf/spot/${cameraSlug}" target="_blank" rel="noopener" aria-label="Watch live surf camera (opens in a new tab)">
        <span class="dot" aria-hidden="true"></span>Live surf cam <span aria-hidden="true">↗</span>
      </a>`;
  }
}

customElements.define("live-camera", LiveCamera);
