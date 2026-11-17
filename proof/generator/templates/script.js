// Motion for the portfolio pages. No library. Every page reads fine with this
// script off: it only adds the "js" class, and the hidden-before-reveal styles
// hang off that class. With "reduce motion" on, nothing is hidden or animated.
(function () {
  var root = document.documentElement;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Chicago clock in the hero. Text only, safe with reduced motion.
  var clock = document.querySelector("[data-chicago-time]");
  if (clock) {
    var format = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
    var tick = function () { clock.textContent = format.format(new Date()) + " local"; };
    tick();
    setInterval(tick, 30000);
  }

  // Scroll progress hairline and the nav link for the section in view.
  var bar = document.querySelector(".progress i");
  if (bar) {
    var onScroll = function () {
      var max = root.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  if (still || !("IntersectionObserver" in window)) return;
  root.classList.add("js");

  // Hero name: split into words that rise in turn. The full name stays as the
  // accessible label, and the split copies are hidden from screen readers.
  var name = document.querySelector("[data-split]");
  if (name) {
    var words = name.textContent.trim().split(/\s+/);
    name.setAttribute("aria-label", words.join(" "));
    name.textContent = "";
    words.forEach(function (word, i) {
      var outer = document.createElement("span");
      outer.className = "word";
      outer.setAttribute("aria-hidden", "true");
      var inner = document.createElement("span");
      inner.textContent = word;
      inner.style.animationDelay = 120 + i * 140 + "ms";
      outer.appendChild(inner);
      name.appendChild(outer);
      if (i < words.length - 1) name.appendChild(document.createTextNode(" "));
    });
  }

  // Reveal on scroll. Items that share a parent come in one after another.
  var targets = document.querySelectorAll(
    ".hero > :not(h1), .section-head, .sub-head, .section-note, .about p, .path li, .facts div, .work li, " +
    ".principles li, .proof, .figure, .contact, .writeup-head > *, .headline, .prose > *, .pager"
  );
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      seen.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  var order = new Map();
  targets.forEach(function (el) {
    var n = order.get(el.parentNode) || 0;
    order.set(el.parentNode, n + 1);
    el.classList.add("reveal");
    el.style.transitionDelay = Math.min(n, 6) * 70 + "ms";
    seen.observe(el);
  });

  // Diagrams draw themselves: boxes fade in, then each arrow is drawn in turn.
  var drawn = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("drawn");
      drawn.unobserve(entry.target);
    });
  }, { threshold: 0.25 });
  document.querySelectorAll("svg.dia").forEach(function (svg) {
    svg.querySelectorAll(".dia-line").forEach(function (line, i) {
      var length = line.getTotalLength();
      line.style.setProperty("--len", length);
      line.style.setProperty("--at", 300 + i * 110 + "ms");
    });
    svg.classList.add("will-draw");
    drawn.observe(svg);
  });

  // Nav: mark the section in view.
  var links = document.querySelectorAll('.nav-links a[href^="#"]');
  if (links.length) {
    var current = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + entry.target.id); });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    links.forEach(function (a) {
      var section = document.getElementById(a.getAttribute("href").slice(1));
      if (section) current.observe(section);
    });
  }
})();
