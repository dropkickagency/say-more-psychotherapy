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
        var path = elementPath(el);
        var existing = patches.get(path);
        var origSnapshot = existing ? existing.original : original;  // never lose the first-ever original
        patches.set(path, { element_type: "text", new_content: el.innerHTML, original: origSnapshot });
        pushHistory({ element_path: path, element_type: "text", prev: original, next: el.innerHTML, origSnapshot: origSnapshot });
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

  function uploadMedia(file) {
    return new Promise(function (resolve, reject) {
      if (file.size > 8 * 1024 * 1024) return reject(new Error("File too large (max 8 MB — videos max 4 MB)"));
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

  //---------- Section-level controls (dynamic pages only) ----------
  // Server-side renderer wraps every section in
  //   <div class="sm-section" data-section-index="N">…</div>
  // and sets window.__SM_DYNAMIC_PAGE__ = true. Only under those flags
  // do we show the "+" inserters and the hover toolbar.
  function decorateSections() {
    if (!window.__SM_DYNAMIC_PAGE__) return;
    var sections = Array.from(document.querySelectorAll("main > .sm-section, main .sm-section"));
    // Hover toolbar per section
    sections.forEach(function (sec) {
      if (sec.querySelector(":scope > .sm-section-toolbar")) return;
      var idx = Number(sec.getAttribute("data-section-index"));
      var last = idx === sections.length - 1;
      var first = idx === 0;
      var bar = document.createElement("div");
      bar.className = "sm-section-toolbar";
      bar.innerHTML =
        (first ? '' : '<button type="button" data-a="up"        title="Move up">↑</button>') +
        (last  ? '' : '<button type="button" data-a="down"      title="Move down">↓</button>') +
                     '<button type="button" data-a="duplicate" title="Duplicate">⧉</button>' +
                     '<button type="button" data-a="delete" class="is-danger" title="Delete section">✕</button>';
      bar.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var action = b.dataset.a;
          if (action === "delete" && !confirm("Delete this section?")) return;
          post({ type: "sm-section-action", action: action, index: idx });
        });
      });
      sec.appendChild(bar);
    });
    // Inserter buttons: one at the top, one after each section
    function addInserter(refNode, insertBefore, index) {
      if (!refNode || !refNode.parentNode) return;
      var host = document.createElement("div");
      host.className = "sm-section-inserter";
      // Empty button — CSS ::before renders the "+" so hover styling stays in one place.
      host.innerHTML = '<button type="button" aria-label="Add section"></button>';
      host.querySelector("button").addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        post({ type: "sm-open-section-picker", index: index });
      });
      refNode.parentNode.insertBefore(host, insertBefore ? refNode : refNode.nextSibling);
    }
    var main = document.querySelector("main");
    if (main && sections.length === 0) {
      // Empty page — one big inserter
      addInserter(main.firstChild || main, true, 0);
    } else if (main) {
      addInserter(sections[0], true, 0);          // above the first
      sections.forEach(function (sec, i) { addInserter(sec, false, i + 1); });
    }
  }

  // Star-colour picker for testimonial sections (dynamic pages only).
  // Adds a small floating "★ Colour" chip on any .sm-testimonial-section;
  // click opens a 6-swatch palette. Selection posts a
  // `sm-section-action / update-content` message to the parent, which
  // patches the section's content.star_color and reloads the iframe.
  var STAR_COLOURS = [
    { label: "Brown",  value: "#9B7045" },
    { label: "Gold",   value: "#D4A64A" },
    { label: "Red",    value: "#B23A3A" },
    { label: "Green",  value: "#5F7C4F" },
    { label: "Blue",   value: "#4A6D8C" },
    { label: "Black",  value: "#141110" },
  ];
  function decorateTestimonials() {
    if (!window.__SM_DYNAMIC_PAGE__) return;
    document.querySelectorAll(".sm-section .sm-testimonial-section").forEach(function (sec) {
      if (sec.dataset.smStarChip === "1") return;
      sec.dataset.smStarChip = "1";
      var wrapper = sec.closest(".sm-section");
      var index = wrapper ? Number(wrapper.getAttribute("data-section-index")) : null;
      if (index == null) return;

      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sm-star-chip";
      chip.innerHTML = '★ <span>Star colour</span>';
      var palette = document.createElement("div");
      palette.className = "sm-star-palette";
      palette.innerHTML = STAR_COLOURS.map(function (c) {
        return '<button type="button" class="sm-star-swatch" data-c="' + c.value + '" style="background:' + c.value + '" title="' + c.label + '"></button>';
      }).join("");
      palette.style.display = "none";

      chip.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        palette.style.display = palette.style.display === "none" ? "flex" : "none";
      });
      palette.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-c]");
        if (!b) return;
        ev.preventDefault(); ev.stopPropagation();
        var color = b.getAttribute("data-c");
        palette.style.display = "none";
        // Update DOM immediately for feedback
        sec.querySelectorAll(".sm-testimonial-stars").forEach(function (s) { s.style.color = color; });
        // Persist through parent
        post({ type: "sm-section-action", action: "update-content", index: index, content: { star_color: color } });
      });
      document.addEventListener("click", function () { palette.style.display = "none"; });

      // Position chip in the section's top-left; palette anchored under it.
      var slot = document.createElement("div");
      slot.className = "sm-star-slot";
      slot.appendChild(chip);
      slot.appendChild(palette);
      sec.style.position = sec.style.position || "relative";
      sec.appendChild(slot);
    });
  }

  // FAQ sections use <details>/<summary> which native-toggle on click.
  // In edit mode we want every Q and A visible + editable simultaneously,
  // so force every <details> open and swallow the summary click. Question
  // text (inside <span>) and answer text (inside <p>) then get picked up
  // by the normal text-editor click handler.
  function unlockFaqAccordions() {
    document.querySelectorAll("details").forEach(function (d) {
      d.setAttribute("open", "");
      d.addEventListener("toggle", function () {
        if (!d.open) d.setAttribute("open", "");
      });
    });
    document.querySelectorAll("summary").forEach(function (s) {
      s.addEventListener("click", function (ev) { ev.preventDefault(); });
    });
  }

  //---------- Boot ----------
  async function boot() {
    document.documentElement.classList.add("sm-edit-mode");
    neuteriseLinks();
    await applyExistingPatches();
    unlockFaqAccordions();
    attachTextEditors();
    attachImageEditors();
    attachVideoEditors();
    attachBackgroundEditors();
    decorateSections();
    decorateTestimonials();
    buildToolbar();
    post({ type: "sm-edit-ready" });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
