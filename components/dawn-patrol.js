class DawnPatrol extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display:block; margin-top:36px; }
        * { box-sizing:border-box; }
        .card { display:grid; grid-template-columns:105px minmax(0,1fr); gap:10px 22px; align-items:center; padding:22px 26px; border:1px solid #d9e8ee; border-radius:20px; color:#173047; background:#fff; box-shadow:0 14px 38px rgb(21 74 96/.1); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; }
        .surfer { grid-row:1/3; display:block; width:92px; height:132px; object-fit:contain; }
        .copy { align-self:end; }
        .eyebrow { margin:0 0 5px; color:#147da1; font-size:11px; font-weight:800; letter-spacing:.17em; text-transform:uppercase; }
        .description { margin:0; color:#65798a; font-size:14px; }
        .buttons { display:grid; grid-template-columns:repeat(4,minmax(max-content,1fr)); gap:8px; align-self:start; }
        .button { display:flex; align-items:center; gap:8px; min-width:max-content; padding:6px 11px 6px 6px; border-radius:999px; color:#fff; background:#07536f; font-size:11px; font-weight:800; text-decoration:none; transition:background 160ms ease,transform 160ms ease; }
        .button:hover,.button:focus-visible { background:#147da1; transform:translateY(-1px); }
        .button:focus-visible { outline:3px solid rgb(20 125 161/.22); outline-offset:2px; }
        .button img { display:block; flex:none; width:42px; height:42px; object-fit:contain; }
        .button span { white-space:nowrap; }
        @media (max-width:800px) { .buttons { grid-template-columns:repeat(2,minmax(max-content,1fr)); } }
        @media (max-width:520px) {
          :host { margin-top:30px; }
          .card { grid-template-columns:70px minmax(0,1fr); gap:8px 14px; padding:18px 16px; }
          .surfer { width:64px; height:92px; }
          .buttons { grid-column:1/-1; grid-template-columns:1fr; }
          .button { width:100%; min-width:0; font-size:12px; }
          .button img { width:48px; height:48px; }
        }
      </style>
      <aside class="card" aria-labelledby="dawn-patrol-heading">
        <img class="surfer" src="/assets/images/clay-beach-surfer.png" alt="Claymation surfer giving a shaka" width="532" height="800" loading="lazy" />
        <div class="copy"><p class="eyebrow" id="dawn-patrol-heading">Dawn Patrol Prep</p><p class="description">Stock up before the next swell rolls through.</p></div>
        <div class="buttons">
          <a class="button" href="https://www.amazon.com/s?k=Surf+wax&amp;tag=decent-surf-20" target="_blank" rel="sponsored noopener"><img src="/assets/images/clay-surf-wax.png" alt="" width="300" height="300" loading="lazy" /><span>Get more wax</span></a>
          <a class="button" href="https://www.amazon.com/s?k=rashguard&amp;tag=decent-surf-20" target="_blank" rel="sponsored noopener"><img src="/assets/images/clay-rashguard-surfer.png" alt="" width="300" height="300" loading="lazy" /><span>Got a Rashie?</span></a>
          <a class="button" href="https://www.amazon.com/s?k=wetsuit&amp;tag=decent-surf-20" target="_blank" rel="sponsored noopener"><img src="/assets/images/clay-cold-surfer.png" alt="" width="300" height="300" loading="lazy" /><span>Colder Water</span></a>
          <a class="button" href="https://www.amazon.com/s?k=board+shorts&amp;tag=decent-surf-20" target="_blank" rel="sponsored noopener"><img src="/assets/images/clay-board-shorts.png" alt="" width="300" height="300" loading="lazy" /><span>Board Shorts</span></a>
        </div>
      </aside>`;
  }
}

customElements.define("dawn-patrol", DawnPatrol);
