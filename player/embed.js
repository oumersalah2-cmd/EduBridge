/**
 * EduBridge Single-Line Embed Script (embed.js)
 * 
 * Purpose:
 * Allows any host website to embed the accessible EduBridge player with a single line of code:
 * <script src="https://example.com/player/embed.js" data-video-id="VIDEO_ID"></script>
 * or declarative placeholders:
 * <div data-edubridge-player data-src="..." data-captions="..." data-sign="..."></div>
 */

(function () {
  'use strict';

  // Ensure db-player script is loaded
  const scriptUrl = new URL(document.currentScript ? document.currentScript.src : window.location.href);
  const basePath = scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/'));
  const componentUrl = `${scriptUrl.origin}${basePath}/db-player.js`;

  if (!customElements.get('db-player')) {
    const script = document.createElement('script');
    script.src = componentUrl;
    script.defer = true;
    document.head.appendChild(script);
  }

  // Auto-mount on currentScript if data-video-id or data-src is present
  const currentScript = document.currentScript;
  if (currentScript) {
    const src = currentScript.getAttribute('data-src') || '';
    const captions = currentScript.getAttribute('data-captions') || '';
    const sign = currentScript.getAttribute('data-sign') || '';
    const lang = currentScript.getAttribute('data-lang') || 'am';
    const api = currentScript.getAttribute('data-api') || 'http://localhost:4000/api';

    if (src || currentScript.getAttribute('data-video-id')) {
      const playerEl = document.createElement('db-player');
      if (src) playerEl.setAttribute('src', src);
      if (captions) playerEl.setAttribute('captions', captions);
      if (sign) playerEl.setAttribute('sign', sign);
      playerEl.setAttribute('lang', lang);
      playerEl.setAttribute('api', api);

      currentScript.parentNode.insertBefore(playerEl, currentScript.nextSibling);
    }
  }

  // Scan for any declarative placeholder divs: <div data-edubridge-player ...></div>
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-edubridge-player]').forEach((placeholder) => {
      const playerEl = document.createElement('db-player');
      ['src', 'captions', 'sign', 'describe', 'lang', 'api'].forEach((attr) => {
        const val = placeholder.getAttribute(`data-${attr}`);
        if (val) playerEl.setAttribute(attr, val);
      });
      placeholder.replaceWith(playerEl);
    });
  });
})();
