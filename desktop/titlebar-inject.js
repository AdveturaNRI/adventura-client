// The native Windows controls remain in the title bar overlay; this supplies
// the branded draggable area and reserves space for it in the web content.
(() => {
  if (document.getElementById('adventura-desktop-titlebar')) return;
  const style = document.createElement('style');
  style.textContent = `
    html { height: calc(100% - 40px) !important; margin-top: 40px !important; }
    [aria-modal="true"] { top: 40px !important; transform: translateZ(0); }
    #adventura-desktop-titlebar {
      position: fixed; top: 0; left: 0; right: 0; height: 40px;
      box-sizing: border-box; z-index: 2147483647; display: flex;
      align-items: center; gap: 10px; padding: 0 160px 0 16px;
      color: #e4ecf8; background: #111827; border-bottom: 1px solid #263449;
      font: 600 13px system-ui, sans-serif; letter-spacing: .035em;
      user-select: none; -webkit-app-region: drag;
    }
    #adventura-desktop-titlebar img {
      display: block; width: 28px; height: 28px; object-fit: contain;
    }
  `;
  document.head.appendChild(style);
  const bar = document.createElement('div');
  bar.id = 'adventura-desktop-titlebar';
  bar.setAttribute('aria-hidden', 'true');
  const mark = document.createElement('img');
  mark.src = "__ADVENTURA_TITLEBAR_LOGO__";
  mark.alt = '';
  bar.append(mark, document.createTextNode('Adventura'));
  document.documentElement.appendChild(bar);
})();
