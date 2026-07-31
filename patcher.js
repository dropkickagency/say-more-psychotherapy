/*
 * Say More content patcher.
 *
 * Loaded from <head> on every public page. Runs before body renders so
 * admin edits appear on the first paint (no flash of old content).
 * Also auto-syncs "twin" elements at runtime — if the DOM contains
 * duplicate copies of the same original (typical: desktop nav + mobile
 * drawer), the patch applies to all of them, even for edits saved
 * before the twin-aware editor shipped.
 */
(function () {
  try {
    var path = location.pathname;
    if (/^\/admin(\/|$)/.test(path)) return;
    if (new URLSearchParams(location.search).get("edit") === "1") return;

    // Hide the page while we fetch patches so visitors never see the
    // pre-patched content flash before it swaps.
    var styleEl = document.createElement("style");
    styleEl.textContent = "html.sm-loading{visibility:hidden}";
    (document.head || document.documentElement).appendChild(styleEl);
    document.documentElement.classList.add("sm-loading");

    var revealed = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      try { document.documentElement.classList.remove("sm-loading"); } catch (e) {}
    }
    // Failsafe: never leave the page hidden if the API is slow / down.
    setTimeout(reveal, 800);

    // Strip editor-only decorations (sm-* helper classes, contenteditable
    // attributes) that legacy patches captured. Cosmetic on live pages, but
    // keeps the served DOM clean.
    function cleanEditorMarkup(html) {
      if (html == null) return html;
      return String(html)
        .replace(/\s+class="([^"]*)"/g, function (m, classes) {
          var kept = classes.split(/\s+/).filter(function (c) {
            return c && c.indexOf("sm-") !== 0;
          });
          return kept.length ? ' class="' + kept.join(" ") + '"' : "";
        })
        .replace(/\s+contenteditable="[^"]*"/g, "");
    }

    function applyOne(el, type, content) {
      // Never overwrite with an empty/null value — that would just blank the image/video.
      if (content == null || content === "") return;
      try {
        if (type === "image") {
          if (el.tagName === "IMG") el.setAttribute("src", content);
        } else if (type === "video") {
          if (el.tagName === "VIDEO") {
            el.querySelectorAll("source").forEach(function (s) { s.remove(); });
            el.setAttribute("src", content);
            try { el.load(); } catch (_) {}
          }
        } else if (type === "bg-image") {
          el.style.backgroundImage = 'url("' + content + '")';
        } else if (type === "href") {
          el.setAttribute("href", content);
        } else {
          el.innerHTML = cleanEditorMarkup(content);
        }
      } catch (e) {}
    }

    function tagFromPath(p) {
      var m = String(p || "").match(/([a-z0-9]+):nth-of-type\(\d+\)$/i);
      return m ? m[1] : null;
    }

    function currentValueForCompare(el, type) {
      if (type === "image") return el.getAttribute("src");
      if (type === "video") {
        return el.getAttribute("src") ||
               (el.querySelector("source") && el.querySelector("source").getAttribute("src"));
      }
      if (type === "bg-image") return null; // skip fuzzy bg matching
      return (el.innerHTML || "").trim();
    }

    function applyPatches(patches) {
      patches.forEach(function (p) {
        try {
          var type = p.element_type || "text";
          var el = document.querySelector(p.element_path);

          // Drift-safety for TEXT primary target: skip if the current HTML
          // has drifted from the captured original (a code deploy changed
          // the surrounding markup).
          if (el && type === "text") {
            if (p.original && el.innerHTML.trim() !== String(p.original).trim()) {
              // Primary drifted — don't stomp on new site content
            } else {
              applyOne(el, type, p.new_content);
            }
          } else if (el) {
            applyOne(el, type, p.new_content);
          }

          // Twin sync: for text/image/video, find OTHER elements on the
          // page whose current value matches the patch's original. This
          // catches desktop/mobile duplicates even if the patch was saved
          // before the twin-aware editor shipped.
          if (!p.original || type === "bg-image" || type === "href") return;
          var tag = tagFromPath(p.element_path);
          if (!tag) return;
          var origRaw = p.original;
          var origTrim = String(origRaw).trim();
          var candidates = document.querySelectorAll(tag);
          for (var i = 0; i < candidates.length; i++) {
            var other = candidates[i];
            if (other === el) continue;
            var cur = currentValueForCompare(other, type);
            if (cur == null) continue;
            if (cur === origRaw || cur === origTrim) {
              applyOne(other, type, p.new_content);
            }
          }
        } catch (e) {}
      });
    }

    var url = "/api/edits?path=" + encodeURIComponent(path);
    fetch(url, { cache: "no-store", credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var patches = (d && d.patches) || [];
        if (patches.length === 0) { reveal(); return; }
        // Wait for DOM ready before applying so querySelector can find things.
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", function () {
            applyPatches(patches);
            reveal();
          });
        } else {
          applyPatches(patches);
          reveal();
        }
      })
      .catch(reveal);
  } catch (e) {
    try { document.documentElement.classList.remove("sm-loading"); } catch (_) {}
  }
})();
