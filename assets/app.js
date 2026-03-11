(() => {
  const root = document.documentElement;
  const LANG = (document.documentElement.lang || 'en').toLowerCase();
  const toggle = document.getElementById("themeToggle");
  const year = document.getElementById("year");
  const form = document.getElementById("contactForm");
  const toast = document.getElementById("toast");

  const I18N = {
    de: {
      themeDark: 'Theme: Dark',
      themeLight: 'Theme: Light',
      fillRequired: 'Bitte Name, E-Mail und Nachricht ausfüllen.',
      draftOpened: 'E-Mail-Entwurf geöffnet.'
    },
    en: {
      themeDark: 'Theme: Dark',
      themeLight: 'Theme: Light',
      fillRequired: 'Please fill in name, email and message.',
      draftOpened: 'Email draft opened.'
    },
    it: {
      themeDark: 'Tema: Scuro',
      themeLight: 'Tema: Chiaro',
      fillRequired: 'Compila nome, email e messaggio.',
      draftOpened: 'Bozza email aperta.'
    },
    fr: {
      themeDark: 'Thème : Sombre',
      themeLight: 'Thème : Clair',
      fillRequired: 'Veuillez remplir le nom, l’email et le message.',
      draftOpened: 'Brouillon d’email ouvert.'
    },
    bg: {
      themeDark: 'Тема: Тъмна',
      themeLight: 'Тема: Светла',
      fillRequired: 'Моля, попълнете име, имейл и съобщение.',
      draftOpened: 'Отвори се чернова на имейл.'
    }
  };
  const T = I18N[LANG] || I18N.en;

  year.textContent = String(new Date().getFullYear());

  const saved = localStorage.getItem("youragent_theme");
  if (saved === "light" || saved === "dark") {
    if (saved === "light") root.setAttribute("data-theme","light");
    else root.removeAttribute("data-theme");
  }

  toggle?.addEventListener("click", () => {
    const isLight = root.getAttribute("data-theme") === "light";
    if (isLight) {
      root.removeAttribute("data-theme");
      localStorage.setItem("youragent_theme","dark");
      toastMsg(T.themeDark);
    } else {
      root.setAttribute("data-theme","light");
      localStorage.setItem("youragent_theme","light");
      toastMsg(T.themeLight);
    }
  });

  function toastMsg(msg){
    if(!toast) return;
    toast.textContent = msg;
    clearTimeout(window.__ya_toast);
    window.__ya_toast = setTimeout(() => { toast.textContent = ""; }, 2200);
  }

  form?.addEventListener("submit", (e) => {
    const isMailtoFallback = form.dataset.yaMailtoFallback === "1";
    if (isMailtoFallback) delete form.dataset.yaMailtoFallback;
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const company = String(fd.get("company") || "").trim();
    const message = String(fd.get("message") || "").trim();

    if (!name || !email || !message) {
      toastMsg(T.fillRequired);
      return;
    }

    const subject = encodeURIComponent("Demo Anfrage YourAgent — " + name);
    const body = encodeURIComponent(
      `Name: ${name}\nE-Mail: ${email}\nFirma: ${company || "-"}\n\nNachricht:\n${message}\n`
    );

    const liveCfg = window.YOURAGENT_CONFIG || {};
    const liveAi = window.YOURAGENT_AI;
    if (!isMailtoFallback && liveCfg.mode === "live" && liveAi && typeof liveAi.isLive === "function" && liveAi.isLive()) {
      return;
    }

    window.location.href = `mailto:hello@youragent.de?subject=${subject}&body=${body}`;
    toastMsg(T.draftOpened);
    form.reset();
  });

  // --- Lightbox (clickable images) ---
  (function setupLightbox(){
    const body = document.body;
    if (!body) return;

    const lb = document.createElement("div");
    lb.className = "ya-lightbox";
    lb.innerHTML = `
      <div class="ya-lightbox__inner" role="dialog" aria-modal="true">
        <button class="ya-lightbox__close" type="button" aria-label="Close">✕</button>
        <img class="ya-lightbox__img" alt="Preview"/>
      </div>
    `;
    body.appendChild(lb);

    const imgEl = lb.querySelector(".ya-lightbox__img");
    const closeBtn = lb.querySelector(".ya-lightbox__close");
    const close = () => lb.classList.remove("is-open");

    closeBtn.addEventListener("click", close);
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    const open = (src) => {
      if (!src) return;
      imgEl.src = src;
      lb.classList.add("is-open");
    };

    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      const media = t.closest("[data-lightbox]");
      if (!media) return;

      const src = media.getAttribute("data-lightbox") ||
                  (media.querySelector("img") ? media.querySelector("img").getAttribute("src") : "");
      if (!src) return;

      e.preventDefault();
      open(src);
    });
  })();


  // Mirror top "Stop" button to demo reset (if present)
  (function(){
    const topReset = document.getElementById("yaResetSimTop");
    const reset = document.getElementById("yaResetSim");
    if (topReset && reset) {
      topReset.addEventListener("click", () => reset.click());
    }
  })();

  // Talk Live click is handled by assets/youragent-vapi.js

})();
// ============================
// v20: Custom Dropdown for Builder <select>
// - Fixes white native dropdown
// - Adds searchable, Apple-clean overlay
// ============================
(function(){
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function normalize(str){
    return String(str||"")
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu,'')
      .trim();
  }

  function createEl(tag, cls, attrs){
    const el = document.createElement(tag);
    if(cls) el.className = cls;
    if(attrs){
      for(const [k,v] of Object.entries(attrs)){
        if(v === null || typeof v === 'undefined') continue;
        if(k === 'text') el.textContent = v;
        else el.setAttribute(k, v);
      }
    }
    return el;
  }

  function enhanceSelect(select){
    if(!select || select.dataset.yaEnhanced === '1') return;

    // Wrap
    const wrap = createEl('div','ya-selectWrap');
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);

    select.classList.add('ya-selectNative');
    select.dataset.yaEnhanced = '1';

    // Hide native select so the browser dropdown never opens (we use the custom UI)
    select.style.position = 'absolute';
    select.style.opacity = '0';
    select.style.pointerEvents = 'none';
    select.style.width = '1px';
    select.style.height = '1px';
    select.style.margin = '0';
    select.style.padding = '0';
    select.tabIndex = -1;
    select.setAttribute('aria-hidden','true');


    const btn = createEl('button','ya-selectBtn',{type:'button'});
    const value = createEl('span','ya-selectValue',{text: select.options[select.selectedIndex]?.textContent || ''});
    const caret = createEl('span','ya-selectCaret',{ 'aria-hidden':'true'});
    caret.innerHTML = '&#9662;';
    btn.appendChild(value);
    btn.appendChild(caret);
    wrap.appendChild(btn);

    function open(){
      // Build overlay
      const overlay = createEl('div','ya-ddOverlay');
      const panel = createEl('div','ya-ddPanel', {role:'listbox'});
      const top = createEl('div','ya-ddTop');
      const many = select.options.length > 10;
      const search = many ? createEl('input','ya-ddSearch',{type:'text',placeholder: select.getAttribute('data-search-placeholder') || 'Search…'}) : null;
      if(search){ top.appendChild(search); }
      panel.appendChild(top);

      const list = createEl('div','ya-ddList');
      panel.appendChild(list);

      document.body.appendChild(overlay);
      document.body.appendChild(panel);

      // Position
      function position(){
        const r = btn.getBoundingClientRect();
        const w = Math.max(r.width, 320);
        panel.style.width = Math.min(w, window.innerWidth - 24) + 'px';
        const left = Math.min(Math.max(12, r.left), window.innerWidth - 12 - panel.getBoundingClientRect().width);
        const preferBelow = r.bottom + 10;
        const panelH = panel.getBoundingClientRect().height || 320;
        const belowFits = preferBelow + panelH < window.innerHeight - 12;
        const topPos = belowFits ? (r.bottom + 8) : Math.max(12, r.top - 8 - panelH);
        panel.style.left = left + 'px';
        panel.style.top = topPos + 'px';
      }

      let activeIndex = select.selectedIndex;

      function render(filter){
        const f = normalize(filter);
        list.innerHTML = '';
        const opts = Array.from(select.options).map((o, idx) => ({
          idx,
          text: o.textContent || '',
          value: o.value
        })).filter(o => !f || normalize(o.text).includes(f));

        if(activeIndex >= opts.length) activeIndex = Math.max(0, opts.length - 1);

        opts.forEach((o, i) => {
          const isSelected = select.selectedIndex === o.idx;
          const opt = createEl('div','ya-ddOpt' + (i===activeIndex ? ' is-active' : ''), {role:'option'});
          opt.dataset.idx = String(o.idx);
          const label = createEl('span','ya-ddLabel',{text:o.text});
          opt.appendChild(label);
          const check = createEl('span','ya-ddCheck',{'aria-hidden':'true'});
          check.innerHTML = isSelected ? '&#10003;' : '';
          opt.appendChild(check);

          opt.addEventListener('mouseenter', () => {
            activeIndex = i;
            qsa('.ya-ddOpt', list).forEach(el => el.classList.remove('is-active'));
            opt.classList.add('is-active');
          });
          opt.addEventListener('click', () => {
            select.selectedIndex = o.idx;
            select.dispatchEvent(new Event('change', {bubbles:true}));
            value.textContent = select.options[select.selectedIndex]?.textContent || '';
            close();
            btn.focus();
          });
          list.appendChild(opt);
        });

        // Ensure active visible
        const activeEl = qs('.ya-ddOpt.is-active', list);
        if(activeEl){
          const lr = list.getBoundingClientRect();
          const ar = activeEl.getBoundingClientRect();
          if(ar.top < lr.top) list.scrollTop -= (lr.top - ar.top) + 10;
          if(ar.bottom > lr.bottom) list.scrollTop += (ar.bottom - lr.bottom) + 10;
        }
      }

      function onKey(e){
        const optsEls = qsa('.ya-ddOpt', list);
        if(e.key === 'Escape'){ e.preventDefault(); close(); btn.focus(); return; }
        if(e.key === 'ArrowDown'){ e.preventDefault(); activeIndex = Math.min(activeIndex+1, Math.max(0, optsEls.length-1)); render(search?search.value:''); return; }
        if(e.key === 'ArrowUp'){ e.preventDefault(); activeIndex = Math.max(activeIndex-1, 0); render(search?search.value:''); return; }
        if(e.key === 'Enter'){
          e.preventDefault();
          const activeEl = optsEls[activeIndex];
          if(activeEl) activeEl.click();
          return;
        }
      }

      function onClickOutside(){ close(); }
      function onResize(){ position(); }
      function onScroll(){ position(); }

      function close(){
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll, true);
        document.removeEventListener('keydown', onKey, true);
        overlay.removeEventListener('click', onClickOutside);
        if(search){ search.removeEventListener('input', onSearch); }
        overlay.remove();
        panel.remove();
      }

      function onSearch(){ render(search.value); }

      overlay.addEventListener('click', onClickOutside);
      window.addEventListener('resize', onResize);
      window.addEventListener('scroll', onScroll, true);
      document.addEventListener('keydown', onKey, true);
      if(search){ search.addEventListener('input', onSearch); }

      render('');
      // Position after render so height known
      requestAnimationFrame(position);
      if(search){ search.focus(); search.select(); }
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });

    // Keep button label in sync if something changes programmatically
    select.addEventListener('change', () => {
      value.textContent = select.options[select.selectedIndex]?.textContent || '';
    });
  }

  function init(){
    qsa('select').forEach(enhanceSelect);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
