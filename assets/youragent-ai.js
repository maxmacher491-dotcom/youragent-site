(() => {
  const CFG = window.YOURAGENT_CONFIG || {};
  const LANG = (document.documentElement.lang || "en").toLowerCase();

  const I18N = {
    de: {
      sending: "Wird gesendet…",
      sent: "Nachricht gesendet.",
      failed: "Live API nicht erreichbar. Demo-Fallback aktiv.",
      missing: "Bitte Name, E-Mail und Nachricht ausfüllen.",
      noApi: "Live API noch nicht verbunden. Demo-Fallback aktiv."
    },
    en: {
      sending: "Sending…",
      sent: "Message sent.",
      failed: "Live API unavailable. Demo fallback active.",
      missing: "Please fill in name, email and message.",
      noApi: "Live API not connected yet. Demo fallback active."
    },
    it: {
      sending: "Invio…",
      sent: "Messaggio inviato.",
      failed: "API live non raggiungibile. Fallback demo attivo.",
      missing: "Compila nome, email e messaggio.",
      noApi: "API live non ancora collegata. Fallback demo attivo."
    },
    fr: {
      sending: "Envoi…",
      sent: "Message envoyé.",
      failed: "API live indisponible. Fallback démo actif.",
      missing: "Veuillez remplir le nom, l’email et le message.",
      noApi: "API live pas encore connectée. Fallback démo actif."
    },
    bg: {
      sending: "Изпращане…",
      sent: "Съобщението е изпратено.",
      failed: "Live API не е достъпно. Активиран е demo fallback.",
      missing: "Моля, попълнете име, имейл и съобщение.",
      noApi: "Live API още не е свързано. Активиран е demo fallback."
    }
  };

  const T = I18N[LANG] || I18N.en;

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(window.__yaLiveToast);
    window.__yaLiveToast = setTimeout(() => {
      el.textContent = "";
      el.classList.remove("on");
    }, 2600);
  }

  async function postJson(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(data?.error || data?.details || `HTTP ${res.status}`);
    }

    return data;
  }

  function normalizeChatResponse(data) {
    if (data && typeof data.reply === "string" && data.reply.trim()) return data;
    if (data && typeof data.message === "string" && data.message.trim()) {
      return { ...data, reply: data.message };
    }
    return data;
  }

  window.YOURAGENT_AI = {
    isLive() {
      return CFG.mode === "live" && typeof CFG.apiUrl === "string" && CFG.apiUrl.trim().length > 0;
    },

    async sendMessage({ message, history = [], page = window.location.pathname, context = {} }) {
      if (!this.isLive()) {
        throw new Error("LIVE_API_NOT_CONFIGURED");
      }

      const payload = {
        message: String(message || "").trim(),
        lang: LANG,
        page,
        history,
        promptId: CFG.promptId || "",
        context
      };

      return normalizeChatResponse(await postJson(CFG.apiUrl, payload));
    },

    async sendContact(formPayload) {
      const target = (CFG.contactApiUrl || CFG.apiUrl || "").trim();

      if (CFG.mode !== "live" || !target) {
        throw new Error("LIVE_API_NOT_CONFIGURED");
      }

      return postJson(target, {
        type: "contact_form",
        lang: LANG,
        page: window.location.pathname,
        ...formPayload
      });
    },

    toast
  };

  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "contactForm") return;

    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const company = String(fd.get("company") || "").trim();
    const message = String(fd.get("message") || "").trim();

    if (!name || !email || !message) {
      e.preventDefault();
      toast(T.missing);
      return;
    }

    if (!window.YOURAGENT_AI.isLive()) return;

    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"], .btn, .ya-btn--primary');
    const originalLabel = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) submitBtn.textContent = T.sending;

    try {
      await window.YOURAGENT_AI.sendContact({ name, email, company, message });
      form.reset();
      toast(T.sent);
    } catch (err) {
      console.error("YOURAGENT contact error:", err);
      toast(T.failed);
      form.dataset.yaMailtoFallback = "1";
      form.requestSubmit();
      delete form.dataset.yaMailtoFallback;
    } finally {
      if (submitBtn) submitBtn.textContent = originalLabel;
    }
  }, true);
})();
