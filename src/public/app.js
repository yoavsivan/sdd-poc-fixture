(function () {
  "use strict";

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function confirmDeletes() {
    var forms = document.querySelectorAll("form[data-confirm]");
    for (var i = 0; i < forms.length; i++) {
      forms[i].addEventListener("submit", function (event) {
        var message = this.getAttribute("data-confirm") || "Are you sure?";
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      });
    }
  }

  function splitTags(raw) {
    if (!raw) return [];
    var parts = String(raw).split(",");
    var seen = {};
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var name = parts[i].trim().toLowerCase();
      if (!name) continue;
      if (!/^[a-z0-9-]{1,32}$/.test(name)) continue;
      if (seen[name]) continue;
      seen[name] = true;
      out.push(name);
      if (out.length >= 10) break;
    }
    return out;
  }

  function renderPreview(list, names) {
    list.innerHTML = "";
    for (var i = 0; i < names.length; i++) {
      var li = document.createElement("li");
      var chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = names[i];
      li.appendChild(chip);
      list.appendChild(li);
    }
  }

  function tagPreview() {
    var inputs = document.querySelectorAll("[data-tag-input]");
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var form = input.closest("form");
      if (!form) continue;
      var preview = form.querySelector("[data-tag-preview]");
      if (!preview) continue;
      var update = function () {
        renderPreview(preview, splitTags(input.value));
      };
      input.addEventListener("input", update);
      input.addEventListener("change", update);
      update();
    }
  }

  function dismissFlashes() {
    var stack = document.querySelector("[data-flash-stack]");
    if (!stack) return;
    window.setTimeout(function () {
      var notes = stack.querySelectorAll(".flash");
      for (var i = 0; i < notes.length; i++) {
        notes[i].classList.add("is-gone");
      }
      window.setTimeout(function () {
        stack.remove();
      }, 450);
    }, 4000);
  }

  onReady(function () {
    confirmDeletes();
    tagPreview();
    dismissFlashes();
  });
})();
