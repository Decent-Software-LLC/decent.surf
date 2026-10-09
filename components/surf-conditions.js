class SurfConditions extends HTMLElement {
  static get observedAttributes() { return ["latitude", "longitude", "spot"]; }

  connectedCallback() {
    this.rememberVisit();
    this.renderLoading();
    this.load();
  }

  rememberVisit() {
    const slug = window.location.pathname.match(/\/spots\/([^/]+)/)?.[1];
    if (!slug) return;
    try {
      localStorage.setItem("decentSurfRecentSpot", JSON.stringify({ slug, visitedAt: Date.now() }));
    } catch {
      // Recent spots are optional when browser storage is unavailable.
    }
  }

  attributeChangedCallback() {
    if (this.isConnected) this.load();
  }

  async load() {
    const latitude = this.getAttribute("latitude");
    const longitude = this.getAttribute("longitude");
    const spot = this.getAttribute("spot") || "Current conditions";
    if (!latitude || !longitude) return this.renderError("Location coordinates are missing.");

    const parameters = new URLSearchParams({
      latitude,
      longitude,
      current: "wave_height,wave_direction,wave_period,sea_surface_temperature",
      length_unit: "imperial",
      temperature_unit: "fahrenheit",
      timezone: "auto"
    });

    try {
      const response = await fetch(`https://marine-api.open-meteo.com/v1/marine?${parameters}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Marine service returned ${response.status}`);
      const data = await response.json();
      this.renderConditions(spot, data.current, data.timezone_abbreviation);
      this.dispatchEvent(new CustomEvent("conditions-loaded", { detail: data, bubbles: true }));
    } catch (error) {
      console.error(error);
      this.renderError("Current conditions are temporarily unavailable.");
    }
  }

  compass(degrees) {
    if (!Number.isFinite(degrees)) return "—";
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
  }

  value(number, digits = 0) {
    return Number.isFinite(number) ? number.toFixed(digits) : "—";
  }

  renderLoading() {
    this.innerHTML = `<div class="surf-widget-state">Loading current conditions…</div>`;
  }

  renderError(message) {
    this.innerHTML = `<div class="surf-widget-state surf-widget-error">${message}</div>`;
  }

  renderConditions(spot, current, timezone) {
    const number = (value) => value === null || value === undefined ? NaN : Number(value);
    const height = number(current.wave_height);
    const period = number(current.wave_period);
    const direction = number(current.wave_direction);
    const temperature = number(current.sea_surface_temperature);
    const isDecent = height >= 3 && period >= 10;
    const isFair = !isDecent && height >= 2;
    const hasConditions = Number.isFinite(height) && Number.isFinite(period);
    const condition = !hasConditions ? "Unavailable" : isDecent ? "Decent" : isFair ? "Fair" : "Small";
    const heightDisplay = this.value(height, 1).replace(".", '<span class="surf-widget-decimal">.</span>');

    this.innerHTML = `
      <article class="surf-widget-card">
        <img class="surf-widget-art" src="/assets/images/decent-wave-icon.png" alt="" width="400" height="400" />
        <div class="surf-widget-heading">
          <div><span class="surf-widget-kicker">Right now</span><h2>Wave height</h2></div>
          <span class="surf-widget-rating surf-widget-rating--${condition.toLowerCase()}">${condition}</span>
        </div>
        <div class="surf-widget-primary"><strong>${heightDisplay}</strong><span>feet</span></div>
        <div class="surf-widget-grid">
          <div><span>Period</span><strong>${this.value(period)} sec</strong></div>
          <div><span>Direction</span><strong class="surf-widget-direction"><i style="transform:rotate(${Number.isFinite(direction) ? direction : 0}deg)">↓</i>${this.compass(direction)} ${this.value(direction)}°</strong></div>
          <div><span>Water</span><strong>${this.value(temperature)}°F</strong></div>
        </div>
        <p class="surf-widget-time">Updated ${current.time.replace("T", " ")} ${timezone || "local time"}</p>
      </article>`;
  }
}

customElements.define("surf-conditions", SurfConditions);
