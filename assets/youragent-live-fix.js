
(() => {
  const LANG = (document.documentElement.lang || 'de').toLowerCase();
  const TMAP = {
    de: {
      previewMeta: 'Live AI',
      callReady: 'Bereit',
      callActive: 'Live',
      callEnded: 'Beendet',
      callStartMsg: 'Live-Call bereit. Du kannst direkt sprechen oder hier tippen.',
      callMicFallback: 'Mikrofon-Call ist in diesem Browser noch nicht aktiv. Der Tippen-Modus funktioniert bereits live.',
      callPlaceholder: 'oder tippen…',
      callError: 'Live-Antwort gerade nicht erreichbar.',
      previewError: 'Live-Antwort gerade nicht erreichbar.',
      genericFallback: 'Danke. Kannst du kurz genauer beschreiben, was du brauchst?',
      send: 'Senden'
    },
    en: {
      previewMeta: 'Live AI',
      callReady: 'Ready',
      callActive: 'Live',
      callEnded: 'Ended',
      callStartMsg: 'Live call is ready. You can speak directly or type here.',
      callMicFallback: 'Microphone calling is not active in this browser yet. Typing mode already works live.',
      callPlaceholder: 'or type…',
      callError: 'Live reply is currently unavailable.',
      previewError: 'Live reply is currently unavailable.',
      genericFallback: 'Thanks. Can you briefly describe what you need?',
      send: 'Send'
    },
    it: {
      previewMeta: 'Live AI', callReady: 'Pronto', callActive: 'Live', callEnded: 'Terminata',
      callStartMsg: 'La chiamata live è pronta. Puoi parlare direttamente oppure scrivere qui.',
      callMicFallback: 'La chiamata con microfono non è ancora attiva in questo browser. La modalità testo funziona già live.',
      callPlaceholder: 'oppure scrivi…', callError: 'Risposta live non disponibile al momento.', previewError: 'Risposta live non disponibile al momento.', genericFallback: 'Grazie. Puoi descrivere brevemente di cosa hai bisogno?', send: 'Invia'
    },
    fr: {
      previewMeta: 'Live AI', callReady: 'Prêt', callActive: 'Live', callEnded: 'Terminé',
      callStartMsg: 'L’appel live est prêt. Vous pouvez parler directement ou écrire ici.',
      callMicFallback: 'L’appel avec micro n’est pas encore actif dans ce navigateur. Le mode texte fonctionne déjà en live.',
      callPlaceholder: 'ou écrire…', callError: 'Réponse live momentanément indisponible.', previewError: 'Réponse live momentanément indisponible.', genericFallback: 'Merci. Pouvez-vous décrire brièvement votre besoin ?', send: 'Envoyer'
    },
    bg: {
      previewMeta: 'Live AI', callReady: 'Готов', callActive: 'На живо', callEnded: 'Приключи',
      callStartMsg: 'Live разговорът е готов. Можеш да говориш директно или да пишеш тук.',
      callMicFallback: 'Разговорът с микрофон още не е активен в този браузър. Режимът с писане вече работи на живо.',
      callPlaceholder: 'или пиши…', callError: 'Live отговорът в момента не е достъпен.', previewError: 'Live отговорът в момента не е достъпен.', genericFallback: 'Благодаря. Можеш ли накратко да опишеш какво ти трябва?', send: 'Изпрати'
    }
  };
  const T = TMAP[LANG] || TMAP.de;

  function toast(msg){ window.YOURAGENT_AI?.toast?.(msg); }
  function isLive(){ return !!(window.YOURAGENT_AI && window.YOURAGENT_AI.isLive && window.YOURAGENT_AI.isLive()); }
  async function liveReply(message, history = [], context = {}){
    if(!isLive()) throw new Error('LIVE_OFF');
    const data = await window.YOURAGENT_AI.sendMessage({ message, history, page: window.location.pathname, context });
    const typing = document.getElementById('yaTyping');
    if (typing) typing.hidden = true;
    return (data && typeof data.reply === 'string' && data.reply.trim()) ? data.reply.trim() : T.genericFallback;
  }

  // 1) Preview: kill demo fallback / hardcoded answers and force live AI.
  const previewChat = document.getElementById('yaPreviewChat');
  const previewInput = document.getElementById('yaPreviewInput');
  const previewSend = document.getElementById('yaPreviewSend');
  const previewReset = document.getElementById('yaPreviewReset');
  const promptOut = document.getElementById('yaPromptOut');
  const industry = document.getElementById('yaIndustry');
  const goal = document.getElementById('yaGoal');
  const tone = document.getElementById('yaTone');
  const intsWrap = document.getElementById('yaInts');
  const previewMeta = document.querySelector('.ya-previewMeta');
  if (previewMeta) previewMeta.textContent = T.previewMeta;

  function previewHistory(){
    if(!previewChat) return [];
    return Array.from(previewChat.querySelectorAll('.ya-previewMsg')).map(msg => ({
      role: msg.classList.contains('user') ? 'user' : 'assistant',
      content: (msg.querySelector('.ya-previewBubble')?.textContent || '').trim()
    })).filter(x => x.content);
  }
  function selectedIntegrations(){
    if(!intsWrap) return [];
    return Array.from(intsWrap.querySelectorAll('input:checked')).map(i => i.value);
  }
  function addPreview(role, text){
    if(!previewChat) return;
    const row = document.createElement('div');
    row.className = 'ya-previewMsg ' + (role === 'user' ? 'user' : 'agent');
    row.innerHTML = `<div class="ya-previewTag">${role === 'user' ? (LANG==='de'?'Du':LANG==='en'?'You':LANG==='it'?'Tu':LANG==='fr'?'Vous':'Ти') : 'Agent'}</div><div class="ya-previewBubble"></div>`;
    row.querySelector('.ya-previewBubble').textContent = text;
    previewChat.appendChild(row);
    previewChat.scrollTop = previewChat.scrollHeight;
  }
  async function handlePreview(){
    const value = (previewInput?.value || '').trim();
    if(!value || !previewChat) return;
    addPreview('user', value);
    previewInput.value = '';
    const typing = document.createElement('div');
    typing.className = 'ya-previewMsg agent';
    typing.innerHTML = `<div class="ya-previewTag">Agent</div><div class="ya-previewBubble">...</div>`;
    previewChat.appendChild(typing);
    previewChat.scrollTop = previewChat.scrollHeight;
    try {
      const reply = await liveReply(value, previewHistory().slice(-8), {
        builderPrompt: (promptOut?.value || '').trim(),
        industry: industry?.value || '', goal: goal?.value || '', tone: tone?.value || '', integrations: selectedIntegrations(), source: 'builder_preview'
      });
      typing.remove();
      addPreview('assistant', reply);
    } catch(e){
      console.error(e);
      typing.remove();
      addPreview('assistant', T.previewError);
      toast(T.previewError);
    }
  }
  if(previewSend){
    previewSend.addEventListener('click', (e)=>{ e.preventDefault(); e.stopImmediatePropagation(); handlePreview(); }, true);
  }
  if(previewInput){
    previewInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault(); e.stopImmediatePropagation(); handlePreview();
      }
    }, true);
  }
  if(previewReset && previewChat){
    previewReset.addEventListener('click', ()=>{ if(previewMeta) previewMeta.textContent = T.previewMeta; }, true);
  }

  // 2) Real call: stop dead / old demo buttons and make typed mode live.
  const callStart = document.getElementById('yaCallStart');
  const callEnd = document.getElementById('yaCallEnd');
  const callSend = document.getElementById('yaCallSend');
  const callInput = document.getElementById('yaCallInput');
  const callTranscript = document.getElementById('yaCallTranscript');
  const callStatus = document.getElementById('yaCallStatus');
  const callDot = document.getElementById('yaCallDot');
  const callScenario = document.getElementById('yaCallScenario');
  const useMic = document.getElementById('yaUseMic');

  function addCall(role, text){
    if(!callTranscript) return;
    const row = document.createElement('div');
    row.style.margin = '0 0 10px';
    row.innerHTML = `<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.65;margin-bottom:4px">${role==='user' ? (LANG==='de'?'Du':LANG==='en'?'You':LANG==='it'?'Tu':LANG==='fr'?'Vous':'Ти') : 'Agent'}</div><div style="border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:14px;padding:10px 12px;line-height:1.5">${text.replace(/</g,'&lt;')}</div>`;
    callTranscript.appendChild(row);
    callTranscript.scrollTop = callTranscript.scrollHeight;
  }
  function callHistory(){
    if(!callTranscript) return [];
    return Array.from(callTranscript.children).map(row=>({
      role: ((row.firstChild?.textContent || '').toLowerCase().includes('agent')) ? 'assistant' : 'user',
      content: (row.lastChild?.textContent || '').trim()
    })).filter(x=>x.content);
  }
  function setCallState(state){
    if(callStatus) callStatus.textContent = state;
    if(callDot){ callDot.style.background = (state===T.callActive ? '#58d68d' : state===T.callEnded ? '#9aa4b2' : '#78a6ff'); }
  }
  async function handleCallSend(){
    const value = (callInput?.value || '').trim();
    if(!value || !callTranscript) return;
    addCall('user', value);
    callInput.value = '';
    try {
      const reply = await liveReply(value, callHistory().slice(-8), {
        source: 'call_demo', scenario: callScenario?.value || '', mode: 'typed_call'
      });
      addCall('assistant', reply);
    } catch(e){
      console.error(e);
      addCall('assistant', T.callError);
      toast(T.callError);
    }
  }
  if(callStart){
    callStart.addEventListener('click', async (e)=>{
      e.preventDefault(); e.stopImmediatePropagation();
      if (useMic?.checked && window.YOURAGENT_VAPI?.isReady?.()) {
        try {
          await window.YOURAGENT_VAPI.start("real");
        } catch(err) {
          console.error(err);
          toast(T.callError);
        }
        return;
      }
      setCallState(T.callActive);
      if (!callTranscript?.children?.length) {
        addCall('assistant', T.callStartMsg);
      }
      callInput?.focus();
    }, true);
  }
  if(callEnd){
    callEnd.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopImmediatePropagation();
      if (window.YOURAGENT_VAPI?.isActive?.()) {
        window.YOURAGENT_VAPI.stop();
      }
      setCallState(T.callEnded);
    }, true);
  }
  if(callSend){
    callSend.addEventListener('click', (e)=>{ e.preventDefault(); e.stopImmediatePropagation(); handleCallSend(); }, true);
  }
  if(callInput){
    callInput.placeholder = T.callPlaceholder;
    callInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault(); e.stopImmediatePropagation(); handleCallSend();
      }
    }, true);
  }
})();
