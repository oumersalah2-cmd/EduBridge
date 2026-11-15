/* WebVTT parsing and writing. Pure functions, no DOM, so they can be tested alone. */
(function (root) {
  'use strict';

  // Turn "01:02:03.500" or "02:03.500" into seconds.
  function parseTime(str) {
    var parts = String(str).trim().replace(',', '.').split(':').reverse();
    var sec = parseFloat(parts[0]) || 0;
    var min = parseInt(parts[1], 10) || 0;
    var hr = parseInt(parts[2], 10) || 0;
    return hr * 3600 + min * 60 + sec;
  }

  // Turn seconds into "HH:MM:SS.mmm" (full) or "MM:SS.mmm" (short, for screen labels).
  function formatTime(seconds, short) {
    var ms = Math.round(Math.max(0, seconds) * 1000);
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    var r = ms % 1000;
    var pad = function (n, w) { return String(n).padStart(w, '0'); };
    var core = pad(m, 2) + ':' + pad(s, 2) + '.' + pad(r, 3);
    return short && h === 0 ? core : pad(h, 2) + ':' + core;
  }

  // Read WebVTT text into [{id, start, end, text, needsReview}].
  function parseVtt(raw) {
    var text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var blocks = text.split(/\n{2,}/);
    var cues = [];
    var pendingReview = false;
    blocks.forEach(function (block, i) {
      var lines = block.split('\n');
      if (i === 0 && lines[0].indexOf('WEBVTT') === 0) return;
      if (lines[0].indexOf('NOTE') === 0) {
        pendingReview = /^NOTE needs review\s*$/i.test(block.trim());
        return;
      }
      if (/^(STYLE|REGION)/.test(lines[0])) return;
      var ti = -1;
      for (var k = 0; k < lines.length; k++) {
        if (lines[k].indexOf('-->') !== -1) { ti = k; break; }
      }
      if (ti === -1) return;
      var halves = lines[ti].split('-->');
      cues.push({
        id: ti > 0 ? lines[0] : '',
        start: parseTime(halves[0]),
        end: parseTime(halves[1].trim().split(/\s+/)[0]),
        text: lines.slice(ti + 1).join('\n'),
        needsReview: pendingReview
      });
      pendingReview = false;
    });
    return cues;
  }

  // Write cues back to valid WebVTT. Flagged lines keep a "NOTE needs review" block.
  function serializeVtt(cues) {
    var body = cues.map(function (c) {
      var clean = String(c.text).trim().replace(/\n{2,}/g, '\n').replace(/-->/g, '->');
      return (c.needsReview ? 'NOTE needs review\n\n' : '') +
        (c.id ? c.id + '\n' : '') +
        formatTime(c.start) + ' --> ' + formatTime(c.end) + '\n' + clean;
    });
    return 'WEBVTT\n\n' + body.join('\n\n') + '\n';
  }

  var api = { parseTime: parseTime, formatTime: formatTime, parseVtt: parseVtt, serializeVtt: serializeVtt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EduVtt = api;
})(typeof window !== 'undefined' ? window : this);
