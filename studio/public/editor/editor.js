/* Caption editor. Plain JS. Depends on vtt.js (EduVtt). */
(function () {
  'use strict';

  // All visible text lives here. Amharic strings need review by a native reader.
  var TEXT = {
    en: {
      title: 'Caption editor', skip: 'Skip to caption lines', uiLang: 'Interface language',
      filesHeading: 'Files', openVtt: 'Open caption file (.vtt)', loadSample: 'Load sample captions',
      restore: 'Restore saved draft', openVideo: 'Open video to preview (optional)',
      capLang: 'Caption language', linesHeading: 'Caption lines', save: 'Save now',
      exportVtt: 'Export .vtt', help: 'Keyboard help', close: 'Close',
      helpTitle: 'Keyboard shortcuts', kNext: 'Go to the next line', kPrev: 'Go to the previous line',
      kReplay: 'Replay the current line in the video', kFlag: 'Mark or unmark the current line as needing review',
      kSave: 'Save', helpNote: 'Every shortcut also has a button on the page.',
      needsReview: 'Needs review', playLine: 'Play line',
      lineLabel: function (n, a, b) { return 'Line ' + n + ', ' + a + ' to ' + b; },
      playLineN: function (n) { return 'Play line ' + n; },
      needsReviewN: function (n) { return 'Needs review, line ' + n; },
      summary: function (n, f) { return n + ' lines, ' + f + ' marked as needing review'; },
      saved: 'Saved', loaded: function (n, name) { return 'Loaded ' + n + ' lines from ' + name; },
      flagged: function (n) { return 'Line ' + n + ' marked as needing review'; },
      unflagged: function (n) { return 'Line ' + n + ' review mark removed'; },
      exported: 'Exported. The file was downloaded.',
      exportedEmpty: function (k) { return 'Exported. ' + k + ' lines are empty.'; },
      restored: 'Saved draft restored',
      noVideo: 'Open a video first to replay a line.',
      errNoCues: 'No captions found in this file. Choose a WebVTT (.vtt) file.',
      errSample: 'Could not load the sample. Start the project with a local server and check that studio/public/editor/sample.en.vtt exists.',
      errNothing: 'There are no caption lines to export. Open a caption file first.',
      errLoad: 'Could not load the captions from the Studio link. Open the .vtt file yourself instead.'
    },
    am: {
      title: 'የመግለጫ ጽሑፍ አርታዒ', skip: 'ወደ ጽሑፍ መስመሮች ዝለል', uiLang: 'የመተግበሪያ ቋንቋ',
      filesHeading: 'ፋይሎች', openVtt: 'የመግለጫ ጽሑፍ ፋይል ክፈት (.vtt)', loadSample: 'የናሙና ጽሑፍ ጫን',
      restore: 'የተቀመጠውን ረቂቅ መልስ', openVideo: 'ለቅድመ እይታ ቪዲዮ ክፈት (አማራጭ)',
      capLang: 'የጽሑፉ ቋንቋ', linesHeading: 'የጽሑፍ መስመሮች', save: 'አሁን አስቀምጥ',
      exportVtt: '.vtt ላክ', help: 'የቁልፍ ሰሌዳ እገዛ', close: 'ዝጋ',
      helpTitle: 'የቁልፍ ሰሌዳ አቋራጮች', kNext: 'ወደ ቀጣዩ መስመር ሂድ', kPrev: 'ወደ ቀዳሚው መስመር ሂድ',
      kReplay: 'አሁን ያለውን መስመር በቪዲዮው ላይ እንደገና አጫውት', kFlag: 'አሁን ያለውን መስመር ግምገማ እንደሚያስፈልገው ምልክት አድርግ ወይም አንሳ',
      kSave: 'አስቀምጥ', helpNote: 'እያንዳንዱ አቋራጭ በገጹ ላይ ተመሳሳይ አዝራር አለው።',
      needsReview: 'ግምገማ ያስፈልገዋል', playLine: 'መስመሩን አጫውት',
      lineLabel: function (n, a, b) { return 'መስመር ' + n + '፣ ከ' + a + ' እስከ ' + b; },
      playLineN: function (n) { return 'መስመር ' + n + ' አጫውት'; },
      needsReviewN: function (n) { return 'ግምገማ ያስፈልገዋል፣ መስመር ' + n; },
      summary: function (n, f) { return n + ' መስመሮች፣ ' + f + ' ግምገማ ያስፈልጋቸዋል'; },
      saved: 'ተቀምጧል', loaded: function (n, name) { return n + ' መስመሮች ከ' + name + ' ተጭነዋል'; },
      flagged: function (n) { return 'መስመር ' + n + ' ግምገማ እንደሚያስፈልገው ምልክት ተደርጎበታል'; },
      unflagged: function (n) { return 'የመስመር ' + n + ' የግምገማ ምልክት ተነስቷል'; },
      exported: 'ተልኳል። ፋይሉ ወርዷል።',
      exportedEmpty: function (k) { return 'ተልኳል። ' + k + ' መስመሮች ባዶ ናቸው።'; },
      restored: 'የተቀመጠው ረቂቅ ተመልሷል',
      noVideo: 'መስመር ለማጫወት መጀመሪያ ቪዲዮ ክፈት።',
      errNoCues: 'በዚህ ፋይል ውስጥ ጽሑፍ አልተገኘም። የ WebVTT (.vtt) ፋይል ምረጥ።',
      errSample: 'ናሙናውን መጫን አልተቻለም። ፕሮጀክቱን በአካባቢያዊ አገልጋይ አስጀምር እና studio/public/editor/sample.en.vtt መኖሩን አረጋግጥ።',
      errNothing: 'ለመላክ የጽሑፍ መስመሮች የሉም። መጀመሪያ የመግለጫ ጽሑፍ ፋይል ክፈት።',
      errLoad: 'ጽሑፉን ከስቱዲዮ ማገናኛ መጫን አልተቻለም። የ .vtt ፋይሉን ራስህ ክፈት።'
    }
  };

  var DRAFT_KEY = 'edubridge:editor:draft';
  var state = { cues: [], name: 'captions.vtt', current: 0, ui: 'en', capLang: 'en', videoId: null };
  var stopAt = null;
  var saveTimer = null;

  function getStudioKey() {
    try {
      var saved = localStorage.getItem('edubridge:studio_key');
      if (saved && saved.trim()) return saved.trim();
    } catch (e) {}
    return 'change-me-to-a-long-random-string';
  }

  var $ = function (id) { return document.getElementById(id); };
  var list = $('lines'), statusEl = $('status'), errorEl = $('error'), video = $('preview');
  var t = function () { return TEXT[state.ui]; };

  // Speak a message through the polite live region. Clearing first lets repeats be announced.
  function announce(msg) {
    statusEl.textContent = '';
    setTimeout(function () { statusEl.textContent = msg; }, 50);
  }

  function showError(msg) { errorEl.textContent = msg || ''; }

  // Fill every [data-i18n] element with text for the interface language.
  function applyText() {
    document.documentElement.lang = state.ui;
    document.title = t().title;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t()[el.getAttribute('data-i18n')];
    });
    renderLines();
  }

  // Keep the "N lines, M need review" summary current.
  function updateSummary() {
    var flagged = state.cues.filter(function (c) { return c.needsReview; }).length;
    $('summary').textContent = state.cues.length ? t().summary(state.cues.length, flagged) : '';
  }

  // Build the list of editable lines from state.cues.
  function renderLines() {
    list.textContent = '';
    state.cues.forEach(function (cue, i) {
      var n = i + 1;
      var li = document.createElement('li');
      li.className = 'line' + (cue.needsReview ? ' flagged' : '');
      li.setAttribute('data-index', i);

      var head = document.createElement('div');
      head.className = 'line-head';

      var label = document.createElement('label');
      label.htmlFor = 'text-' + i;
      label.textContent = 'Line ' + n;

      var times = document.createElement('div');
      times.className = 'times';

      var startIn = document.createElement('input');
      startIn.type = 'text';
      startIn.className = 'time-input';
      startIn.value = EduVtt.formatTime(cue.start);
      startIn.setAttribute('data-act', 'start-time');
      startIn.setAttribute('aria-label', 'Start time for line ' + n);

      var arrow = document.createElement('span');
      arrow.textContent = '→';
      arrow.setAttribute('aria-hidden', 'true');

      var endIn = document.createElement('input');
      endIn.type = 'text';
      endIn.className = 'time-input';
      endIn.value = EduVtt.formatTime(cue.end);
      endIn.setAttribute('data-act', 'end-time');
      endIn.setAttribute('aria-label', 'End time for line ' + n);

      times.append(startIn, arrow, endIn);

      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'btn small';
      play.setAttribute('data-act', 'play');
      play.setAttribute('aria-label', t().playLineN(n));
      play.textContent = t().playLine;
      head.append(label, times, play);

      var ta = document.createElement('textarea');
      ta.id = 'text-' + i;
      ta.lang = state.capLang;
      ta.value = cue.text;

      var check = document.createElement('label');
      check.className = 'check';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = cue.needsReview;
      box.setAttribute('data-act', 'flag');
      box.setAttribute('aria-label', t().needsReviewN(n));
      check.append(box, document.createTextNode(t().needsReview));

      li.append(head, ta, check);
      list.append(li);
    });
    updateSummary();
  }

  // Save draft locally and to the backend if videoId is set.
  async function saveDraft(speak) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: state.name, capLang: state.capLang, cues: state.cues }));
      $('restore-btn').disabled = false;
    } catch (e) { /* storage full or blocked: editing still works */ }

    if (state.videoId && state.cues && state.cues.length) {
      try {
        var vttContent = EduVtt.serializeVtt(state.cues);
        var putUrl = '/api/videos/' + encodeURIComponent(state.videoId) + '/captions/' + encodeURIComponent(state.capLang);
        var res = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/vtt; charset=utf-8',
            'X-Studio-Key': getStudioKey()
          },
          body: vttContent
        });
        if (!res.ok) {
          var errData = await res.json().catch(function () { return {}; });
          throw new Error(errData.error || ('Server rejected captions (' + res.status + ')'));
        }
        showError('');
        if (speak) announce(t().saved + ' to server and local draft');
        return;
      } catch (err) {
        showError('Warning: Could not save to backend server (' + err.message + '). Saved to local draft.');
        if (speak) announce('Could not save to server. Saved to local draft.');
        return;
      }
    }

    if (speak) announce(t().saved);
  }

  // Wait a moment after typing stops, then save quietly.
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveDraft(false); }, 600);
  }

  // Put a parsed list of cues on screen and move focus to the lines heading.
  function showCues(cues, name) {
    if (!cues.length) { showError(t().errNoCues); return; }
    showError('');
    state.cues = cues;
    state.name = name;
    state.current = 0;
    renderLines();
    $('lines-heading').focus();
    announce(t().loaded(cues.length, name));
  }

  async function openFile(ev) {
    var file = ev.target.files[0];
    if (!file) return;
    showCues(EduVtt.parseVtt(await file.text()), file.name);
  }

  // Fetch a .vtt from a URL and show it. "failMsg" is the error text to use on failure.
  async function loadUrl(url, name, failMsg) {
    try {
      var res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      showCues(EduVtt.parseVtt(await res.text()), name);
    } catch (e) { showError(failMsg); }
  }

  function loadSample() { loadUrl('sample.en.vtt', 'sample.en.vtt', t().errSample); }

  function restoreDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (!d || !d.cues || !d.cues.length) return;
      state.capLang = d.capLang === 'am' ? 'am' : 'en';
      $('cap-lang').value = state.capLang;
      showCues(d.cues, d.name);
      announce(t().restored);
    } catch (e) { /* unreadable draft: ignore */ }
  }

  // Download the edited captions as a UTF-8 WebVTT file.
  function exportVtt() {
    if (!state.cues.length) { showError(t().errNothing); return; }
    showError('');
    var blob = new Blob([EduVtt.serializeVtt(state.cues)], { type: 'text/vtt;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = state.name.replace(/\.vtt$/i, '') + '.edited.vtt';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    var empty = state.cues.filter(function (c) { return !c.text.trim(); }).length;
    announce(empty ? t().exportedEmpty(empty) : t().exported);
  }

  // Play one line in the video, then pause at its end.
  function replay(i) {
    if (!video.src || video.hidden) { announce(t().noVideo); return; }
    var cue = state.cues[i];
    if (!cue) return;
    video.currentTime = cue.start;
    stopAt = cue.end;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  // Move focus to the text box of another line.
  function goToLine(i) {
    if (i < 0 || i >= state.cues.length) return;
    var ta = $('text-' + i);
    ta.focus();
    ta.scrollIntoView({ block: 'nearest' });
  }

  // Set or clear the "needs review" mark on a line.
  function setFlag(i, on) {
    var cue = state.cues[i];
    if (!cue) return;
    cue.needsReview = on;
    var li = list.children[i];
    li.classList.toggle('flagged', on);
    li.querySelector('input[data-act="flag"]').checked = on;
    updateSummary();
    saveDraft(false);
    announce(on ? t().flagged(i + 1) : t().unflagged(i + 1));
  }

  // List events (one listener for all lines).
  list.addEventListener('input', function (e) {
    if (e.target.tagName !== 'TEXTAREA') return;
    var i = Number(e.target.closest('li').getAttribute('data-index'));
    state.cues[i].text = e.target.value;
    saveSoon();
  });
  list.addEventListener('change', function (e) {
    var li = e.target.closest('li');
    if (!li) return;
    var i = Number(li.getAttribute('data-index'));
    var cue = state.cues[i];
    if (!cue) return;

    if (e.target.getAttribute('data-act') === 'start-time') {
      var pStart = EduVtt.parseTime(e.target.value);
      cue.start = pStart;
      e.target.value = EduVtt.formatTime(pStart);
      saveDraft(false);
    } else if (e.target.getAttribute('data-act') === 'end-time') {
      var pEnd = EduVtt.parseTime(e.target.value);
      cue.end = pEnd;
      e.target.value = EduVtt.formatTime(pEnd);
      saveDraft(false);
    } else if (e.target.tagName === 'TEXTAREA') {
      saveDraft(true);
    } else if (e.target.getAttribute('data-act') === 'flag') {
      setFlag(i, e.target.checked);
    }
  });
  list.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act="play"]');
    if (btn) replay(Number(btn.closest('li').getAttribute('data-index')));
  });
  list.addEventListener('focusin', function (e) {
    var li = e.target.closest('li');
    if (li) state.current = Number(li.getAttribute('data-index'));
  });

  // Keyboard shortcuts. Each one also has a button on the page.
  document.addEventListener('keydown', function (e) {
    var key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); saveDraft(true); return; }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (key === 'arrowdown') { e.preventDefault(); goToLine(state.current + 1); }
    else if (key === 'arrowup') { e.preventDefault(); goToLine(state.current - 1); }
    else if (key === 'r') { e.preventDefault(); replay(state.current); }
    else if (key === 'f') { e.preventDefault(); setFlag(state.current, !(state.cues[state.current] || {}).needsReview); }
  });

  // Stop playback at the end of the replayed line.
  video.addEventListener('timeupdate', function () {
    if (stopAt !== null && video.currentTime >= stopAt) { video.pause(); stopAt = null; }
  });
  video.addEventListener('pause', function () { stopAt = null; });

  $('vtt-input').addEventListener('change', openFile);
  $('sample-btn').addEventListener('click', loadSample);
  $('restore-btn').addEventListener('click', restoreDraft);
  $('save-btn').addEventListener('click', function () { saveDraft(true); });
  $('export-btn').addEventListener('click', exportVtt);
  $('help-btn').addEventListener('click', function () { $('help-dialog').showModal(); });
  $('help-close').addEventListener('click', function () { $('help-dialog').close(); });
  $('video-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    video.src = URL.createObjectURL(file);
    video.hidden = false;
  });
  $('ui-lang').addEventListener('change', function (e) { state.ui = e.target.value; applyText(); });
  $('cap-lang').addEventListener('change', function (e) {
    state.capLang = e.target.value;
    list.querySelectorAll('textarea').forEach(function (ta) { ta.lang = state.capLang; });
  });

  // Start: enable "Restore" only when a draft exists.
  try { $('restore-btn').disabled = !localStorage.getItem(DRAFT_KEY); } catch (e) { /* blocked */ }
  applyText();

  // Studio link: editor/index.html?id=123&lang=am&video=/url/to/video.mp4&src=/path/to/file.vtt opens that file directly.
  var params = new URLSearchParams(location.search);
  var videoId = params.get('id');
  if (videoId) {
    state.videoId = videoId;
  }
  if (params.get('lang') === 'am') {
    state.capLang = 'am';
    $('cap-lang').value = 'am';
  }
  if (params.get('video')) {
    video.src = params.get('video');
    video.hidden = false;
  }
  if (params.get('src')) {
    var src = params.get('src');
    loadUrl(src, src.split('/').pop() || 'captions.vtt', t().errLoad);
  } else if (videoId) {
    loadUrl('/api/videos/' + encodeURIComponent(videoId) + '/captions/' + encodeURIComponent(state.capLang), videoId + '_' + state.capLang + '.vtt', t().errLoad);
  }
})();
