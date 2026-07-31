// Injected into public pages when they load in an iframe with ?edit=1
// (via /admin/website.html). Handles click-to-edit for text, images,
// videos, and section background images. Save/Publish buttons live in
// the PARENT admin bar — the parent posts messages here, this file
// collects patches and POSTs them.

(function () {
  var qs = new URLSearchParams(window.location.search);
  if (qs.get("edit") !== "1") return;
  try { if (window.top === window.self) return; } catch (e) {}

  var TEXT_TAGS = "h1, h2, h3, h4, h5, h6, p, li, a, span, blockquote, em, strong";
  var patches = new Map(); // element_path -> { element_type, new_content, original }
  var history = [];        // stack of { element_path, element_type, prev, next } — undo pops from the end

  //---------- Utils ----------
  function elementPath(el) {
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && cur.parentElement) {
      var parent = cur.parentElement;
      var tag = cur.tagName.toLowerCase();
      var siblings = [];
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i].tagName === cur.tagName) siblings.push(parent.children[i]);
      }
      var idx = siblings.indexOf(cur) + 1;
      parts.unshift(tag + ":nth-of-type(" + idx + ")");
      cur = parent;
    }
    return "body > " + parts.join(" > ");
  }

  function isEditableText(el) {
    if (!el) return false;
    if (el.closest(".sm-edit-toolbar")) return false;
    if (el.closest(".form__honeypot")) return false;
    if (el.closest("form")) return false;
    if (el.closest(".nav__toggle")) return false;
    if (el.tagName === "TIME" || el.tagName === "SCRIPT" || el.tagName === "STYLE") return false;
    var childElements = el.querySelectorAll("*");
    for (var i = 0; i < childElements.length; i++) {
      var t = childElements[i].tagName;
      if (t === "IMG" || t === "SVG" || t === "IFRAME" || t === "VIDEO") return false;
    }
    return true;
  }

  function post(msg) { try { window.parent.postMessage(msg, "*"); } catch (e) {} }

  // Find "twin" elements on the page — same tag AND same current text content
  // as `el`. This catches desktop/mobile duplicates like the site's separate
  // .nav__links and .nav__mobile__links copies of the same nav items, so an
  // edit on desktop also updates the mobile drawer.
  function findTextTwins(el, matchText) {
    var out = [];
    if (!el || !matchText) return out;
    var wanted = String(matchText).trim();
    if (!wanted) return out;
    var candidates = document.querySelectorAll(el.tagName.toLowerCase());
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c === el) continue;
      if (c.closest(".sm-edit-toolbar")) continue;
      if ((c.innerHTML || "").trim() === wanted) out.push(c);
    }
    return out;
  }
  function findAttrTwins(el, attr, matchValue) {
    var out = [];
    if (!el || !matchValue) return out;
    var candidates = document.querySelectorAll(el.tagName.toLowerCase() + "[" + attr + "]");
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c === el) continue;
      if (c.closest(".sm-edit-toolbar")) continue;
      if (c.getAttribute(attr) === matchValue) out.push(c);
    }
    return out;
  }

  function markDirty() {
    post({ type: "sm-edit-dirty", count: patches.size, history: history.length });
    updateToolbar();
  }

  // Push a history entry. `prev` is the state before this edit; `next`
  // is the state after. Undo restores prev.
  function pushHistory(entry) {
    history.push(entry);
    if (history.length > 200) history.shift();  // cap memory
    console.log("[sm-edit] history +1 (" + entry.element_type + " @ " + entry.element_path + ") — total " + history.length);
  }

  // Apply a state to an element based on its type — used by both the
  // initial edits and by undo. Handles null/empty defensively so undo
  // never leaves an img/video with src="null".
  function applyState(el, type, value) {
    try {
      if (type === "text") {
        el.innerHTML = value == null ? "" : value;
      } else if (type === "image") {
        if (value == null || value === "") el.removeAttribute("src");
        else el.setAttribute("src", value);
      } else if (type === "video") {
        el.querySelectorAll("source").forEach(function (s) { s.remove(); });
        if (value == null || value === "") el.removeAttribute("src");
        else el.setAttribute("src", value);
        try { el.load(); } catch (e) {}
      } else if (type === "bg-image") {
        // bg entries store the whole CSS backgroundImage value (e.g. url("...") or "none")
        el.style.backgroundImage = (value == null || value === "none" || value === "") ? "" : value;
      }
    } catch (e) {
      console.warn("[sm-edit] applyState failed", { type: type, value: value, err: e && e.message });
    }
  }

  // Undo the most recent edit.
  function undoOnce() {
    if (history.length === 0) {
      console.log("[sm-edit] undoOnce called but history is empty");
      return false;
    }
    var entry;
    var el;
    try {
      entry = history.pop();
      console.log("[sm-edit] undo popped:", {
        path: entry.element_path,
        type: entry.element_type,
        prevSample: String(entry.prev).slice(0, 60),
      });
      el = document.querySelector(entry.element_path);
      if (!el) {
        console.warn("[sm-edit] undo: element not found for path", entry.element_path);
        // History is out of sync with DOM — still notify parent so the button
        // state stays accurate.
        markDirty();
        return true;
      }

      applyState(el, entry.element_type, entry.prev);

      // Find the most recent remaining history entry for this same element.
      // If one exists, that's the state the patch should now hold.
      var still = null;
      for (var i = history.length - 1; i >= 0; i--) {
        if (history[i].element_path === entry.element_path) { still = history[i]; break; }
      }
      if (still) {
        patches.set(entry.element_path, {
          element_type: still.element_type,
          new_content: still.next,
          original: still.origSnapshot != null ? still.origSnapshot : entry.origSnapshot,
        });
        // If prev doesn't equal still.next, we need to re-apply still.next
        if (String(still.next) !== String(entry.prev)) {
          applyState(el, still.element_type, still.next);
        }
      } else {
        // No prior edits — element is back to its original state; remove patch
        patches.delete(entry.element_path);
      }
      markDirty();
      return true;
    } catch (err) {
      console.error("[sm-edit] undoOnce threw", err);
      // Put the entry back so a retry can succeed
      if (entry) history.push(entry);
      markDirty();
      return false;
    }
  }

  //---------- Small in-iframe status pill (no action buttons anymore) ----------
  var toolbar, statusEl;
  function buildToolbar() {
    toolbar = document.createElement("div");
    toolbar.className = "sm-edit-toolbar";
    toolbar.innerHTML =
      '<div class="sm-edit-toolbar__inner">' +
        '<div class="sm-edit-toolbar__pill">' +
          '<span class="sm-edit-toolbar__dot"></span>' +
          '<span>Editing this page</span>' +
        '</div>' +
        '<div class="sm-edit-toolbar__hint" id="sm-edit-status">Click text, images, videos, or sections to edit</div>' +
        '<div class="sm-edit-toolbar__spacer"></div>' +
      '</div>';
    document.body.appendChild(toolbar);
    statusEl = document.getElementById("sm-edit-status");
    updateToolbar();
  }
  function updateToolbar() {
    if (!statusEl) return;
    var n = patches.size;
    statusEl.textContent = n === 0
      ? "Click text, images, videos, or sections to edit"
      : n + " unsaved change" + (n === 1 ? "" : "s") + " — use Save or Publish above";
  }

  //---------- Save handled via parent postMessage ----------
  async function saveAll(publish) {
    if (patches.size === 0 && !publish) return { ok: true, saved: 0 };
    var payload = { page_path: window.location.pathname, patches: [], publish: !!publish };
    if (publish) payload.publish_all = true;
    patches.forEach(function (p, key) {
      payload.patches.push({
        element_path: key,
        element_type: p.element_type,
        new_content: p.new_content,
        original: p.original,
      });
    });
    var res = await fetch("/api/admin/edits", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    var json = await res.json();
    if (!res.ok) throw new Error((json && json.error) || "Save failed");
    patches.clear();
    updateToolbar();
    return json;
  }

  window.addEventListener("message", async function (e) {
    var msg = e.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type && msg.type.indexOf("sm-edit-") === 0) {
      console.log("[sm-edit] message received:", msg.type);
    }

    if (msg.type === "sm-edit-save") {
      try {
        var r = await saveAll(false);
        post({ type: "sm-edit-saved", saved: r.saved || 0, published: false });
      } catch (err) { post({ type: "sm-edit-error", error: err.message }); }
    }
    if (msg.type === "sm-edit-publish") {
      try {
        var r2 = await saveAll(true);
        post({ type: "sm-edit-saved", saved: r2.saved || 0, promoted: r2.promoted || 0, published: true });
      } catch (err) { post({ type: "sm-edit-error", error: err.message }); }
    }
    if (msg.type === "sm-edit-discard") {
      if (patches.size === 0) return;
      window.location.reload();
    }
    if (msg.type === "sm-edit-undo") {
      console.log("[sm-edit] received sm-edit-undo (history=" + history.length + ", patches=" + patches.size + ")");
      undoOnce();
    }
  });

  // Ctrl/Cmd + Z inside the iframe → undo. Mirrors the parent handler so it
  // works whether the user's focus is in the iframe or the admin toolbar.
  window.addEventListener("keydown", function (e) {
    var mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
      // Don't hijack Ctrl+Z inside a contentEditable — let the browser do its
      // own text-level undo first. If nothing to undo there, use ours.
      var ae = document.activeElement;
      if (ae && (ae.getAttribute("contenteditable") === "true" || ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;
      if (history.length === 0) return;
      e.preventDefault();
      undoOnce();
    }
  });

  //---------- Text editing ----------
  function attachTextEditors() {
    document.querySelectorAll(TEXT_TAGS).forEach(function (el) {
      if (!isEditableText(el)) return;
      el.classList.add("sm-editable-text");
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (el.getAttribute("contenteditable") === "true") return;
        startTextEdit(el);
      });
    });
  }
  function startTextEdit(el) {
    var original = el.innerHTML;
    el.setAttribute("contenteditable", "true");
    el.classList.add("sm-editing");
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    function finish() {
      el.setAttribute("contenteditable", "false");
      el.classList.remove("sm-editing");
      if (el.innerHTML !== original) {
        var newHtml = el.innerHTML;
        var path = elementPath(el);
        var existing = patches.get(path);
        var origSnapshot = existing ? existing.original : original;
        patches.set(path, { element_type: "text", new_content: newHtml, original: origSnapshot });
        pushHistory({ element_path: path, element_type: "text", prev: original, next: newHtml, origSnapshot: origSnapshot });

        // Sync mobile-twin elements (identical tag + identical current text).
        // This handles the desktop-nav / mobile-drawer duplication.
        var twins = findTextTwins(el, original);
        twins.forEach(function (t) {
          try {
            var tPath = elementPath(t);
            var tOrig = t.innerHTML;
            t.innerHTML = newHtml;
            var tExisting = patches.get(tPath);
            var tOrigSnap = tExisting ? tExisting.original : tOrig;
            patches.set(tPath, { element_type: "text", new_content: newHtml, original: tOrigSnap });
            pushHistory({ element_path: tPath, element_type: "text", prev: tOrig, next: newHtml, origSnapshot: tOrigSnap });
          } catch (e) {}
        });

        markDirty();
      }
      el.removeEventListener("blur", finish);
      el.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); el.innerHTML = original; finish(); }
      if (e.key === "Enter" && !e.shiftKey && el.tagName !== "P") { e.preventDefault(); el.blur(); }
    }
    el.addEventListener("blur", finish);
    el.addEventListener("keydown", onKey);
  }

  //---------- Image editing ----------
  function attachImageEditors() {
    document.querySelectorAll("img").forEach(function (img) {
      if (img.closest(".sm-edit-toolbar")) return;
      if (img.closest(".sm-bg-edit-chip") || img.closest(".sm-video-edit-btn")) return;
      // Skip tiny icons (favicons in the SVG blob, small brand marks, etc.)
      var w = img.naturalWidth || img.width || 0;
      var h = img.naturalHeight || img.height || 0;
      var isTiny = w > 0 && h > 0 && w < 60 && h < 60;
      img.classList.add("sm-editable-image");
      img.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        pickFile("image/*", function (file) { replaceMedia(img, file, "src"); });
      });
      if (isTiny) return;  // don't attach the overlay pill to tiny logos/icons

      var overlay = document.createElement("button");
      overlay.type = "button";
      overlay.className = "sm-image-edit-btn";
      overlay.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Replace image</span>';
      overlay.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        pickFile("image/*", function (file) { replaceMedia(img, file, "src"); });
      });
      var parent = img.parentElement;
      if (parent && getComputedStyle(parent).position === "static") parent.style.position = "relative";
      if (parent) parent.appendChild(overlay);
    });
  }

  //---------- Video editing ----------
  function attachVideoEditors() {
    document.querySelectorAll("video").forEach(function (video) {
      if (video.closest(".sm-edit-toolbar")) return;
      video.classList.add("sm-editable-video");
      // Wrapper for click intercept (video's built-in controls swallow clicks otherwise)
      var overlay = document.createElement("button");
      overlay.type = "button";
      overlay.className = "sm-video-edit-btn";
      overlay.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Replace video</span>';
      overlay.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        pickFile("video/*", function (file) { replaceVideo(video, file); });
      });
      var parent = video.parentElement;
      if (parent && getComputedStyle(parent).position === "static") parent.style.position = "relative";
      if (parent) parent.appendChild(overlay);
    });
  }

  function replaceVideo(video, file) {
    var wasSrc = video.getAttribute("src") || (video.querySelector("source") && video.querySelector("source").getAttribute("src"));
    video.classList.add("sm-uploading");
    uploadMedia(file).then(function (url) {
      // Clear any <source> children so the new src wins
      var sources = video.querySelectorAll("source");
      sources.forEach(function (s) { s.remove(); });
      video.setAttribute("src", url);
      try { video.load(); video.play().catch(function () {}); } catch (e) {}
      video.classList.remove("sm-uploading");
      var path = elementPath(video);
      var existing = patches.get(path);
      var origSnapshot = existing ? existing.original : wasSrc;
      patches.set(path, { element_type: "video", new_content: url, original: origSnapshot });
      pushHistory({ element_path: path, element_type: "video", prev: wasSrc, next: url, origSnapshot: origSnapshot });

      // Sync mobile/desktop video twins pointing at the same original src
      if (wasSrc) {
        findAttrTwins(video, "src", wasSrc).forEach(function (t) {
          try {
            var tPath = elementPath(t);
            var tOrigAttr = t.getAttribute("src");
            t.querySelectorAll("source").forEach(function (s) { s.remove(); });
            t.setAttribute("src", url);
            try { t.load(); } catch (e) {}
            var tExisting = patches.get(tPath);
            var tOrigSnap = tExisting ? tExisting.original : tOrigAttr;
            patches.set(tPath, { element_type: "video", new_content: url, original: tOrigSnap });
            pushHistory({ element_path: tPath, element_type: "video", prev: tOrigAttr, next: url, origSnapshot: tOrigSnap });
          } catch (e) {}
        });
      }

      markDirty();
    }).catch(function (err) {
      video.classList.remove("sm-uploading");
      alert("Video upload failed: " + err.message);
    });
  }

  function replaceMedia(el, file, attr) {
    var wasSrc = el.getAttribute(attr);
    el.classList.add("sm-uploading");
    uploadMedia(file).then(function (url) {
      el.setAttribute(attr, url);
      el.classList.remove("sm-uploading");
      var path = elementPath(el);
      var existing = patches.get(path);
      var origSnapshot = existing ? existing.original : wasSrc;
      patches.set(path, { element_type: "image", new_content: url, original: origSnapshot });
      pushHistory({ element_path: path, element_type: "image", prev: wasSrc, next: url, origSnapshot: origSnapshot });

      // Sync any other images on the page pointing at the same original src
      // (matches desktop/mobile duplicates of the same logo, avatar, etc.)
      if (wasSrc && attr === "src") {
        findAttrTwins(el, "src", wasSrc).forEach(function (t) {
          try {
            var tPath = elementPath(t);
            var tOrigAttr = t.getAttribute("src");
            t.setAttribute("src", url);
            var tExisting = patches.get(tPath);
            var tOrigSnap = tExisting ? tExisting.original : tOrigAttr;
            patches.set(tPath, { element_type: "image", new_content: url, original: tOrigSnap });
            pushHistory({ element_path: tPath, element_type: "image", prev: tOrigAttr, next: url, origSnapshot: tOrigSnap });
          } catch (e) {}
        });
      }

      markDirty();
    }).catch(function (err) {
      el.classList.remove("sm-uploading");
      alert("Upload failed: " + err.message);
    });
  }

  //---------- Section background image editing ----------
  function attachBackgroundEditors() {
    // Walk major container elements. Add an "edit background" chip
    // to anything with a real background-image (not gradient).
    var candidates = document.querySelectorAll("section, header, aside, .hero, .cta, .foot, div[class*='hero'], div[class*='cta'], div[class*='bg']");
    candidates.forEach(function (el) {
      if (el.closest(".sm-edit-toolbar")) return;
      var cs = getComputedStyle(el);
      var bg = cs.backgroundImage;
      if (!bg || bg === "none" || bg.indexOf("url(") === -1) return;
      el.classList.add("sm-editable-bg");
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sm-bg-edit-chip";
      chip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Change background</span>';
      chip.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        pickFile("image/*", function (file) { replaceBackground(el, file); });
      });
      el.appendChild(chip);
    });
  }

  function replaceBackground(el, file) {
    var was = getComputedStyle(el).backgroundImage;   // full CSS value, e.g. url("/x.jpg") or none
    el.classList.add("sm-uploading");
    uploadMedia(file).then(function (url) {
      var nextCss = 'url("' + url + '")';
      el.style.backgroundImage = nextCss;
      el.classList.remove("sm-uploading");
      var path = elementPath(el);
      var existing = patches.get(path);
      var origSnapshot = existing ? existing.original : was;
      patches.set(path, { element_type: "bg-image", new_content: url, original: origSnapshot });
      pushHistory({ element_path: path, element_type: "bg-image", prev: was, next: nextCss, origSnapshot: origSnapshot });
      markDirty();
    }).catch(function (err) {
      el.classList.remove("sm-uploading");
      alert("Background upload failed: " + err.message);
    });
  }

  //---------- Shared upload + file picker ----------
  function pickFile(accept, cb) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = function () {
      var file = input.files && input.files[0];
      input.remove();
      if (file) cb(file);
    };
    input.click();
  }

  // Upload strategy:
  // - Files <= 3 MB: base64 through /api/admin/upload-image (simple, one hop).
  // - Files >  3 MB: client-side direct upload to Vercel Blob via
  //   /api/admin/upload-token. This bypasses the 4.5 MB serverless
  //   body limit and supports up to 500 MB.
  var _blobClientPromise = null;
  function loadBlobClient() {
    if (!_blobClientPromise) {
      _blobClientPromise = import("https://esm.sh/@vercel/blob@0.27.3/client")
        .catch(function () { return import("https://cdn.jsdelivr.net/npm/@vercel/blob@0.27.3/dist/client/index.mjs"); });
    }
    return _blobClientPromise;
  }

  async function uploadMediaLarge(file) {
    var mod = await loadBlobClient();
    var blob = await mod.upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/admin/upload-token",
      contentType: file.type,
    });
    return blob.url;
  }

  function uploadMediaSmall(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = async function (e) {
        var b64 = String(e.target.result || "").split(",")[1];
        try {
          var res = await fetch("/api/admin/upload-image", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, mime: file.type, data: b64 }),
          });
          var json = await res.json();
          if (!res.ok) return reject(new Error((json && json.error) || "Upload failed"));
          resolve(json.url);
        } catch (err) { reject(err); }
      };
      reader.onerror = function () { reject(new Error("Could not read file")); };
      reader.readAsDataURL(file);
    });
  }

  function uploadMedia(file) {
    // Practical ceilings — well above what a therapist would ever want to upload.
    var isVideo = /^video\//.test(file.type || "");
    var maxMb = isVideo ? 500 : 50;
    if (file.size > maxMb * 1024 * 1024) {
      return Promise.reject(new Error("File too large (max " + maxMb + " MB)"));
    }
    // Anything above 3 MB goes via client-direct upload
    if (file.size > 3 * 1024 * 1024) {
      return uploadMediaLarge(file).catch(function (err) {
        // If client-direct fails (e.g. Blob not configured), try the smaller
        // base64 path — will reject cleanly with the "Blob not configured"
        // message from the server for files that are also too big for base64.
        if (file.size <= 4 * 1024 * 1024) return uploadMediaSmall(file);
        throw err;
      });
    }
    return uploadMediaSmall(file);
  }

  //---------- Load existing patches so the editor sees the current state ----------
  async function applyExistingPatches() {
    try {
      var res = await fetch("/api/admin/edits?path=" + encodeURIComponent(window.location.pathname), {
        credentials: "same-origin",
      });
      var json = await res.json();
      (json.patches || []).forEach(function (p) {
        try {
          var el = document.querySelector(p.element_path);
          if (!el) return;
          if (p.element_type === "image") {
            if (el.tagName === "IMG") el.setAttribute("src", p.new_content);
          } else if (p.element_type === "video") {
            if (el.tagName === "VIDEO") {
              el.querySelectorAll("source").forEach(function (s) { s.remove(); });
              el.setAttribute("src", p.new_content);
              try { el.load(); } catch (e) {}
            }
          } else if (p.element_type === "bg-image") {
            el.style.backgroundImage = 'url("' + p.new_content + '")';
          } else {
            el.innerHTML = p.new_content;
          }
        } catch (e) {}
      });
    } catch (e) { /* silent */ }
  }

  //---------- Prevent navigation while editing ----------
  function neuteriseLinks() {
    document.body.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a");
      if (a && !a.closest(".sm-edit-toolbar") && !a.closest(".sm-bg-edit-chip")) e.preventDefault();
    }, true);
    document.body.addEventListener("submit", function (e) { e.preventDefault(); }, true);
  }

  //---------- Boot ----------
  async function boot() {
    document.documentElement.classList.add("sm-edit-mode");
    neuteriseLinks();
    await applyExistingPatches();
    attachTextEditors();
    attachImageEditors();
    attachVideoEditors();
    attachBackgroundEditors();
    buildToolbar();
    post({ type: "sm-edit-ready" });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
