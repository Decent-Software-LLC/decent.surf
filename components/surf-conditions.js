class SurfConditions extends HTMLElement {
  static get observedAttributes() { return ["latitude", "longitude", "spot"]; }

  connectedCallback() {
    this.renderLoading();
    this.load();
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
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
  }

  renderLoading() {
    this.innerHTML = `<div class="surf-widget-state">Loading current conditions…</div>`;
  }

  renderError(message) {
    this.innerHTML = `<div class="surf-widget-state surf-widget-error">${message}</div>`;
  }

  renderConditions(spot, current, timezone) {
    const height = Number(current.wave_height);
    const period = Number(current.wave_period);
    const direction = Number(current.wave_direction);
    const temperature = Number(current.sea_surface_temperature);
    const condition = height >= 3 && period >= 10 ? "Good" : height >= 2 && period >= 8 ? "Fair" : "Small";
    const heightDisplay = height.toFixed(1).replace(".", '<span class="surf-widget-decimal">.</span>');

    this.innerHTML = `
      <article class="surf-widget-card">
        <img class="surf-widget-art" src="/assets/images/decent-wave-icon.png" alt="" width="400" height="400" />
        <div class="surf-widget-heading">
          <div><span class="surf-widget-kicker">Right now</span><h2>Wave height</h2></div>
          <span class="surf-widget-rating surf-widget-rating--${condition.toLowerCase()}">${condition}</span>
        </div>
        <div class="surf-widget-primary"><strong>${heightDisplay}</strong><span>feet</span></div>
        <div class="surf-widget-grid">
          <div><span>Period</span><strong>${period.toFixed(0)} sec</strong></div>
          <div><span>Direction</span><strong class="surf-widget-direction"><i style="transform:rotate(${direction}deg)">↓</i>${this.compass(direction)} ${direction.toFixed(0)}°</strong></div>
          <div><span>Water</span><strong>${temperature.toFixed(0)}°F</strong></div>
        </div>
        <p class="surf-widget-time">Updated ${current.time.replace("T", " ")} ${timezone || "local time"}</p>
      </article>`;
  }
}

customElements.define("surf-conditions", SurfConditions);
