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

    // The six real screens on the platform page hold still while the page scrolls through them,
    // as long as the whole block fits on the screen.
    (function () {
      var shots = document.getElementById("shots");
      if (!shots) return;
      var tabs = $$("[data-shot]", shots);
      if (tabs.length < 3) return;
      shots.classList.add("fit");  // cap the screenshot's height so the block can fit under the nav
      if (shots.offsetHeight > window.innerHeight - 96) { shots.classList.remove("fit"); return; }
      $$("img", shots).forEach(function (img) { img.loading = "eager"; if (!img.complete) img.addEventListener("load", function () { ScrollTrigger.refresh(); }); });
      ScrollTrigger.create({ trigger: shots, start: "top 88px", end: "+=" + tabs.length * 45 + "%", pin: true, anticipatePin: 1,
        onUpdate: function (self) {
          var tab = tabs[Math.min(tabs.length - 1, Math.floor(self.progress * tabs.length))];
          if (tab.getAttribute("aria-pressed") !== "true") tab.click();
        } });
    })();

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
