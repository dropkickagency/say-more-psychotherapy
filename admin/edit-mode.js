// Injected into public pages when they're loaded in an iframe with ?edit=1
// (via the /admin/website.html editor). Turns text elements into click-to-edit
// spots, images into click-to-replace, and posts changes back to /api/admin/edits.

(function () {
  var qs = new URLSearchParams(window.location.search);
  if (qs.get("edit") !== "1") return;
  // Only run inside an iframe — random visitors landing on ?edit=1 don't get
  // an editor UI. Combined with cookie-based API auth this is safe enough.
  try { if (window.top === window.self) return; } catch (e) { /* cross-origin means we're framed */ }

  // Freeze content-patch fetch (script.js) — we don't want patches applied
  // on top of the raw HTML while editing, or the "original" snapshot would
  // capture already-patched content.
  window.__SM_SKIP_PATCH__ = true;

  var TEXT_TAGS = "h1, h2, h3, h4, h5, h6, p, li, a, span, blockquote, em, strong";
  var patches = new Map(); // element_path -> { element_type, new_content, original }

  //---------- Utils ----------

  // Build a stable-ish CSS selector for an element (body>tag:nth-of-type(n)>...)
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
    if (el.tagName === "TIME") return false;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return false;
    // Only leaf-ish text (no child element other than inline)
    var childElements = el.querySelectorAll("*");
    for (var i = 0; i < childElements.length; i++) {
      var t = childElements[i].tagName;
      if (t === "IMG" || t === "SVG" || t === "IFRAME" || t === "VIDEO") return false;
    }
    return true;
  }

  function markDirty() {
    postToParent({ type: "sm-edit-dirty", count: patches.size });
    updateToolbar();
  }

  function postToParent(msg) {
    try { window.parent.postMessage(msg, "*"); } catch (e) {}
  }

  //---------- Editor toolbar (inside iframe) ----------

  var toolbar, statusEl, saveBtn, discardBtn;
  function buildToolbar() {
    toolbar = document.createElement("div");
    toolbar.className = "sm-edit-toolbar";
    toolbar.innerHTML =
      '<div class="sm-edit-toolbar__inner">' +
        '<div class="sm-edit-toolbar__pill">' +
          '<span class="sm-edit-toolbar__dot"></span>' +
          '<span>Editing this page</span>' +
        '</div>' +
        '<div class="sm-edit-toolbar__hint" id="sm-edit-status">Click any text or image to edit it</div>' +
        '<div class="sm-edit-toolbar__actions">' +
          '<button type="button" id="sm-edit-discard">Discard</button>' +
          '<button type="button" id="sm-edit-save">Save changes</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(toolbar);
    statusEl = document.getElementById("sm-edit-status");
    saveBtn = document.getElementById("sm-edit-save");
    discardBtn = document.getElementById("sm-edit-discard");
    saveBtn.addEventListener("click", saveAll);
    discardBtn.addEventListener("click", function () {
      if (patches.size === 0) return;
      if (!confirm("Discard " + patches.size + " unsaved change" + (patches.size === 1 ? "" : "s") + "?")) return;
      window.location.reload();
    });
    updateToolbar();
  }
  function updateToolbar() {
    if (!statusEl || !saveBtn) return;
    var n = patches.size;
    statusEl.textContent = n === 0
      ? "Click any text or image to edit it"
      : n + " unsaved change" + (n === 1 ? "" : "s");
    saveBtn.disabled = n === 0;
    saveBtn.classList.toggle("is-primary", n > 0);
  }

  //---------- Save flow ----------

  async function saveAll() {
    if (patches.size === 0) return;
    saveBtn.disabled = true;
    var orig = saveBtn.textContent;
    saveBtn.textContent = "Saving…";
    var payload = {
      page_path: window.location.pathname,
      patches: [],
    };
    patches.forEach(function (p, key) {
      payload.patches.push({
        element_path: key,
        element_type: p.element_type,
        new_content: p.new_content,
        original: p.original,
      });
    });
    try {
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
      flashToolbar("Saved. Changes are live on the website.");
      postToParent({ type: "sm-edit-saved", saved: json.saved });
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = orig;
    }
  }

  function flashToolbar(msg) {
    statusEl.textContent = msg;
    setTimeout(updateToolbar, 3000);
  }

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

    // Select all text on enter
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function finish() {
      el.setAttribute("contenteditable", "false");
      el.classList.remove("sm-editing");
      if (el.innerHTML !== original) {
        var key = elementPath(el);
        patches.set(key, {
          element_type: "text",
          new_content: el.innerHTML,
          original: original,
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
      img.classList.add("sm-editable-image");
      img.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        startImageReplace(img);
      });
    });
  }

  function startImageReplace(img) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async function () {
      var file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      var wasSrc = img.getAttribute("src");
      img.classList.add("sm-uploading");
      try {
        var url = await uploadImage(file);
        img.setAttribute("src", url);
        img.classList.remove("sm-uploading");
        var key = elementPath(img);
        patches.set(key, {
          element_type: "image",
          new_content: url,
          original: wasSrc,
        });
        markDirty();
      } catch (err) {
        img.classList.remove("sm-uploading");
        alert("Upload failed: " + err.message);
      }
    };
    input.click();
  }

  function uploadImage(file) {
    return new Promise(function (resolve, reject) {
      if (file.size > 8 * 1024 * 1024) return reject(new Error("Image too large (max 8 MB)"));
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
      reader.onerror = function () { reject(new Error("Could not read image file")); };
      reader.readAsDataURL(file);
    });
  }

  //---------- Prevent all page navigation while editing ----------
  function neuteriseLinks() {
    document.body.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a");
      if (a && !a.closest(".sm-edit-toolbar")) { e.preventDefault(); }
    }, true);
    document.body.addEventListener("submit", function (e) { e.preventDefault(); }, true);
  }

  //---------- Boot ----------
  function boot() {
    // Notify parent that the editor is live
    postToParent({ type: "sm-edit-ready" });
    document.documentElement.classList.add("sm-edit-mode");
    neuteriseLinks();
    attachTextEditors();
    attachImageEditors();
    buildToolbar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
