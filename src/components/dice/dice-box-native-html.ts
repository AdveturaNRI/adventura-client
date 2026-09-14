/**
 * Native WebView HTML — same engine/API as public/dice-stage.html
 */
export function buildDiceBoxNativeHtml(options?: { accent?: string }) {
  const accent = options?.accent ?? '#157AFE';
  const version = '1.1.4';
  const cdn = `https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@${version}/dist`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #dice-box { margin:0; width:100%; height:100%; background:#0B1220; overflow:hidden; }
    #dice-box { position:relative; }
    #dice-box canvas { width:100% !important; height:100% !important; }
    #status {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      color:rgba(255,255,255,0.7); font:600 14px/1.4 -apple-system,system-ui,sans-serif;
      background:rgba(11,18,32,0.55); z-index:3;
    }
    #status.hidden { display:none; }
  </style>
</head>
<body>
  <div id="dice-box"><div id="status">Тянем 3D-движок…</div></div>
  <script type="module">
    const CDN = '${cdn}';
    const statusEl = document.getElementById('status');
    const ROLL_CFG = { throwForce:5, spinForce:5, startingHeight:8, settleTimeout:3500 };
    const PREVIEW_CFG = { throwForce:0, spinForce:0, startingHeight:1.1, settleTimeout:280, startPosition:[0,1.1,0] };

    function post(msg) {
      const payload = JSON.stringify(msg);
      if (window.ReactNativeWebView?.postMessage) window.ReactNativeWebView.postMessage(payload);
    }
    function setStatus(t){ statusEl.textContent=t; statusEl.classList.remove('hidden'); post({type:'status',message:t}); }
    function hideStatus(){ statusEl.classList.add('hidden'); }
    function flatten(results, notation) {
      const groups=[], values=[];
      (results||[]).forEach((group)=>{
        const rolls = Array.isArray(group.rolls) ? group.rolls.map(d=>d.value) : (typeof group.value==='number'?[group.value]:[]);
        rolls.forEach(v=>values.push(v));
        groups.push({ sides:Number(group.sides)||0, values:rolls, sum:rolls.reduce((a,b)=>a+b,0) });
      });
      const label = Array.isArray(notation) ? notation.join(' + ') : String(notation||'');
      return { values, sum:values.reduce((a,b)=>a+b,0), notation:label, groups };
    }
    function normalizeNotation(n){ return Array.isArray(n) ? n.filter(Boolean) : (n||'1d20'); }
    function isEmpty(n){ return Array.isArray(n) ? n.length===0 : !n; }

    setStatus('Тянем 3D-движок…');
    const DiceBox = (await import(CDN + '/dice-box.es.min.js')).default;
    setStatus('Собираем физику…');
    const box = new DiceBox('#dice-box', {
      origin:'', assetPath: CDN + '/assets/', theme:'default', themeColor:'${accent}',
      scale:6, gravity:1, ...ROLL_CFG, offscreen:false, enableShadows:false,
    });

    let ready=false, generation=0;
    try {
      await box.init();
      ready=true; hideStatus(); post({type:'ready'});
    } catch(err) {
      setStatus('Не удалось загрузить кубики');
      post({type:'error', message:String(err&&err.message||err)});
    }

    async function runPreview(notation){
      const token=++generation;
      if (isEmpty(notation)) { box.clear(); return; }
      box.updateConfig(PREVIEW_CFG);
      try { await box.roll(normalizeNotation(notation), { theme:'default', themeColor:'${accent}', newStartPoint:false }); }
      catch(e){ console.warn(e); }
      finally { if (token===generation) box.updateConfig(ROLL_CFG); }
    }

    async function runRoll(notation){
      const token=++generation;
      box.updateConfig(ROLL_CFG);
      try {
        const results = await box.roll(normalizeNotation(notation), { theme:'default', themeColor:'${accent}' });
        if (token===generation) post({ type:'done', outcome: flatten(results, notation) });
      } finally { if (token===generation) box.updateConfig(ROLL_CFG); }
    }

    async function onMessage(raw){
      try {
        const data = typeof raw==='string' ? JSON.parse(raw) : raw;
        if (!data || typeof data!=='object' || !ready) return;
        if (data.type==='preview') await runPreview(data.notation);
        if (data.type==='roll') await runRoll(data.notation ?? '1d20');
        if (data.type==='clear') { generation+=1; box.clear(); }
      } catch(err) {
        post({ type:'error', message:String(err&&err.message||err) });
      }
    }
    document.addEventListener('message', e => onMessage(e.data));
    window.addEventListener('message', e => onMessage(e.data));
  </script>
</body>
</html>`;
}
