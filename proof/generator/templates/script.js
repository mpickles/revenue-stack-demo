// Behaviour and motion for every page. Pages read fine with this script off, and
// with "reduce motion" on nothing is hidden or animated.
(function () {
  var root = document.documentElement;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // Light and dark. Follows the device until the visitor picks one.
  var toggle = document.querySelector("[data-theme-toggle]");
  function isDark() { return root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function paint() { toggle.textContent = isDark() ? "Light" : "Dark"; }
  paint();
  toggle.addEventListener("click", function () {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    paint();
  });

  // A thin bar at the top shows how far down the page you are.
  var bar = document.querySelector(".progress");
  if (bar) window.addEventListener("scroll", function () {
    var max = root.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
  }, { passive: true });

  // Copy the email address, with a confirmation.
  $$("[data-copy]").forEach(function (button) {
    var label = button.textContent, note = document.getElementById("copied");
    button.addEventListener("click", function () {
      var done = function () { button.textContent = "Copied"; if (note) note.textContent = "Copied to your clipboard."; setTimeout(function () { button.textContent = label; }, 1600); };
      try { navigator.clipboard.writeText(button.dataset.copy).then(done, function () {}); } catch (e) {}
    });
  });

  // The routing scene: the sentence under the diagram.
  var steps = $$(".scene [data-step]"), says = document.querySelector(".says"), shown = -1;
  function say(i) { if (says && i !== shown) { shown = i; says.textContent = steps[i].dataset.step; } }
  if (steps.length) say(steps.length - 1);

  var motion = window.gsap && window.ScrollTrigger && !still;
  if (motion) gsap.registerPlugin.apply(gsap, [ScrollTrigger].concat(window.SplitText ? [SplitText] : [], window.Flip ? [Flip] : []));

  // The build filter. Rows slide to their new places.
  var chips = $$(".chips button"), rows = $$(".rows li");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
      var state = motion && window.Flip ? Flip.getState(rows) : null;
      rows.forEach(function (row) { row.hidden = !(chip.dataset.f === "all" || row.classList.contains(chip.dataset.f)); });
      if (state) Flip.from(state, { duration: 0.5, ease: "power2.inOut", absolute: true,
        onEnter: function (els) { return gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3 }); },
        onLeave: function (els) { return gsap.to(els, { opacity: 0, duration: 0.2 }); } });
      if (motion) ScrollTrigger.refresh();
    });
  });

  if (!motion) return;

  function start() {
    // The page title rises line by line, once.
    var title = document.querySelector("[data-rise]");
    if (title) {
      if (window.SplitText) {
        var split = SplitText.create(title, { type: "lines", mask: "lines", aria: "auto" });
        gsap.from(split.lines, { yPercent: 105, duration: 0.95, stagger: 0.08, ease: "expo.out", delay: 0.1 });
      } else {
        gsap.from(title, { opacity: 0, y: 24, duration: 0.9, ease: "expo.out", delay: 0.1 });
      }
      gsap.from(".under, .spec, .slot-box.portrait, .writeup-head .status, .headline", { opacity: 0, duration: 0.7, ease: "power2.out", delay: 0.65 });
    }

    // The name eases back as you scroll away from it.
    if (document.querySelector(".hero h1")) gsap.to(".hero h1", { yPercent: -12, opacity: 0.25, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 15%", scrub: true } });

    // The screenshot grows to full width as it comes up the screen.
    $$("[data-grow]").forEach(function (frame) {
      gsap.fromTo(frame, { scale: 0.86, borderRadius: 22 }, { scale: 1, borderRadius: 10, ease: "none", scrollTrigger: { trigger: frame, start: "top 95%", end: "top 30%", scrub: true } });
    });

    // Section headings rise out of a mask as they arrive.
    $$("main h2").forEach(function (h) {
      if (h.closest(".prose")) return;
      var text = h.textContent; h.setAttribute("aria-label", text); h.textContent = "";
      var mask = document.createElement("span"); mask.className = "mask"; mask.setAttribute("aria-hidden", "true");
      var inner = document.createElement("span"); inner.textContent = text; mask.appendChild(inner); h.appendChild(mask);
      gsap.from(inner, { yPercent: 112, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: h, start: "top 88%" } });
    });

    // Lists and cards arrive one after another.
    [".sys", ".proof li", "[data-stagger] > *"].forEach(function (group) {
      if (!document.querySelector(group)) return;
      ScrollTrigger.batch(group, { start: "top 90%", once: true, onEnter: function (batch) {
        gsap.from(batch, { opacity: 0, y: 28, duration: 0.7, stagger: 0.07, ease: "power3.out", clearProps: "opacity,transform" });
      } });
    });

    // Table rows wipe in from the left.
    $$("table[data-wipe]").forEach(function (table) {
      gsap.from(table.querySelectorAll("tr"), { clipPath: "inset(0 100% 0 0)", duration: 0.6, stagger: 0.08, ease: "power2.out", scrollTrigger: { trigger: table, start: "top 82%" } });
    });

    // The routing scene: the page holds while the diagram draws itself.
    if (steps.length) {
      var draw = gsap.timeline({ scrollTrigger: { trigger: ".scene .pin", start: "top top", end: "+=2000", pin: true, scrub: 0.4,
        onUpdate: function (self) { say(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))); } } });
      steps.forEach(function (step) {
        var wire = step.querySelector(".wire");
        if (wire) { var len = wire.getTotalLength(); gsap.set(wire, { strokeDasharray: len, strokeDashoffset: len }); draw.to(wire, { strokeDashoffset: 0, duration: 0.5, ease: "none" }); }
        draw.from(step.querySelectorAll("rect, text"), { opacity: 0, duration: 0.5, ease: "none" }, wire ? ">-0.1" : 0);
      });
      say(0);
    }

    // Write-up diagrams draw their arrows once, when they come into view.
    $$("svg.dia").forEach(function (svg) {
      var lines = $$(".dia-line:not(.dia-dash)", svg);
      lines.forEach(function (line) { var len = line.getTotalLength(); gsap.set(line, { strokeDasharray: len, strokeDashoffset: len }); });
      var tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: "top 78%" } });
      tl.from($$(".dia-box, .dia-text, .dia-sub", svg), { opacity: 0, duration: 0.5, stagger: 0.015 })
        .to(lines, { strokeDashoffset: 0, duration: 0.5, stagger: 0.09, ease: "power2.out" }, 0.3)
        .from($$(".dia-label, .dia-dash", svg), { opacity: 0, duration: 0.4 }, ">-0.2");
    });

    // The big email draws in at the end.
    if (document.querySelector(".mail")) gsap.from(".mail", { yPercent: 60, opacity: 0, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: ".mail", start: "top 94%" } });

    // Cursor: a coral dot trails the normal pointer and grows over anything clickable.
    if (window.matchMedia("(pointer: fine)").matches) {
      var dot = document.createElement("div"); dot.className = "cursor"; dot.setAttribute("aria-hidden", "true"); document.body.appendChild(dot);
      var x = gsap.quickTo(dot, "x", { duration: 0.45, ease: "power3" }), y = gsap.quickTo(dot, "y", { duration: 0.45, ease: "power3" });
      window.addEventListener("pointermove", function (e) { if (e.pointerType === "touch") return; gsap.to(dot, { opacity: 1, duration: 0.2, overwrite: "auto" }); x(e.clientX); y(e.clientY); });
      document.addEventListener("pointerleave", function () { gsap.to(dot, { opacity: 0, duration: 0.2 }); });
      document.addEventListener("pointerover", function (e) {
        var hot = !!e.target.closest("a, button");
        dot.classList.toggle("on-link", hot);
        gsap.to(dot, { scale: hot ? 3.4 : 1, duration: 0.3, ease: "power3.out", overwrite: "auto" });
      });
      window.addEventListener("pointerdown", function () { gsap.to(dot, { scale: 0.7, duration: 0.12 }); });
      window.addEventListener("pointerup", function (e) { gsap.to(dot, { scale: e.target.closest && e.target.closest("a, button") ? 3.4 : 1, duration: 0.25 }); });
    }
    ScrollTrigger.refresh();
  }
  // Cover drawings play once when they first come into view, so phones see the motion too.
  // The class comes off afterwards so pointing at a card can play it again.
  if (!still && "IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var art = entry.target; seen.unobserve(art); art.classList.add("play");
        setTimeout(function () { art.classList.remove("play"); }, 2600);
      });
    }, { threshold: 0.6 });
    $$(".art").forEach(function (art) { seen.observe(art); });
  }

  // Scrolling boxes (wide tables, diagrams, code) fade out at whichever edge still has more to scroll to.
  (function () {
    var boxes = $$(".tw, .figure, .prose pre");
    function mark(el) {
      var more = el.scrollWidth - el.clientWidth, x = el.scrollLeft, edge = [];
      if (more > 1 && x > 1) edge.push("l");
      if (more > 1 && x < more - 1) edge.push("r");
      if (edge.length) el.setAttribute("data-fade", edge.join(" ")); else el.removeAttribute("data-fade");
    }
    boxes.forEach(function (el) { mark(el); el.addEventListener("scroll", function () { mark(el); }, { passive: true }); });
    window.addEventListener("resize", function () { boxes.forEach(mark); });
  })();

  // Background: a faint dot grid. Dots near the pointer swell and take the accent colour,
  // and one ripple crosses the page on load, done in under five seconds. Nothing else moves on its own. With "reduce motion" the grid is drawn once and stays still.
  (function () {
    var c = document.createElement("canvas"); c.className = "grid"; c.setAttribute("aria-hidden", "true");
    document.body.insertBefore(c, document.body.firstChild);
    var g = c.getContext("2d"); if (!g) return;
    var gap = 28, w = 0, h = 0, px = -999, py = -999, tx = -999, ty = -999, base = "", accent = "", read = 0;
    var blocks = $$("h1, h2, h3, p, dl, table, figure, .rows, .xp, .nav, .under, .slot-box, .prose ul, .prose ol, .prose pre, .pager");
    var born = performance.now();
    function colours() { var s = getComputedStyle(root); base = s.getPropertyValue("--muted").trim(); accent = s.getPropertyValue("--accent").trim(); }
    function size() {
      var d = Math.min(window.devicePixelRatio || 1, 2); w = window.innerWidth; h = window.innerHeight;
      c.width = w * d; c.height = h * d; g.setTransform(d, 0, 0, d, 0, 0);
    }
    function draw(now) {
      if (now - read > 500) { colours(); read = now; }
      px += (tx - px) * 0.12; py += (ty - py) * 0.12;
      var reach = Math.hypot(w, h), ring = still ? -999 : (now - born) / 1000 * 420 - 80;
      g.clearRect(0, 0, w, h);
      // No dots behind words: skip any dot that falls inside a block of text on screen.
      var boxes = [];
      for (var i = 0; i < blocks.length; i++) {
        var r = blocks[i].getBoundingClientRect();
        if (r.bottom > 0 && r.top < h && r.width) boxes.push(r);
      }
      for (var x = gap / 2; x < w; x += gap) dots: for (var y = gap / 2; y < h; y += gap) {
        for (var j = 0; j < boxes.length; j++) { var b = boxes[j]; if (x > b.left - 10 && x < b.right + 10 && y > b.top - 8 && y < b.bottom + 8) continue dots; }
        var near = Math.max(0, 1 - Math.hypot(x - px, y - py) / 150);
        var wave = Math.max(0, 1 - Math.abs(Math.hypot(x, y) - ring) / 70) * 0.55;
        var a = Math.max(near, wave);
        if (a < 0.02) { g.globalAlpha = 0.2; g.fillStyle = base; g.fillRect(x - 0.5, y - 0.5, 1, 1); continue; }
        g.globalAlpha = 0.2 + a * 0.7; g.fillStyle = accent;
        g.beginPath(); g.arc(x, y, 0.6 + a * 1.5, 0, 6.2832); g.fill();
      }
      if (!still && !document.hidden) requestAnimationFrame(draw);
    }
    size(); requestAnimationFrame(draw);
    window.addEventListener("resize", function () { size(); if (still) requestAnimationFrame(draw); });
    if (still) { toggle.addEventListener("click", function () { read = 0; requestAnimationFrame(draw); }); return; }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) requestAnimationFrame(draw); });
    window.addEventListener("pointermove", function (e) { if (e.pointerType !== "touch") { tx = e.clientX; ty = e.clientY; } });
    document.addEventListener("pointerleave", function () { tx = ty = -999; });
  })();

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
})();
