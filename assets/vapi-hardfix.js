(() => {
  function boot() {
    const btn = document.getElementById("talkLiveBtn");
    const stop = document.getElementById("talkLiveStop");

    if (!btn || !window.YOURAGENT_VAPI) return;

    const freshBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(freshBtn, btn);

    freshBtn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        try {
          if (!window.YOURAGENT_VAPI.isReady()) {
            console.error("Vapi not ready");
            return;
          }
          await window.YOURAGENT_VAPI.start("hero");
        } catch (err) {
          console.error("Hardfix start error:", err);
        }
      },
      true
    );

    if (stop) {
      const freshStop = stop.cloneNode(true);
      stop.parentNode.replaceChild(freshStop, stop);

      freshStop.addEventListener(
        "click",
        async (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          try {
            await window.YOURAGENT_VAPI.stop();
          } catch (err) {
            console.error("Hardfix stop error:", err);
          }
        },
        true
      );
    }

    console.log("VAPI HARDFIX ACTIVE");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 300));
  } else {
    setTimeout(boot, 300);
  }
})();
