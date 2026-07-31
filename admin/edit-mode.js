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
    post({ type: "sm-edit-dirty", count: patches.size });
    updateToolbar();
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
        patches.set(elementPath(el), { element_type: "text", new_content: el.innerHTML, original: original });
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
      img.classList.add("sm-editable-image");
      img.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        pickFile("image/*", function (file) { replaceMedia(img, file, "src"); });
      });
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
      patches.set(elementPath(video), { element_type: "video", new_content: url, original: wasSrc });
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
      patches.set(elementPath(el), { element_type: "image", new_content: url, original: wasSrc });
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
    var was = getComputedStyle(el).backgroundImage;
    el.classList.add("sm-uploading");
    uploadMedia(file).then(function (url) {
      el.style.backgroundImage = 'url("' + url + '")';
      el.classList.remove("sm-uploading");
      patches.set(elementPath(el), { element_type: "bg-image", new_content: url, original: was });
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
