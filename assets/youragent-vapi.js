import Vapi from "https://esm.sh/@vapi-ai/web?bundle";

(() => {
  const CFG = window.YOURAGENT_CONFIG || {};
  const LANG = (document.documentElement.lang || "en").toLowerCase();
  const PUBLIC_KEY = String(CFG.vapiPublicKey || "").trim();
  const ASSISTANT_ID = String(CFG.vapiAssistantId || "").trim();

  const TEXT = {
    de: { ready: "Bereit", connecting: "Verbinde…", live: "Live", ended: "Beendet", error: "Vapi-Call konnte nicht gestartet werden.", mic: "Bitte Mikrofon freigeben." },
    en: { ready: "Ready", connecting: "Connecting…", live: "Live", ended: "Ended", error: "Vapi call could not be started.", mic: "Please allow microphone access." },
    it: { ready: "Pronto", connecting: "Connessione…", live: "Live", ended: "Terminata", error: "Impossibile avviare la chiamata Vapi.", mic: "Consenti l'accesso al microfono." },
    fr: { ready: "Prêt", connecting: "Connexion…", live: "Live", ended: "Terminé", error: "Impossible de démarrer l'appel Vapi.", mic: "Veuillez autoriser le microphone." },
    bg: { ready: "Готов", connecting: "Свързване…", live: "На живо", ended: "Приключи", error: "Vapi разговорът не можа да стартира.", mic: "Разреши достъп до микрофона." }
  };

  const T = TEXT[LANG] || TEXT.en;

  const heroBtn = document.getElementById("talkLiveBtn");
  const heroStop = document.getElementById("talkLiveStop");
  const heroStatus = document.getElementById("talkLiveStatus");
  const heroTranscript = document.getElementById("yaTranscript");

  const realStart = document.getElementById("yaCallStart");
  const realEnd = document.getElementById("yaCallEnd");
  const realStatus = document.getElementById("yaCallStatus");
  const realDot = document.getElementById("yaCallDot");
  const realTranscript = document.getElementById("yaCallTranscript");
  const useMic = document.getElementById("yaUseMic");

  let vapi = null;
  let active = false;
  let currentSurface = "hero";
  let lastTranscript = "";

  function toast(msg) {
    window.YOURAGENT_AI?.toast?.(msg);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function setHeroState(state) {
    if (heroStatus) heroStatus.textContent = state;
    if (heroBtn) heroBtn.style.display = active ? "none" : "inline-flex";
    if (heroStop) heroStop.style.display = active ? "inline-flex" : "none";
  }

  function setRealState(state) {
    if (realStatus) realStatus.textContent = state;
    if (realDot) {
      realDot.style.background =
        state === T.live ? "#58d68d" :
        state === T.ended ? "#9aa4b2" : "#78a6ff";
    }
  }

  function appendHero(role, text) {
    if (!heroTranscript || !text) return;
    const row = document.createElement("div");
    row.className = `ya-msg ${role === "user" ? "ya-msg--user" : "ya-msg--assistant"}`;
    row.innerHTML =
      `<div class="ya-badge">${role === "user" ? (LANG === "de" ? "Du" : LANG === "en" ? "You" : LANG === "it" ? "Tu" : LANG === "fr" ? "Vous" : "Ти") : "Agent"}</div>` +
      `<div class="ya-bubble">${escapeHtml(text)}</div>`;
    heroTranscript.appendChild(row);
    heroTranscript.scrollTop = heroTranscript.scrollHeight;
  }

  function appendReal(role, text) {
    if (!realTranscript || !text) return;
    const row = document.createElement("div");
    row.style.margin = "0 0 10px";
    row.innerHTML =
      `<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.65;margin-bottom:4px">${role === "user" ? (LANG === "de" ? "Du" : LANG === "en" ? "You" : LANG === "it" ? "Tu" : LANG === "fr" ? "Vous" : "Ти") : "Agent"}</div>` +
      `<div style="border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:14px;padding:10px 12px;line-height:1.5">${escapeHtml(text)}</div>`;
    realTranscript.appendChild(row);
    realTranscript.scrollTop = realTranscript.scrollHeight;
  }

  function appendTranscript(role, text) {
    if (!text) return;
    if (currentSurface === "real") appendReal(role, text);
    else appendHero(role, text);
  }

  function setState(state) {
    setHeroState(state);
    setRealState(state);
  }

  function ensureVapi() {
    if (vapi || !PUBLIC_KEY) return vapi;
    vapi = new Vapi(PUBLIC_KEY);

    vapi.on("call-start", () => {
      active = true;
      setState(T.live);
    });

    vapi.on("call-end", () => {
      active = false;
      setState(T.ended);
      window.setTimeout(() => setState(T.ready), 900);
    });

    vapi.on("message", (message) => {
      if (!message || message.type !== "transcript" || !message.transcript) return;
      const role = message.role === "assistant" ? "assistant" : "user";
      const key = `${role}:${message.transcript}`;
      if (key === lastTranscript) return;
      lastTranscript = key;
      appendTranscript(role, message.transcript);
    });

    vapi.on("error", (error) => {
      console.error("Vapi error:", error);
      active = false;
      setState(T.ready);
      toast(T.error);
    });

    return vapi;
  }

  async function requestMic() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (error) {
      console.error("Microphone permission error:", error);
      toast(T.mic);
      return false;
    }
  }

  async function start(surface = "hero") {
    if (!PUBLIC_KEY || !ASSISTANT_ID) {
      throw new Error("Missing Vapi public key or assistant id");
    }
    const hasMic = await requestMic();
    if (!hasMic) return;
    currentSurface = surface;
    lastTranscript = "";
    setState(T.connecting);
    const instance = ensureVapi();
    await instance.start(ASSISTANT_ID);
  }

  async function stop() {
    if (!vapi || !active) {
      setState(T.ready);
      return;
    }
    await vapi.stop();
    active = false;
    setState(T.ended);
    window.setTimeout(() => setState(T.ready), 900);
  }

  window.YOURAGENT_VAPI = {
    isReady() { return Boolean(PUBLIC_KEY && ASSISTANT_ID); },
    isActive() { return active; },
    start,
    stop
  };

  setState(T.ready);

  if (heroBtn) {
    heroBtn.onclick = null;
    heroBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      if (!window.YOURAGENT_VAPI.isReady()) return;
      try {
        await start("hero");
      } catch (error) {
        console.error(error);
        toast(T.error);
        setState(T.ready);
      }
    }, true);
  }

  if (heroStop) {
    heroStop.onclick = null;
    heroStop.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      await stop();
    }, true);
  }

  if (realStart) {
    realStart.onclick = null;
    realStart.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      if (!window.YOURAGENT_VAPI.isReady()) return;
      if (!useMic?.checked) return;
      try {
        await start("real");
      } catch (error) {
        console.error(error);
        toast(T.error);
        setState(T.ready);
      }
    }, true);
  }

  if (realEnd) {
    realEnd.onclick = null;
    realEnd.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      await stop();
    }, true);
  }
})();
