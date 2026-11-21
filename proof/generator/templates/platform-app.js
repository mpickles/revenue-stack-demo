// The app replica on the platform pages. Made-up clients; the layout and labels follow the real app.
(function () {
  // The screenshot switcher on the platform page.
  var shots = document.getElementById("shots");
  if (shots) shots.querySelectorAll("[data-shot]").forEach(function (b) {
    b.addEventListener("click", function () {
      shots.querySelectorAll("[data-shot]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      shots.querySelectorAll("[data-pane]").forEach(function (p) { p.hidden = p.dataset.pane !== b.dataset.shot; });
    });
  });
  var app = document.getElementById("app"); if (!app) return;
  var wrap = app.closest(".ops-wrap"), only = app.dataset.only, toast = document.getElementById("ops-toast"), toastTimer = null;
  function $(id) { return document.getElementById(id); }
  function money(n) { return "$" + Math.abs(Math.round(n)).toLocaleString("en-US"); }
  function say(text, undo) {
    toast.firstElementChild.textContent = text; toast.lastElementChild.hidden = !undo; toast.lastElementChild.onclick = function () { undo(); say("Undone."); };
    toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; }, 6000);
  }
  function go(name) {
    app.querySelectorAll("[data-screen]").forEach(function (s) { s.hidden = s.dataset.screen !== name; });
    wrap.querySelectorAll("[data-go]").forEach(function (b) { if (b.closest(".ops-ctl")) b.setAttribute("aria-pressed", b.dataset.go === name); else if (b.closest(".ops-side")) b.classList.toggle("on", b.dataset.go === name || (name === "audit" && b.dataset.go === "clients")); });
    wrap.querySelectorAll("[data-for]").forEach(function (e) { e.hidden = e.dataset.for !== name; });
    toast.hidden = true;
  }
  wrap.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { if (!only) go(b.dataset.go); }); });
  if (only) wrap.classList.add("one");

  // Clients: what each role sees.
  var CLIENTS = [["A", "Live", "ok", "Person 1", "On track", "ok", 0, 10000, "Nov 5, 2026"], ["B", "Setup", "in", "Person 1", "No budget, $2,000 spent", "", 3, 0, "None yet"], ["C", "Live", "ok", "Person 1", "Over pacing", "warn", 1, 8000, "Nov 4, 2026"],
                 ["D", "Live", "ok", "Person 2", "On track", "ok", 0, 15000, "Nov 5, 2026"], ["E", "Paused", "", "Person 2", "Under pacing", "warn", 2, 6000, "Oct 6, 2026"], ["F", "Live", "ok", "Person 3", "On track", "ok", 0, 12000, "Nov 3, 2026"]];
  var SEES = { owner: "ABCDEF", director: "ABCDEF", lead: "ABC", viewer: "C" };
  function clients(role) {
    var rows = CLIENTS.filter(function (c) { return SEES[role].indexOf(c[0]) >= 0; });
    $("ops-clients").innerHTML = rows.map(function (c) {
      var budget = role === "viewer" ? '<span class="mu">Needs See spend</span>' : (c[7] ? money(c[7]) : '<span class="mu">No budget</span>');
      return "<tr><td><b>Client " + c[0] + '</b></td><td><span class="bd ' + c[2] + '">' + c[1] + "</span></td><td>" + c[3] + '</td><td><span class="bd ' + c[5] + '">' + c[4] + '</span></td><td class="r">' + c[6] + '</td><td class="r">' + budget + "</td><td>" + c[8] + "</td></tr>";
    }).join("");
    $("ops-count").textContent = rows.length + " of " + rows.length + " clients" + (role === "lead" || role === "viewer" ? ". Only the clients assigned to you." : ".");
    app.querySelectorAll("[data-role-hide]").forEach(function (e) { e.hidden = e.dataset.roleHide.split(" ").indexOf(role) >= 0; });
  }
  var roleSel = wrap.querySelector(".ops-role select"); roleSel.addEventListener("change", function () { clients(roleSel.value); }); clients("owner");

  // Pacing: budgets nest. A child can never take a parent over.
  var TREE = [["total", "Total", 0, null, 10000, 6500, ""], ["google", "Google", 1, "total", 7000, 4800, "Raise $20"], ["brand", "Brand", 2, "google", 3000, 2100, ""], ["c1", "Campaign 1", 3, "brand", 1500, 1100, ""], ["c2", "Campaign 2", 3, "brand", 1500, 1000, ""],
              ["nonbrand", "Non-brand", 2, "google", 4000, 2700, ""], ["c3", "Campaign 3", 3, "nonbrand", 4000, 2700, ""], ["microsoft", "Microsoft", 1, "total", 3000, 1700, "Lower $10"], ["c4", "Campaign 4", 2, "microsoft", 3000, 1700, ""]];
  var saved = {}, now = {}, editing = false; TREE.forEach(function (r) { saved[r[0]] = r[4]; now[r[0]] = r[4]; });
  function kids(id) { return TREE.filter(function (r) { return r[3] === id; }); }
  function check(id) {
    var k = kids(id); if (!k.length) return ["", "", 0];
    var diff = now[id] - k.reduce(function (s, r) { return s + now[r[0]]; }, 0);
    return diff === 0 ? ["Adds up", "ok", 0] : diff > 0 ? [money(diff) + " not assigned", "warn", 0] : [money(diff) + " over", "bad", -diff];
  }
  function checks() {
    var over = null, changed = 0;
    TREE.forEach(function (r) { var c = check(r[0]), cell = $("pk-" + r[0]); if (cell) cell.innerHTML = c[0] ? '<span class="bd ' + c[1] + '">' + c[0] + "</span>" : ""; if (c[2] && !over) over = [r[1], c[2]]; if (now[r[0]] !== saved[r[0]]) changed++; });
    var bar = $("pc-bar"), save = $("pc-save");
    bar.classList.toggle("bad", !!over);
    $("pc-msg").textContent = over ? over[0] + " is " + money(over[1]) + " over. Lower it to save." : changed ? changed + " unsaved change" + (changed > 1 ? "s" : "") : "Editing budgets";
    save.disabled = !!over || !changed; save.title = over ? "Over the parent: " + over[0] + " is " + money(over[1]) + " over" : "";
  }
  function pacing() {
    $("ops-pacing").innerHTML = TREE.map(function (r) {
      var cell = editing && r[0] !== "total" ? '<input type="number" step="100" min="0" value="' + now[r[0]] + '" data-id="' + r[0] + '" aria-label="' + r[1] + ' monthly budget">' : money(now[r[0]]);
      return '<tr class="l' + r[2] + '"><td>' + (r[2] ? '<span class="tw">└</span> ' : "") + (r[2] < 2 || kids(r[0]).length ? "<b>" + r[1] + "</b>" : r[1]) + '</td><td class="r' + (editing && r[0] !== "total" ? " ed" : "") + '">' + cell + '</td><td id="pk-' + r[0] + '"></td><td class="r">' + money(r[5]) + "</td><td>" + r[6] + "</td></tr>";
    }).join("");
    $("pc-bar").hidden = !editing; $("pc-edit").hidden = editing; checks();
    $("ops-pacing").querySelectorAll("input").forEach(function (i) { i.addEventListener("input", function () { now[i.dataset.id] = Math.max(0, Number(i.value) || 0); checks(); }); });
  }
  $("pc-edit").addEventListener("click", function () { editing = true; pacing(); });
  $("pc-discard").addEventListener("click", function () { editing = false; Object.keys(saved).forEach(function (k) { now[k] = saved[k]; }); pacing(); });
  $("pc-save").addEventListener("click", function () { editing = false; Object.keys(now).forEach(function (k) { saved[k] = now[k]; }); pacing(); say("Saved as one version of 2026-11. Only the rows you changed change."); });
  pacing();

  // Report review: a failed number check warns. It does not block approval.
  var SLIDES = [["Month at a glance", "Spend steady; leads up", "Spend $10,000 (+5%)", "", ""], ["Google search", "Brand CPC rose", "Leads 0 (-100%)", "Leads is 0 but was 40 the period before.", "Mention the outage"],
                ["What we changed", "Three changes, each followed by its result", "3 changes", "", ""], ["Next month", "Two tests to run", "", "", ""]];
  var cut = {}, locked = {}, built = false;
  function review() {
    $("ops-review").innerHTML = SLIDES.map(function (s, i) {
      var badge = s[3] && !cut[i] ? ' <span class="bd warn" title="' + s[3] + '">Numbers look off</span>' : "";
      return '<tr class="' + (cut[i] ? "cut" : "") + '"><td class="r">' + (i + 1) + "</td><td><b>" + s[0] + "</b>" + badge + "</td><td>" + s[1] + "</td><td>" + s[2] + (s[3] && !cut[i] ? '<small class="why">' + s[3] + "</small>" : "") + '</td><td class="' + (s[4] ? "" : "mu") + '">' + (s[4] || "Add a note") + '</td><td><button type="button" class="g" data-lock="' + i + '"' + (built ? " disabled" : "") + ">" + (locked[i] ? "Locked" : "Lock") + '</button></td><td><button type="button" class="g" data-cut="' + i + '"' + (built ? " disabled" : "") + ">" + (cut[i] ? "Put back" : "Cut") + "</button></td></tr>";
    }).join("");
    var open = SLIDES.filter(function (s, i) { return s[3] && !cut[i]; }).length;
    $("rv-check").hidden = !open || built; $("rv-check").textContent = open + " slide" + (open > 1 ? "s" : "") + " to check";
    $("rv-warn").hidden = !open; $("rv-warn").textContent = open + " slide" + (open > 1 ? "s have" : " has") + " numbers to check. You can still approve.";
    $("ops-review").querySelectorAll("[data-cut]").forEach(function (b) { b.addEventListener("click", function () { cut[b.dataset.cut] = !cut[b.dataset.cut]; review(); }); });
    $("ops-review").querySelectorAll("[data-lock]").forEach(function (b) { b.addEventListener("click", function () { locked[b.dataset.lock] = !locked[b.dataset.lock]; review(); }); });
  }
  $("rv-approve").addEventListener("click", function () { $("rv-sheet").hidden = false; });
  $("rv-cancel").addEventListener("click", function () { $("rv-sheet").hidden = true; });
  $("rv-go").addEventListener("click", function () { built = true; $("rv-sheet").hidden = true; $("rv-status").textContent = "Building"; $("rv-approve").disabled = true; review(); say("The deck is queued."); });
  review();

  // Audit: a person marks each conversion action. Nothing writes to the tag manager or the ad account.
  var ACTIONS = [["Demo form", "GTM · Primary", "Never", "Check the tag", "bad"], ["Pricing click", "GTM · Secondary", "Nov 2, 2026", "Check the trigger", "bad"], ["Newsletter signup", "Google Ads · Secondary", "Nov 12, 2026", "Confirm it still matters", "warn"], ["Phone call", "Google Ads · Secondary", "Nov 19, 2026", "", "ok"]];
  var LABEL = { bad: "Broken", warn: "Needs a Look", ok: "Working" }, mark = {}, menu = -1;
  function audit() {
    var n = { bad: 0, warn: 0, ok: 0 }, ignored = 0, html = "";
    ACTIONS.forEach(function (a, i) {
      if (mark[i] === "skip") { ignored++; return; }
      var state = mark[i] === "ok" ? "ok" : a[4]; n[state]++;
      html += '<tr><td><span class="bd ' + state + '">' + LABEL[state] + "</span></td><td><b>" + a[0] + '</b> <span class="mu">' + a[1] + "</span></td><td>" + a[2] + "</td><td>" + (state === "ok" ? "" : a[3]) + '</td><td class="mn"><button type="button" class="g" data-menu="' + i + '" aria-label="More for ' + a[0] + '">...</button>' + (menu === i ? '<span class="pop"><button type="button" data-set="skip">Not Relevant</button><button type="button" data-set="ok">Checked, It Works (7 days)</button></span>' : "") + "</td></tr>";
    });
    $("ops-audit").innerHTML = html;
    $("au-b").textContent = n.bad + " Broken"; $("au-n").textContent = n.warn + " Needs a Look"; $("au-w").textContent = n.ok + " Working";
    $("au-ignored").textContent = ignored ? "Ignored (" + ignored + ")" : "";
    $("ops-audit").querySelectorAll("[data-menu]").forEach(function (b) { b.addEventListener("click", function () { var i = Number(b.dataset.menu); menu = menu === i ? -1 : i; audit(); }); });
    $("ops-audit").querySelectorAll("[data-set]").forEach(function (b) { b.addEventListener("click", function () {
      var i = menu, was = mark[i], name = ACTIONS[i][0]; mark[i] = b.dataset.set; menu = -1; audit();
      say(b.dataset.set === "skip" ? "Not relevant: " + name + "." : "Checked, it works: " + name + ", for 7 days.", function () { mark[i] = was; audit(); });
    }); });
  }
  $("au-check").addEventListener("click", function () { var b = this; b.textContent = "Checking"; b.disabled = true; setTimeout(function () { b.textContent = "Check Now"; b.disabled = false; say("Checked live against Google Ads."); }, 1200); });
  audit();

  go(only || app.dataset.start || "pacing");
})();
