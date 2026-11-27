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

  // A long list shows its first rows and opens on request. Without this script every row shows.
  $$("[data-fold]").forEach(function (list) {
    var keep = Number(list.dataset.fold), more = list.children.length - keep;
    if (more < 1) return;
    list.classList.add("fold");
    var p = document.createElement("p"), b = document.createElement("button");
    p.className = "fold-more"; b.type = "button"; b.textContent = "Show " + more + " more"; b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function () { list.classList.add("open"); p.remove(); if (window.ScrollTrigger) ScrollTrigger.refresh(); });
    p.appendChild(b); list.parentNode.insertBefore(p, list.nextSibling);
  });
  var lenis = null;  // set further down, when smooth scrolling starts
  // Screenshots: press one to see it large, press again for full size. Works with or without motion.
  (function () {
    var shots = $$(".rshot-frame img");
    if (!shots.length || !window.HTMLDialogElement) return;
    var box = document.createElement("dialog"); box.className = "zoom"; box.setAttribute("data-lenis-prevent", ""); box.setAttribute("aria-label", "Screenshot, enlarged");
    box.innerHTML = '<div class="zoom-bar"><button type="button" data-size>Full size</button><button type="button" data-close>Close</button></div><div class="zoom-box"></div>';
    document.body.appendChild(box);
    var big = document.createElement("img"), size = box.querySelector("[data-size]");
    box.querySelector(".zoom-box").appendChild(big);
    function fit(full) { box.classList.toggle("full", full); size.textContent = full ? "Fit to screen" : "Full size"; if (!full) box.scrollTo(0, 0); }
    function open(img) {
      big.src = img.currentSrc || img.src; big.alt = img.alt; fit(false);
      big.style.filter = getComputedStyle(img).filter === "none" ? "" : getComputedStyle(img).filter;  // the diagram is flipped on a dark page
      box.showModal(); if (lenis) lenis.stop();
    }
    box.addEventListener("close", function () { if (lenis) lenis.start(); });
    box.querySelector("[data-close]").addEventListener("click", function () { box.close(); });
    size.addEventListener("click", function () { fit(!box.classList.contains("full")); });
    big.addEventListener("click", function () { fit(!box.classList.contains("full")); });
    box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("zoom-box")) box.close(); });
    shots.forEach(function (img) {
      img.classList.add("zoomable");
      img.addEventListener("click", function () { open(img); });
    });
    // One "Expand" button per frame, for touch and keyboard. It opens whichever screenshot is showing.
    $$(".rshot-frame").forEach(function (frame) {
      var b = document.createElement("button"); b.type = "button"; b.className = "zoom-open"; b.textContent = "Expand";
      b.addEventListener("click", function () {
        var showing = $$("img", frame).filter(function (img) { return getComputedStyle(img).display !== "none" && img.getClientRects().length > 0; })[0];
        if (showing) open(showing);
      });
      frame.appendChild(b);
    });
  })();

  var motion = window.gsap && window.ScrollTrigger && !still;
  if (motion) gsap.registerPlugin.apply(gsap, [ScrollTrigger].concat(window.SplitText ? [SplitText] : [], window.Flip ? [Flip] : []));

  // The build filter. Rows slide to their new places.
  var chips = $$(".chips button"), rows = $$(".rows li");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
      var state = motion && window.Flip ? Flip.getState(rows) : null;
      rows.forEach(function (row) { row.hidden = !(chip.dataset.f === "all" || row.classList.contains(chip.dataset.f)); });
      if (state) Flip.from(state, { duration: 0.5, ease: "power3.out", absolute: true,
        onEnter: function (els) { return gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3 }); },
        onLeave: function (els) { return gsap.to(els, { opacity: 0, duration: 0.2 }); } });
      if (motion) ScrollTrigger.refresh();
    });
  });

  // The lead's path on the project page. Click a part, or let one lead walk through all of them.
  (function () {
    var map = document.getElementById("map"), src = document.getElementById("journey");
    if (!map || !src) return;
    var steps = JSON.parse(src.textContent), at = 0, timer = null, play = document.getElementById("play");
    var lead = map.querySelector(".lead"), stops = map.querySelectorAll(".stop"), links = map.querySelectorAll(".link");
    var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function rest(i) { var m = map.getBoundingClientRect(), r = stops[i].getBoundingClientRect(); return "translate(" + (r.left - m.left + r.width / 2) + "px," + (r.top - m.top) + "px)"; }
    function text(id, value, quiet) { var el = document.getElementById(id); el.textContent = value; if (quiet) return; el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); }
    function show(i, quiet) {
      at = Math.max(0, Math.min(steps.length - 1, i)); var step = steps[at];
      lead.classList.toggle("still", !!quiet || calm); lead.style.transform = rest(at);
      stops.forEach(function (b, k) { b.classList.toggle("done", k <= at); b.classList.toggle("cur", k === at); if (k === at) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
      links.forEach(function (l, k) { l.classList.toggle("on", k < at); });
      if (!quiet) { var art = stops[at].querySelector(".art"); art.classList.remove("play"); void art.getBoundingClientRect(); art.classList.add("play"); }
      var status = document.getElementById("s-status"); status.textContent = step.status; status.className = "status " + step.css;
      text("s-name", step.name, quiet); text("s-why", step.why, quiet); text("s-gets", step.gets, quiet); text("s-out", step.out, quiet);
      document.getElementById("s-go").href = "builds/" + step.slug + ".html";
    }
    function size() { map.style.setProperty("--mid", stops[0].querySelector(".art").getBoundingClientRect().height / 2 + "px"); lead.classList.add("still"); lead.style.transform = rest(at); }
    function stop() { if (timer) clearInterval(timer); timer = null; play.textContent = "Follow the lead"; }
    play.addEventListener("click", function () {
      if (timer) return stop();
      show(0); play.textContent = "Stop";
      timer = setInterval(function () { if (at >= steps.length - 1) return stop(); show(at + 1); }, 2200);
    });
    stops.forEach(function (b) { b.addEventListener("click", function () { stop(); show(Number(b.dataset.step)); }); });
    window.addEventListener("resize", size);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
    size(); show(0, true);
  })();

  // Two cards can open the same page. Whichever is clicked takes the shared names, so its picture grows into
  // the page's banner and its title becomes the page's title.
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("a");
    if (!link) return;
    Array.prototype.forEach.call(link.querySelectorAll("[data-vt-name]"), function (part) {
      var name = part.getAttribute("data-vt-name");
      Array.prototype.forEach.call(document.querySelectorAll('[style*="view-transition-name"]'), function (el) {
        if (el.style.viewTransitionName === name) el.style.viewTransitionName = "none";
      });
      part.style.viewTransitionName = name;
    });
  }, true);

  if (!motion) return;

  // One motion language for the whole site: one curve and three speeds. Nothing that moves takes longer than SLOW.
  var EASE = "power3.out", FAST = 0.2, MED = 0.35, SLOW = 0.5;
  // Arriving from another page of this site, the browser has just morphed that page into this one. Do not replay the title.
  var morphedIn = false;
  try { morphedIn = "onpagereveal" in window && !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (err) {}

  // Smooth scrolling. One clock drives the scroll and every animation tied to it.
  if (window.Lenis) {
    lenis = new Lenis({ anchors: true, allowNestedScroll: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function start() {
    // The page title rises line by line, once.
    var title = document.querySelector("[data-rise]");
    if (title) {
      if (window.SplitText) {
        var split = SplitText.create(title, { type: "lines", mask: "lines", aria: "auto" });
        if (!morphedIn) gsap.from(split.lines, { yPercent: 105, duration: SLOW, stagger: 0.06, ease: EASE, delay: 0.05 });
      } else if (!morphedIn) {
        gsap.from(title, { opacity: 0, y: 24, duration: SLOW, ease: EASE, delay: 0.05 });
      }
      gsap.from(".under, .spec, .slot-box.portrait, .writeup-head .status, .headline", { opacity: 0, duration: MED, ease: EASE, delay: 0.35 });
    }

    // Home page entrance. Nothing waits behind a loader: the name is readable from the first frame and the
    // rest arrives around it inside a second. Half that on a return visit in the same tab.
    var name = document.querySelector(".hero.v2 h1.name");
    if (name) {
      var stop = name.querySelector("i"), firstVisit = true;
      try { firstVisit = !sessionStorage.getItem("entered"); sessionStorage.setItem("entered", "1"); } catch (err) {}
      var k = firstVisit ? 1 : 0.5;
      var intro = gsap.timeline({ delay: 0.05 });
      // The lead. One dot in the accent colour runs in from the left edge and lands as the full stop after my name.
      if (stop) {
        gsap.set(stop, { opacity: 0 });
        intro.call(function () {
          var box = stop.getBoundingClientRect(), style = getComputedStyle(stop);
          var runner = stop.cloneNode(true);
          runner.style.cssText = "position:fixed;margin:0;z-index:5;pointer-events:none;left:" + box.left + "px;top:" + box.top + "px;font:" + style.font + ";line-height:" + style.lineHeight + ";letter-spacing:0;color:" + style.color + ";transform-origin:100% 80%";
          document.body.appendChild(runner);
          gsap.fromTo(runner, { x: -(box.left + 60), scaleX: 3.2 }, { x: 0, scaleX: 1, duration: 0.42 * k, ease: "power3.inOut", onComplete: function () {
            gsap.set(stop, { opacity: 1 });
            runner.remove();
            gsap.fromTo(stop, { scale: 1.6 }, { scale: 1, duration: MED, ease: "back.out(3)", transformOrigin: "50% 80%", display: "inline-block", clearProps: "transform,display" });
          } });
        }, null, 0.4 * k);
        intro.call(function () { gsap.set(stop, { opacity: 1 }); }, null, 0.4 * k + 1.2);  // whatever happens, the dot ends up visible
      }
      intro.from(".role-line, .hero.v2 .pitch, .hero-acts", { opacity: 0, y: 12, duration: MED * k, stagger: 0.05, ease: EASE, clearProps: "opacity,transform" }, 0.2 * k);
      intro.from(".hero-work > *", { opacity: 0, y: 24, duration: MED * k, stagger: 0.07, ease: EASE, clearProps: "opacity,transform" }, 0.3 * k);
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
      if (window.SplitText) {
        var cut = SplitText.create(h, { type: "words,chars", mask: "words", wordsClass: "w", charsClass: "c", aria: "auto" });
        gsap.from(cut.chars, { yPercent: 112, duration: SLOW, stagger: 0.014, ease: EASE, scrollTrigger: { trigger: h, start: "top 96%" } });
        return;
      }
      var text = h.textContent; h.setAttribute("aria-label", text); h.textContent = "";
      var mask = document.createElement("span"); mask.className = "mask"; mask.setAttribute("aria-hidden", "true");
      var inner = document.createElement("span"); inner.textContent = text; mask.appendChild(inner); h.appendChild(mask);
      gsap.from(inner, { yPercent: 112, duration: MED, ease: EASE, scrollTrigger: { trigger: h, start: "top 98%" } });
    });

    // The tour of the platform: the stage holds still while the page scrolls through the six parts.
    (function () {
      var tour = document.getElementById("tour");
      if (!tour) return;
      tour.hidden = false;
      var after = tour.nextElementSibling;
      if (after && after.classList.contains("parts-h")) after.hidden = true;  // the tour says the same thing, better
      var shows = $$(".tour-stage figure", tour), steps = $$(".tour-steps li", tour), at = -1;
      function go(i) {
        if (i === at) return; at = i;
        shows.forEach(function (el, n) {
          el.classList.toggle("on", n === i);
          var clip = el.querySelector("video"), art = el.querySelector(".art");
          if (clip) { if (n === i) { var p = clip.play(); if (p && p.catch) p.catch(function () {}); } else clip.pause(); }
          if (art) art.classList.toggle("play", n === i);
        });
        steps.forEach(function (el, n) { el.classList.toggle("on", n === i); });
      }
      go(0);
      ScrollTrigger.create({ trigger: ".tour-pin", start: "top top", end: "+=" + steps.length * 55 + "%", pin: true, anticipatePin: 1,
        onUpdate: function (self) { go(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))); } });
      steps.forEach(function (el, n) { el.querySelector("b").addEventListener("click", function () { go(n); }); });
    })();

    // Lists and cards arrive one after another.
    [".sys", ".proof li", "[data-stagger] > *", ".tldr > div", ".nums > div", ".flow > li", ".chose > div", ".shows > div", ".more-rows > div"].forEach(function (group) {
      if (!document.querySelector(group)) return;
      ScrollTrigger.batch(group, { start: "top 98%", once: true, onEnter: function (batch) {
        gsap.from(batch, { opacity: 0, y: 10, duration: FAST, stagger: 0.02, ease: EASE, clearProps: "opacity,transform" });
      } });
    });

    // A plain number counts up to its value as it arrives. Ranges, ratios and money are left alone.
    $$(".nums b").forEach(function (b) {
      var text = b.textContent.trim();
      if (!/^[0-9][0-9,]*%?$/.test(text) || b.children.length) return;
      var end = parseInt(text.replace(/[^0-9]/g, ""), 10), unit = text.slice(-1) === "%" ? "%" : "", box = { n: 0 };
      if (end < 10) return;
      b.setAttribute("aria-label", text);
      b.style.fontVariantNumeric = "tabular-nums";
      gsap.to(box, { n: end, duration: SLOW * 2, ease: EASE, scrollTrigger: { trigger: b, start: "top 92%", once: true },
        onUpdate: function () { b.textContent = Math.round(box.n).toLocaleString("en-US") + unit; },
        onComplete: function () { b.textContent = text; } });
    });

    // Table rows wipe in from the left.
    $$("table[data-wipe]").forEach(function (table) {
      gsap.from(table.querySelectorAll("tr"), { clipPath: "inset(0 100% 0 0)", duration: FAST, stagger: 0.02, ease: EASE, scrollTrigger: { trigger: table, start: "top 98%" } });
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
    if (document.querySelector(".mail")) gsap.from(".mail", { yPercent: 60, opacity: 0, duration: SLOW, ease: EASE, scrollTrigger: { trigger: ".mail", start: "top 94%" } });

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
    // A picture that loads late can move everything under it. Measure again when one does.
    var again = null;
    $$("img[loading=lazy]").forEach(function (img) {
      if (!img.complete) img.addEventListener("load", function () { clearTimeout(again); again = setTimeout(function () { ScrollTrigger.refresh(); }, 120); });
    });
    ScrollTrigger.refresh();
  }
  // Cover drawings play once when they first come into view, so phones see the motion too.
  // The class comes off afterwards so pointing at a card can play it again.
  if (!still && "IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var art = entry.target; seen.unobserve(art); art.classList.add("play");
        setTimeout(function () { art.classList.remove("play"); }, 5400);
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

// Animated diagrams: data riding the lanes that are live for the step or the request picked.
// One drawing routine for both figures. With "reduce motion" on, the dots sit still on their lanes.
(function () {
  var figs = Array.prototype.slice.call(document.querySelectorAll(".flowfig"));
  if (!figs.length) return;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches, drawn = [];
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function rect(cls, x, y, w, h, inner) { return '<g class="n ' + cls + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="10"/>' + inner + "</g>"; }
  function txt(cls, x, y, s, anchor) { return '<text class="' + cls + '" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || "middle") + '" dominant-baseline="central">' + esc(s) + "</text>"; }
  function finish(state, svg, W, H, lanes, nodes) {
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "<g>" + lanes.join("") + "</g><g>" + nodes.join("") + '</g><g class="tok"></g>';
    state.live = Array.prototype.slice.call(svg.querySelectorAll("path.live")).map(function (p) { return { p: p, len: p.getTotalLength() }; });
    state.tok = svg.querySelector(".tok");
    state.tok.innerHTML = state.live.map(function () { return '<circle r="4.5"/><circle r="4.5"/><circle r="4.5"/>'; }).join("");
    place(state, performance.now());
  }
  function place(state, t) {
    if (!state.tok) return;
    state.live.forEach(function (o, i) {
      for (var k = 0; k < 3; k++) {
        var c = state.tok.children[i * 3 + k]; if (!c) return;
        var f = still ? (k + 1) / 4 : ((t / 2400) + k / 3) % 1, pt = o.p.getPointAtLength(f * o.len);
        c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y);
      }
    });
  }

  // Figure one: a night of data, from the sources to the people who read it.
  var SRC = [["Ad platforms", "Ads"], ["CRM leads", "CRM"], ["Tasks and calls", "Tasks"], ["Tag containers", "Tags"]];
  var CON = [["Web app", "App"], ["The team's Claude", "Claude"], ["Report decks", "Decks"], ["Alerts", "Alerts"]];
  var BLK = { raw: ["Raw", ["As delivered", "Never edited"], "As delivered"], stg: ["Staging", ["Cleaned", "One shape", "5 am build"], "Cleaned, one shape"], mart: ["Marts", ["Daily facts", "Rollups", "Tested"], "Tested tables"] };
  var STEPS = [
    { t: "Every source lands overnight", on: ["src", "raw"], flow: ["s"], b: "Google Ads arrives through the platform's own free transfer and a daily script. Microsoft Ads posts from a script inside each account. Tasks, call summaries and tag containers load every night. Nothing is changed on the way in." },
    { t: "Raw is the untouched copy", on: ["raw"], flow: [], b: "Each source keeps its own dataset, exactly as delivered. When a number looks wrong later, it can be traced all the way back to here." },
    { t: "5 am: dbt cleans and joins", on: ["raw", "stg"], flow: ["rs"], b: "A scheduled job runs dbt. Staging models fix names and types, remove duplicates and map every ad account to its client, so each platform ends up in one shape." },
    { t: "Marts are what people read", on: ["stg", "mart"], flow: ["sm"], b: "Daily facts, monthly and quarterly rollups, and leads matched to campaigns. 808 tests guard 215 models. A failed test stops the build, so a bad number is never published." },
    { t: "Changes are tested before they ship", on: ["ci", "stg", "mart"], flow: ["ci"], b: "Every push builds the changed models, and the ones that depend on them, in a throwaway dataset and runs their tests. It deploys only if they pass." },
    { t: "Everything reads the same tables", on: ["mart", "con"], flow: ["c"], b: "The web app, the team's Claude, the report decks and the alerts all read the same tested tables. The app and a deck cannot disagree." },
    { t: "Built to cost nothing to host", on: ["src", "raw", "stg", "mart", "ci", "con"], flow: ["s", "rs", "sm", "c"], b: "Cost comes from how often tables are re-read, not from their size. The build re-processes recent days only, and the app keeps each answer until the next load." }
  ];
  function route(fig) {
    var svg = fig.querySelector("svg"), box = fig.querySelector(".flow-stage"), state = { live: [], tok: null }, cur = 0, playing = false, timer = null, seen = false;
    var q = function (s) { return fig.querySelector(s); };
    var dots = q(".flow-dots"); dots.innerHTML = STEPS.map(function (s, i) { return '<button type="button" data-i="' + i + '" aria-label="Step ' + (i + 1) + ": " + esc(s.t) + '">' + (i + 1) + "</button>"; }).join("");
    function draw() {
      var W = box.clientWidth, v = W < 560, H = v ? Math.max(360, Math.min(640, window.innerHeight - 400)) : Math.max(280, Math.min(420, window.innerHeight - 200)); box.style.height = H + "px";
      var st = STEPS[cur], on = st.on, fl = st.flow, lanes = [], nodes = [], m = 14;
      var cls = function (k) { return on.indexOf(k) >= 0 ? "on" : "off"; };
      var lane = function (k, d, dash) { lanes.push('<path class="lane' + (fl.indexOf(k) >= 0 ? " live" : "") + (dash ? " dash" : "") + '" d="' + d + '"/>'); };
      var i;
      if (!v) {
        var top = 70, colW = (W - 2 * m) / 5, bw = Math.min(160, colW - 26), short = bw < 134;
        var cx = function (n) { return m + colW * (n + 0.5); }, gap = 14, avail = H - top - 14, hn = Math.min(56, (avail - 3 * gap) / 4);
        var total = 4 * hn + 3 * gap, y0 = top + (avail - total) / 2, yc = function (n) { return y0 + n * (hn + gap) + hn / 2; };
        var L = function (n) { return cx(n) - bw / 2; }, R = function (n) { return cx(n) + bw / 2; };
        for (i = 0; i < 4; i++) {
          lane("s", "M" + R(0) + " " + yc(i) + "H" + L(1)); lane("rs", "M" + R(1) + " " + yc(i) + "H" + L(2));
          lane("sm", "M" + R(2) + " " + yc(i) + "H" + L(3)); lane("c", "M" + R(3) + " " + yc(i) + "H" + L(4));
          nodes.push(rect(cls("src"), L(0), yc(i) - hn / 2, bw, hn, txt("l", cx(0), yc(i), short ? SRC[i][1] : SRC[i][0])));
          nodes.push(rect(cls("con"), L(4), yc(i) - hn / 2, bw, hn, txt("l", cx(4), yc(i), short ? CON[i][1] : CON[i][0])));
        }
        ["raw", "stg", "mart"].forEach(function (k, j) {
          var b = BLK[k], x = cx(j + 1);
          nodes.push(rect(cls(k), L(j + 1), y0, bw, total, txt("h", x, y0 + 26, b[0]) + b[1].map(function (s, n) { return txt("sub", x, y0 + 54 + n * 20, s); }).join("")));
        });
        var cw = Math.min(230, bw * 1.7), cxm = (cx(2) + cx(3)) / 2, ct = 12, ch = 42;
        lane("ci", "M" + (cxm - cw * 0.25) + " " + (ct + ch) + "C" + (cxm - cw * 0.25) + " " + (ct + ch + 16) + " " + cx(2) + " " + (y0 - 16) + " " + cx(2) + " " + y0, true);
        lane("ci", "M" + (cxm + cw * 0.25) + " " + (ct + ch) + "C" + (cxm + cw * 0.25) + " " + (ct + ch + 16) + " " + cx(3) + " " + (y0 - 16) + " " + cx(3) + " " + y0, true);
        nodes.push(rect(cls("ci"), cxm - cw / 2, ct, cw, ch, txt("l", cxm, ct + ch / 2, cw < 170 ? "Checks" : "A check on every push")));
      } else {
        var ciw = Math.min(92, W * 0.24), laneR = W - m - ciw - 12, laneW = laneR - m, cW = laneW / 4, bw2 = cW - 8, bx = function (n) { return m + cW * (n + 0.5); };
        var hs = 46, hb = 60, g2 = (H - 2 * m - 2 * hs - 3 * hb) / 4, y = [m];
        y[1] = y[0] + hs + g2; y[2] = y[1] + hb + g2; y[3] = y[2] + hb + g2; y[4] = y[3] + hb + g2;
        for (i = 0; i < 4; i++) {
          var x2 = bx(i);
          lane("s", "M" + x2 + " " + (y[0] + hs) + "V" + y[1]); lane("rs", "M" + x2 + " " + (y[1] + hb) + "V" + y[2]);
          lane("sm", "M" + x2 + " " + (y[2] + hb) + "V" + y[3]); lane("c", "M" + x2 + " " + (y[3] + hb) + "V" + y[4]);
          nodes.push(rect(cls("src"), x2 - bw2 / 2, y[0], bw2, hs, txt("l", x2, y[0] + hs / 2, SRC[i][1])));
          nodes.push(rect(cls("con"), x2 - bw2 / 2, y[4], bw2, hs, txt("l", x2, y[4] + hs / 2, CON[i][1])));
        }
        ["raw", "stg", "mart"].forEach(function (k, j) {
          var b = BLK[k], yy = y[j + 1];
          nodes.push(rect(cls(k), m, yy, laneW, hb, txt("h", m + 14, yy + 21, b[0], "start") + txt("sub", m + 14, yy + 42, b[2], "start")));
        });
        var cxl = W - m - ciw, cy = (y[2] + y[3] + hb) / 2, t1 = y[2] + hb / 2, t2 = y[3] + hb / 2;
        lane("ci", "M" + cxl + " " + (cy - 12) + "C" + (cxl - 14) + " " + (cy - 12) + " " + (laneR + 14) + " " + t1 + " " + laneR + " " + t1, true);
        lane("ci", "M" + cxl + " " + (cy + 12) + "C" + (cxl - 14) + " " + (cy + 12) + " " + (laneR + 14) + " " + t2 + " " + laneR + " " + t2, true);
        nodes.push(rect(cls("ci"), cxl, cy - 28, ciw, 56, txt("l", cxl + ciw / 2, cy, "Checks")));
      }
      finish(state, svg, W, H, lanes, nodes);
    }
    function plan() {
      clearTimeout(timer);
      if (playing) timer = setTimeout(function () { go(cur + 1); }, 7000);
      q(".flow-play").textContent = playing ? "Pause" : "Play"; q(".flow-play").setAttribute("aria-pressed", String(playing));
    }
    function go(i) {
      cur = (i + STEPS.length) % STEPS.length;
      q(".flow-n").textContent = "Step " + (cur + 1) + " of " + STEPS.length; q(".flow-t").textContent = STEPS[cur].t; q(".flow-b").textContent = STEPS[cur].b;
      Array.prototype.forEach.call(dots.children, function (b, n) { if (n === cur) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
      draw(); plan();
    }
    q(".flow-prev").addEventListener("click", function () { playing = false; go(cur - 1); });
    q(".flow-next").addEventListener("click", function () { playing = false; go(cur + 1); });
    q(".flow-play").addEventListener("click", function () { playing = !playing; plan(); });
    dots.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { playing = false; go(Number(b.dataset.i)); } });
    if (window.ResizeObserver) new ResizeObserver(draw).observe(box); else window.addEventListener("resize", draw);
    // It plays by itself only while it is on screen, and only once you have reached it.
    if (window.IntersectionObserver && !still) new IntersectionObserver(function (es) {
      var inView = es[0].isIntersecting;
      if (inView && !seen) { seen = true; playing = true; }
      if (!inView) clearTimeout(timer); else plan();
    }, { threshold: 0.4 }).observe(fig);
    go(0); drawn.push(state);
  }

  // Figure two: the path one request takes.
  var PATHS = {
    claude: { t: "Someone asks the team's Claude a question.", e: ["pd", "bd", "dc"], n: ["pg", "bq", "dl", "claude"], b: "Claude calls a tool on the app's own connector. The token is looked up on that call, the person is loaded from Postgres, and the tool runs through the same data layer as the app: their clients only, from the cache when it can. Claude writes the sentences. It never does the sums." },
    app: { t: "An account lead opens a client page.", e: ["pd", "bd", "da"], n: ["pg", "bq", "dl", "app"], b: "The server knows who they are from sign-in and looks up their clients in Postgres. Only then does it ask the data layer for numbers. On a cache miss it runs one named query against the tested tables, with a cost cap." },
    deck: { t: "A monthly report builds.", e: ["bk"], n: ["bq", "deck"], b: "Code works out every number the report may quote from the tested tables. The model only writes around them, and a checker flags any slide that looks off. The result is a draft. A person approves it before anything reaches a client." }
  };
  function paths(fig) {
    var svg = fig.querySelector("svg"), box = fig.querySelector(".flow-stage"), state = { live: [], tok: null }, pick = "claude", tabs = fig.querySelector(".flow-tabs");
    function draw() {
      var W = box.clientWidth, H = Math.max(250, Math.min(W < 560 ? 300 : 330, window.innerHeight - 220)), m = 14; box.style.height = H + "px";
      var colW = (W - 2 * m) / 3, bw = Math.min(200, colW - 30), short = bw < 132;
      var cx = function (i) { return m + colW * (i + 0.5); }, L = function (i) { return cx(i) - bw / 2; }, R = function (i) { return cx(i) + bw / 2; };
      var gap = 18, hn = Math.min(60, (H - 2 * m - 3 * gap) / 4), y = function (i) { return m + i * (hn + gap) + hn / 2; };
      var r = PATHS[pick], lanes = [], nodes = [];
      var c = function (k) { return r.n.indexOf(k) >= 0 ? "on" : "off"; };
      var lane = function (k, d) { lanes.push('<path class="lane' + (r.e.indexOf(k) >= 0 ? " live" : "") + '" d="' + d + '"/>'); };
      var boxAt = function (k, i, row, label, sub) { nodes.push(rect(c(k), L(i), y(row) - hn / 2, bw, hn, sub ? txt("l", cx(i), y(row) - 9, label) + txt("sub", cx(i), y(row) + 11, sub) : txt("l", cx(i), y(row), label))); };
      var dlTop = y(1) - hn / 2, dlH = y(2) - y(1) + hn, mid = (R(1) + L(2)) / 2, midL = (R(0) + L(1)) / 2;
      lane("pd", "M" + R(0) + " " + y(0) + "C" + midL + " " + y(0) + " " + midL + " " + (dlTop + 18) + " " + L(1) + " " + (dlTop + 18));
      lane("bd", "M" + R(0) + " " + y(3) + "C" + midL + " " + y(3) + " " + midL + " " + (dlTop + dlH - 18) + " " + L(1) + " " + (dlTop + dlH - 18));
      lane("dc", "M" + R(1) + " " + (dlTop + 18) + "C" + mid + " " + (dlTop + 18) + " " + mid + " " + y(0) + " " + L(2) + " " + y(0));
      lane("da", "M" + R(1) + " " + (dlTop + dlH / 2) + "C" + mid + " " + (dlTop + dlH / 2) + " " + mid + " " + y(1.5) + " " + L(2) + " " + y(1.5));
      lane("bk", "M" + R(0) + " " + (y(3) + 12) + "H" + L(2));
      boxAt("pg", 0, 0, "Postgres", short ? "Who you are" : "People and their clients");
      boxAt("bq", 0, 3, short ? "Warehouse" : "Tested tables", short ? "Numbers" : "Every number");
      boxAt("claude", 2, 0, short ? "Claude" : "The team's Claude", short ? "" : "Through the connector");
      boxAt("app", 2, 1.5, short ? "App" : "Web app", short ? "" : "Client pages");
      boxAt("deck", 2, 3, short ? "Decks" : "Report decks", short ? "" : "A draft for review");
      var subs = short ? ["Your clients", "Cache"] : ["Who is asking?", "Your clients only", "Cache, cost cap"];
      nodes.push(rect(c("dl"), L(1), dlTop, bw, dlH, txt("h", cx(1), dlTop + 24, "Data layer") + subs.map(function (s, n) { return txt("sub", cx(1), dlTop + 50 + n * 19, s); }).join("")));
      finish(state, svg, W, H, lanes, nodes);
      fig.querySelector(".flow-t").textContent = r.t; fig.querySelector(".flow-b").textContent = r.b;
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.r === pick)); });
    }
    tabs.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { pick = b.dataset.r; draw(); } });
    if (window.ResizeObserver) new ResizeObserver(draw).observe(box); else window.addEventListener("resize", draw);
    draw(); drawn.push(state);
  }

  figs.forEach(function (fig) { (fig.dataset.flow === "paths" ? paths : route)(fig); });
  function loop(t) { drawn.forEach(function (s) { place(s, t); }); requestAnimationFrame(loop); }
  if (!still) requestAnimationFrame(loop);
})();
