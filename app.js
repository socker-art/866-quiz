/* 866 刷题 —— 本地优先刷题应用（无依赖，iPad Safari 可直接用） */
(function () {
  "use strict";

  var BANK = window.BANK || { subjects: [] };
  var KEY = "sk866.v1";
  var app = document.getElementById("app");
  var toastEl = document.getElementById("toast");
  var toastTimer = null;

  /* ============ 存储 ============ */
  var memFallback = {};
  function readRaw() {
    try { return localStorage.getItem(KEY); } catch (e) { return memFallback[KEY] || null; }
  }
  function writeRaw(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { memFallback[KEY] = v; }
  }

  var store = load();
  function load() {
    var raw = readRaw();
    var base = {
      v: 1,
      cards: {},
      days: {},
      settings: { dailyNew: 40, theme: "auto" },
      custom: [],
      created: today()
    };
    if (!raw) return base;
    try {
      var p = JSON.parse(raw);
      base.cards = p.cards || {};
      base.days = p.days || {};
      base.settings = Object.assign(base.settings, p.settings || {});
      base.custom = p.custom || [];
      base.created = p.created || base.created;
    } catch (e) {}
    return base;
  }
  function save() { writeRaw(JSON.stringify(store)); }

  /* ============ 工具 ============ */
  function today() { return dayKey(new Date()); }
  function dayKey(d) {
    var y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
    return y + "-" + (m < 10 ? "0" + m : m) + "-" + (dd < 10 ? "0" + dd : dd);
  }
  function addDays(key, n) {
    var p = key.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return dayKey(d);
  }
  function diffDays(a, b) {
    var pa = a.split("-"), pb = b.split("-");
    var da = new Date(+pa[0], +pa[1] - 1, +pa[2]);
    var db = new Date(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function stars(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += "★";
    return s;
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 1900);
  }
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[，,。；;：:、（）()【】\[\]\s　]/g, "")
      .replace(/[，。；：、（）]/g, "");
  }
  function cnDate(d) {
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  var WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  /* ============ 题库索引 ============ */
  var allSubjects = [];
  function rebuildIndex() {
    allSubjects = BANK.subjects.concat(store.custom || []);
  }
  rebuildIndex();

  function findSubject(sid) { return allSubjects.filter(function (s) { return s.id === sid; })[0]; }
  function findChapter(sid, cid) {
    var s = findSubject(sid);
    if (!s) return null;
    return (s.chapters || []).filter(function (c) { return c.id === cid; })[0];
  }
  function allChapters() {
    var out = [];
    allSubjects.forEach(function (s) {
      (s.chapters || []).forEach(function (c) { out.push({ subject: s, chapter: c }); });
    });
    return out;
  }
  function chapterStats(ch) {
    var total = ch.cards.length, seen = 0, mastered = 0, due = 0, fresh = 0, bad = 0;
    ch.cards.forEach(function (c) {
      var st = store.cards[c.id];
      if (!st) { fresh++; return; }
      if (st.reps > 0) seen++;
      if ((st.ivl || 0) >= 21) mastered++;
      if (st.due && st.due <= today()) due++;
      if ((st.lapses || 0) > 0) bad++;
    });
    return { total: total, seen: seen, mastered: mastered, due: due, fresh: fresh, bad: bad };
  }
  function subjectStats(s) {
    var t = { total: 0, seen: 0, mastered: 0, due: 0, fresh: 0 };
    (s.chapters || []).forEach(function (ch) {
      var st = chapterStats(ch);
      t.total += st.total; t.seen += st.seen; t.mastered += st.mastered;
      t.due += st.due; t.fresh += st.fresh;
    });
    t.pct = t.total ? Math.round(t.seen / t.total * 100) : 0;
    t.mPct = t.total ? Math.round(t.mastered / t.total * 100) : 0;
    return t;
  }
  function globalStats() {
    var t = { total: 0, seen: 0, mastered: 0, due: 0, fresh: 0, bad: 0 };
    allChapters().forEach(function (x) {
      var st = chapterStats(x.chapter);
      t.total += st.total; t.seen += st.seen; t.mastered += st.mastered;
      t.due += st.due; t.fresh += st.fresh; t.bad += st.bad;
    });
    return t;
  }
  function streakInfo() {
    var days = store.days, cur = 0, d = today();
    if (!days[d] || !days[d].n) d = addDays(today(), -1);
    while (days[d] && days[d].n > 0) { cur++; d = addDays(d, -1); }
    var best = cur;
    return { cur: cur, best: best };
  }
  function todayLog() { return store.days[today()] || { n: 0, ok: 0 }; }

  /* ============ 排期 ============ */
  function schedule(id, grade) {
    var st = store.cards[id] || { reps: 0, lapses: 0, ease: 2.4, ivl: 0, ok: 0, bad: 0 };
    st.reps = (st.reps || 0) + 1;
    if (grade === 0) {
      st.lapses = (st.lapses || 0) + 1;
      st.ivl = 1;
      st.ease = Math.max(1.4, (st.ease || 2.4) - 0.25);
    } else if (grade === 1) {
      st.ivl = (st.ivl || 0) < 1 ? 1 : Math.max(2, Math.round(st.ivl * 1.3));
      st.ease = Math.max(1.4, (st.ease || 2.4) - 0.05);
    } else {
      st.ivl = (st.ivl || 0) < 1 ? 3 : Math.min(240, Math.max(st.ivl + 2, Math.round(st.ivl * (st.ease || 2.4))));
      st.ease = Math.min(2.9, (st.ease || 2.4) + 0.08);
    }
    st.due = addDays(today(), st.ivl);
    st.last = grade;
    st.ts = today();
    if (grade >= 2) st.ok = (st.ok || 0) + 1; else st.bad = (st.bad || 0) + 1;
    store.cards[id] = st;

    var log = store.days[today()] || { n: 0, ok: 0 };
    log.n = (log.n || 0) + 1;
    if (grade >= 2) log.ok = (log.ok || 0) + 1;
    store.days[today()] = log;
    save();
  }

  function isDue(id) {
    var st = store.cards[id];
    return !!st && st.reps > 0 && st.due <= today();
  }
  function isNew(id) { return !store.cards[id]; }
  function weightedOrder(list) {
    // 星级加权随机排序：权重 = 星级²，高频考点更早出现但不会一直霸屏
    return list.map(function (x) {
      var w = Math.pow(x.card.stars || 3, 2);
      x._k = -Math.log(Math.random() + 1e-9) / w;
      return x;
    }).sort(function (a, b) { return a._k - b._k; });
  }
  function docOrder(list) {
    return list.slice().sort(function (a, b) {
      return (a.card.ord || 0) - (b.card.ord || 0);
    });
  }
  var OBJ_TYPES = ["tf", "mcq", "fill"];
  function pickBalanced(list, limit) {
    var obj = weightedOrder(list.filter(function (e) { return OBJ_TYPES.indexOf(e.card.type) >= 0; }));
    var sub = weightedOrder(list.filter(function (e) { return OBJ_TYPES.indexOf(e.card.type) < 0; }));
    var out = [], i = 0, j = 0;
    while (out.length < limit && (i < obj.length || j < sub.length)) {
      if (i < obj.length) out.push(obj[i++]);
      if (out.length < limit && j < sub.length) out.push(sub[j++]);
    }
    return out;
  }
  function entriesOf(chapter, subject) {
    return chapter.cards.map(function (c) { return { card: c, chapter: chapter, subject: subject }; });
  }
  var TYPE_LABEL = {
    tf: "判断", mcq: "选择", fill: "填空", term: "名词解释",
    short: "简答", calc: "计算", essay: "论述", point: "考点"
  };
  function keyOf(c) {
    if (c.key) return c.key.split("");
    return c.a.match(/[A-E]/g) || [];
  }

  function buildQueue(mode, opts) {
    var all = [];
    allChapters().forEach(function (x) { all = all.concat(entriesOf(x.chapter, x.subject)); });
    if (mode === "today") {
      var due = all.filter(function (e) { return isDue(e.card.id); });
      due = weightedOrder(due);
      var fresh = pickBalanced(all.filter(function (e) { return isNew(e.card.id); }), store.settings.dailyNew);
      return due.concat(fresh);
    }
    if (mode === "review") {
      return weightedOrder(all.filter(function (e) { return isDue(e.card.id); }));
    }
    if (mode === "new") {
      return pickBalanced(all.filter(function (e) { return isNew(e.card.id); }), store.settings.dailyNew);
    }
    if (mode === "chapter" || mode === "quick" || mode === "osec" || mode === "ssec" || mode === "points") {
      var ch = opts.chapter, sub = opts.subject;
      var list = entriesOf(ch, sub);
      var dueL = docOrder(list.filter(function (e) { return isDue(e.card.id); }));
      var newL = docOrder(list.filter(function (e) { return isNew(e.card.id); }));
      var rest = docOrder(list.filter(function (e) { return !isDue(e.card.id) && !isNew(e.card.id); }));
      if (mode === "quick") {
        return pickBalanced(dueL.concat(newL), opts.limit || 10);
      }
      return dueL.concat(newL, rest);
    }
    if (mode === "wrong") {
      var w = all.filter(function (e) {
        var st = store.cards[e.card.id];
        return st && ((st.lapses || 0) > 0 || st.last === 0);
      });
      w.sort(function (a, b) { return (store.cards[b.card.id].lapses || 0) - (store.cards[a.card.id].lapses || 0); });
      return w;
    }
    if (mode === "mixed") {
      var mix = [];
      var dues = weightedOrder(all.filter(function (e) { return isDue(e.card.id); }));
      mix = mix.concat(dues.slice(0, 10));
      var fresh2 = weightedOrder(all.filter(function (e) { return isNew(e.card.id); }));
      mix = mix.concat(fresh2.slice(0, (opts.limit || 30) - mix.length));
      return mix.slice(0, opts.limit || 30);
    }
    if (mode === "mock") {
      // 模拟卷：按题型配比抽 30 题，星级加权
      var pool = weightedOrder(all.filter(function (e) { return isNew(e.card.id); }));
      var want = { mcq: 10, tf: 8, fill: 6, term: 6 };
      var picked = [], ids = {};
      Object.keys(want).forEach(function (t) {
        var arr = pool.filter(function (e) { return e.card.type === t; });
        for (var i = 0; i < arr.length && picked.filter(function (p) { return p.card.type === t; }).length < want[t]; i++) {
          if (!ids[arr[i].card.id]) { picked.push(arr[i]); ids[arr[i].card.id] = 1; }
        }
      });
      return picked.slice(0, 30);
    }
    return all;
  }

  /* ============ 路由 ============ */
  var view = { name: "home" };
  var S = null; // session

  function go(name, params) {
    view = { name: name, params: params || {} };
    render();
    window.scrollTo({ top: 0 });
  }

  function render() {
    if (view.name === "home") app.innerHTML = renderHome();
    else if (view.name === "subject") app.innerHTML = renderSubject(view.params.sid);
    else if (view.name === "chapter") app.innerHTML = renderChapter(view.params.sid, view.params.cid);
    else if (view.name === "session") app.innerHTML = renderSessionView();
    else if (view.name === "result") app.innerHTML = renderResult();
    else if (view.name === "stats") app.innerHTML = renderStats();
    else if (view.name === "settings") app.innerHTML = renderSettings();
    else if (view.name === "wrong") app.innerHTML = renderWrong();
    else if (view.name === "import") app.innerHTML = renderImport();
    else app.innerHTML = renderHome();
    bindCommon();
    if (view.name === "session") bindSession();
  }

  /* ============ 首页 ============ */
  function renderHome() {
    var g = globalStats();
    var st = streakInfo();
    var log = todayLog();
    var target = Math.max(10, Math.min(g.due + Math.min(g.fresh, store.settings.dailyNew), 200));
    var ringP = Math.min(100, Math.round(log.n / target * 100));
    var d = new Date();
    var subCards = allSubjects.map(function (s) {
      var ss = subjectStats(s);
      return '<button class="subject-card" data-go="subject" data-sid="' + esc(s.id) + '" style="--sc:' + esc(s.color || "#2450e6") + '">' +
        '<span class="glow"></span>' +
        '<div class="sc-head"><span class="sc-name">' + esc(s.name) + '</span>' +
        (ss.due > 0 ? '<span class="pill warn">待复习 ' + ss.due + '</span>' : '') +
        '</div>' +
        '<p class="sc-meta">' + (s.chapters || []).length + ' 章 · ' + ss.total + ' 题 · 已练 ' + ss.seen + ' 题</p>' +
        '<div class="bar"><i style="width:' + ss.pct + '%"></i></div>' +
        '<div class="sc-foot"><span>进度 ' + ss.pct + '%</span><span>掌握 ' + ss.mPct + '%</span></div>' +
        '</button>';
    }).join("");

    return '<div class="wrap">' +
      '<div class="topbar"><div class="brandmark"><span class="logo">86</span><span class="name">866 刷题</span></div>' +
      '<span class="streak">🔥 ' + st.cur + ' 天</span></div>' +

      '<div class="hero">' +
      '<p class="greet">' + cnDate(d) + ' ' + WEEK[d.getDay()] + '</p>' +
      '<div class="hero-main"><div>' +
      '<h1 class="hero-title">' + (g.due > 0 ? '今天还有 <em>' + g.due + '</em> 题<br>等着复习' : (g.fresh > 0 ? '开一组<em>新题</em><br>保持手感' : '题库已刷完<br>去复习吧')) + '</h1>' +
      '<p class="hero-note">已完成 ' + log.n + ' 题 · 正确 ' + (log.ok || 0) + ' 题</p>' +
      '</div>' +
      '<div class="ring hero-ring" style="--p:' + ringP + '"><span><b>' + ringP + '%</b><i>今日目标</i></span></div>' +
      '</div>' +
      '<button class="btn primary block lg" data-go="start-today">开始今日学习</button>' +
      '</div>' +

      '<div class="section-title"><span class="h3">科目板块</span><span class="link" data-go="import">＋ 导入题库</span></div>' +
      '<div class="subjects">' + subCards + '</div>' +

      '<div class="section-title"><span class="h3">其他入口</span></div>' +
      '<div class="quick">' +
      '<button data-go="mixed"><span class="ico">🎲</span>随机 30 题</button>' +
      '<button data-go="mock"><span class="ico">🧾</span>模拟卷</button>' +
      '<button data-go="wrong"><span class="ico">📕</span>错题本<span class="num">' + g.bad + '</span></button>' +
      '<button data-go="stats"><span class="ico">📊</span>数据</button>' +
      '</div>' +

      '<div class="section-title"><span class="h3">学习概况</span><span class="link" data-go="settings">设置</span></div>' +
      '<div class="card"><div class="row between" style="margin-bottom:14px">' +
      '<div><div class="h2 mono">' + g.seen + '<span class="sub" style="font-size:14px"> / ' + g.total + '</span></div><p class="sub">题已练过</p></div>' +
      '<div style="text-align:right"><div class="h2 mono">' + g.mastered + '</div><p class="sub">已进入长期记忆</p></div>' +
      '</div><div class="bar" style="--sc:var(--brand)"><i style="width:' + (g.total ? g.seen / g.total * 100 : 0) + '%;background:var(--brand)"></i></div></div>' +
      '</div>';
  }

  /* ============ 科目 ============ */
  function renderSubject(sid) {
    var s = findSubject(sid);
    if (!s) return renderHome();
    var ss = subjectStats(s);
    var rows = (s.chapters || []).map(function (ch) {
      var st = chapterStats(ch);
      var pct = st.total ? Math.round(st.seen / st.total * 100) : 0;
      var imp = Math.round(ch.imp || 0);
      return '<button class="chapter-item" data-go="chapter" data-sid="' + esc(sid) + '" data-cid="' + esc(ch.id) + '">' +
        '<span class="ch-no">' + (ch.no < 10 ? "0" + ch.no : ch.no) + '</span>' +
        '<span class="ch-main"><span class="ch-name">' + esc(ch.title || ch.name) +
        '<span class="stars">' + stars(imp) + '</span>' +
        (ch.hot >= 6 ? '<span class="pill warn" style="height:19px;padding:0 6px;font-size:10.5px">高频 ' + ch.hot + '</span>' : '') +
        '</span>' +
        '<span class="ch-sub"><span>' + ch.cards.length + ' 题</span><span>掌握 ' + st.mastered + '</span>' +
        (st.due ? '<span style="color:var(--warn)">待复习 ' + st.due + '</span>' : '') + '</span>' +
        '<div class="bar ch-bar" style="--sc:' + esc(s.color) + '"><i style="width:' + pct + '%"></i></div></span>' +
        '<span class="ch-pct">' + pct + '%</span></button>';
    }).join("");

    return '<div class="wrap">' +
      '<div class="subhead"><button class="back" data-go="home">‹</button><div class="grow">' +
      '<div class="h1" style="font-size:26px">' + esc(s.name) + '</div>' +
      '<p class="sub">' + s.chapters.length + ' 章 · ' + ss.total + ' 题 · 已练 ' + ss.seen + ' 题</p></div></div>' +
      '<div class="card" style="margin-bottom:6px">' +
      '<div class="row between" style="margin-bottom:12px"><span class="pill brand">科目进度 ' + ss.pct + '%</span>' +
      (ss.due ? '<span class="pill warn">待复习 ' + ss.due + '</span>' : '<span class="pill ok">暂无到期</span>') + '</div>' +
      '<div class="bar" style="--sc:' + esc(s.color) + '"><i style="width:' + ss.pct + '%"></i></div></div>' +
      '<div class="section-title"><span class="h3">章节</span></div>' +
      '<div class="chapter-list">' + rows + '</div>' +
      '</div>';
  }

  /* ============ 章节 ============ */
  function renderChapter(sid, cid) {
    var s = findSubject(sid), ch = findChapter(sid, cid);
    if (!ch) return renderHome();
    var st = chapterStats(ch);
    var pct = st.total ? Math.round(st.seen / st.total * 100) : 0;
    var types = {};
    ch.cards.forEach(function (c) { types[c.type] = (types[c.type] || 0) + 1; });
    var points = types.point || 0;
    var typeLine = Object.keys(types).filter(function (t) { return t !== "point"; })
      .map(function (t) { return TYPE_LABEL[t] + " " + types[t]; }).join(" · ");

    return '<div class="wrap">' +
      '<div class="subhead"><button class="back" data-go="subject" data-sid="' + esc(sid) + '">‹</button>' +
      '<div class="grow"><div class="h1" style="font-size:25px">' + esc(ch.title || ch.name) + '</div>' +
      '<p class="sub">' + esc(s.name) + ' · 第 ' + ch.no + ' 章 · ' + ch.cards.length + ' 题</p></div></div>' +

      '<div class="card"><div class="row between" style="margin-bottom:12px">' +
      '<span class="pill brand">已练 ' + st.seen + ' / ' + st.total + '</span>' +
      '<span class="pill ok">掌握 ' + st.mastered + '</span>' +
      (st.due ? '<span class="pill warn">待复习 ' + st.due + '</span>' : '') + '</div>' +
      '<div class="bar" style="--sc:' + esc(s.color) + '"><i style="width:' + pct + '%"></i></div>' +
      '<p class="sub" style="margin-top:12px">' + typeLine + '</p></div>' +

      '<div class="section-title"><span class="h3">开始练习</span></div>' +
      '<div class="card" style="display:grid;gap:10px;padding:16px">' +
      '<button class="btn primary block" data-session="chapter" data-sid="' + esc(sid) + '" data-cid="' + esc(ch.id) + '">全章顺序刷 · ' + ch.cards.length + ' 题</button>' +
      '<button class="btn block" data-session="quick" data-sid="' + esc(sid) + '" data-cid="' + esc(ch.id) + '">速刷 10 题</button>' +
      '<div class="row" style="gap:10px">' +
      '<button class="btn block sm" data-session="osec" data-sid="' + esc(sid) + '" data-cid="' + esc(ch.id) + '">只刷客观题</button>' +
      '<button class="btn block sm" data-session="ssec" data-sid="' + esc(sid) + '" data-cid="' + esc(ch.id) + '">只刷主观题</button>' +
      '</div>' +
      (points ? '<button class="btn block sm" data-session="points" data-sid="' + esc(sid) + '" data-cid="' + esc(ch.id) + '">考点速记 · ' + points + ' 个考点</button>' : '') +
      '</div>' +

      (ch.reading && ch.reading.length ?
        '<div class="section-title"><span class="h3">本章复习资料</span><span class="link" data-toggle="reading">展开</span></div>' +
        '<div id="reading" data-open="0" style="display:none"><div class="card reading">' +
        ch.reading.slice(0, 80).map(function (p) {
          if (/^[一二三四五六七八九十]、/.test(p)) return '<h4>' + esc(p) + '</h4>';
          return '<p>' + esc(p) + '</p>';
        }).join("") +
        '</div></div>'
        : "") +
      '</div>';
  }

  /* ============ 练习 ============ */
  function startSession(mode, opts) {
    opts = opts || {};
    var queue = buildQueue(mode, opts);
    if (!queue.length) { toast("这里暂时没有可练的题"); return; }
    if (mode === "osec") queue = queue.filter(function (e) { return OBJ_TYPES.indexOf(e.card.type) >= 0; });
    if (mode === "ssec") queue = queue.filter(function (e) { return ["term", "short", "calc", "essay"].indexOf(e.card.type) >= 0; });
    if (mode === "points") queue = queue.filter(function (e) { return e.card.type === "point"; });
    if (!queue.length) { toast("这里暂时没有可练的题"); return; }
    S = {
      queue: queue, i: 0, results: [], start: Date.now(),
      answered: false, grade: null, selected: [], revealed: false, mode: mode, title: opts.title
    };
    go("session");
  }

  function cur() { return S ? S.queue[S.i] : null; }

  function renderSessionView() {
    if (!S) return renderHome();
    var e = cur();
    if (!e) return renderResult();
    var c = e.card;
    var total = S.queue.length;
    var okN = S.results.filter(function (r) { return r.grade >= 2; }).length;
    var badN = S.results.filter(function (r) { return r.grade === 0; }).length;

    return '<div class="session">' +
      '<div class="s-top"><div class="s-meta">' +
      '<button class="btn ghost sm" data-exit="1">退出</button>' +
      '<span class="s-count">' + (S.i + 1) + ' / ' + total + '</span>' +
      '<span class="s-correct"><span class="dot-ok"></span>' + okN + '<span class="dot-bad" style="margin-left:6px"></span>' + badN + '</span>' +
      '</div><div class="s-progress"><i style="width:' + (S.i / total * 100) + '%"></i></div></div>' +

      '<div class="q-card" id="qcard">' +
      '<div class="q-tags"><span class="pill">' + TYPE_LABEL[c.type] + '</span>' +
      '<span class="pill">' + esc(e.chapter.title || e.chapter.name) + '</span>' +
      (c.src === "真题" ? '<span class="pill bad">真题</span>' : '') +
      (c.stars >= 4 ? '<span class="pill warn">' + stars(c.stars) + '</span>' : '') +
      '</div>' +
      '<div class="q-stem">' + formatStem(c.q) + '</div>' +
      padHtml() +
      (["term", "short", "calc", "essay", "fill", "point"].indexOf(c.type) >= 0 && !S.revealed && !S.answered
        ? '<p class="q-hint">在手写板上写出要点，再对照参考答案自评</p>' : "") +
      answerArea(c) +
      (c.type === "tf" && !S.answered ? '<p class="q-hint">判断对错，点一下即判分</p>' : "") +
      (c.type === "mcq" && !(S.answered || S.revealed) ? (
        keyOf(c).length > 1 ? '<p class="q-hint">多选题，选完后点提交</p>' : '<p class="q-hint">点选项即判分</p>'
      ) : "") +
      (S.revealed && !S.answered ? '<div class="answer-reveal"><span class="lab">参考答案</span>' + esc(c.a) + '</div>' : "") +
      (S.answered ? feedbackHtml(c) : "") +
      '</div>' +

      '<div class="s-actions" id="actions">' + actionsHtml(c) + '</div></div>';
  }

  function formatStem(q) {
    var t = esc(q);
    t = t.replace(/＿{2,}/g, '<span class="blank"></span>');
    return t;
  }

  /* ============ 手写答题板 ============ */
  var PAD = { color: "#111827", width: 2.2 };
  var PAD_COLORS = ["#111827", "#1D4ED8", "#DC2626"];
  var PAD_WIDTHS = [[1.6, "细"], [2.8, "中"], [5, "粗"]];

  function padCardId() { var e = cur(); return e ? e.card.id : ""; }

  function padHtml() {
    if (store.settings.pad === false) return "";
    var open = S.padOpen !== false;
    return '<div class="pad' + (open ? "" : " off") + (S.padFull ? " full" : "") + '" id="pad">' +
      '<div class="pad-bar">' +
      '<span class="pad-title"><i class="pad-ico">✎</i>手写答题区</span>' +
      '<div class="pad-tools">' +
      PAD_COLORS.map(function (c) {
        return '<button class="pad-dot' + (PAD.color === c ? " on" : "") + '" data-padcolor="' + c + '" style="--c:' + c + '" aria-label="笔色"></button>';
      }).join("") +
      PAD_WIDTHS.map(function (w) {
        return '<button class="pad-btn' + (PAD.width === w[0] ? " on" : "") + '" data-padw="' + w[0] + '">' + w[1] + '</button>';
      }).join("") +
      '<button class="pad-btn" data-padundo="1">撤销</button>' +
      '<button class="pad-btn" data-padclear="1">清空</button>' +
      '<button class="pad-btn" data-padfull="1">' + (S.padFull ? "退出全屏" : "全屏") + '</button>' +
      '<button class="pad-btn" data-padtoggle="1">' + (open ? "收起" : "展开") + '</button>' +
      '</div></div>' +
      '<div class="pad-body"><canvas id="padCanvas"></canvas></div></div>';
  }

  function mountPad() {
    var cv = document.getElementById("padCanvas");
    if (!cv || !S) return;
    var cid = padCardId();
    if (!S.pad) S.pad = {};
    var strokes = S.pad[cid] || (S.pad[cid] = []);
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var drawingId = null, act = null;

    function ctxA() {
      var x = cv.getContext("2d");
      x.lineCap = "round"; x.lineJoin = "round";
      return x;
    }
    function paint(s) {
      var x = ctxA();
      x.strokeStyle = s.color; x.lineWidth = s.w;
      if (s.pts.length < 2) {
        var p = s.pts[0];
        if (p) { x.fillStyle = s.color; x.beginPath(); x.arc(p[0], p[1], s.w / 2, 0, 6.2832); x.fill(); }
        return;
      }
      x.beginPath(); x.moveTo(s.pts[0][0], s.pts[0][1]);
      for (var i = 1; i < s.pts.length; i++) x.lineTo(s.pts[i][0], s.pts[i][1]);
      x.stroke();
    }
    function clearAll() {
      var x = cv.getContext("2d");
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, cv.width, cv.height);
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function redraw() { clearAll(); ctxA(); strokes.forEach(paint); }
    function fit() {
      var r = cv.getBoundingClientRect();
      var w = r.width, h = r.height;
      if (w < 2 || h < 2) {
        var p = cv.parentNode;
        w = p ? p.clientWidth : 0;
        h = p ? p.clientHeight : 0;
      }
      if (w < 2 || h < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      redraw();
    }
    function pos(ev) {
      var r = cv.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    }

    cv.addEventListener("pointerdown", function (ev) {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      if (drawingId !== null) return;
      if (cv.width < 2) fit();
      else {
        var r0 = cv.getBoundingClientRect();
        if (Math.abs(cv.width - Math.round(r0.width * dpr)) > 2 ||
            Math.abs(cv.height - Math.round(r0.height * dpr)) > 2) fit();
      }
      ev.preventDefault();
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      drawingId = ev.pointerId;
      act = { color: PAD.color, w: PAD.width, pts: [pos(ev)] };
      strokes.push(act);
      paint(act);
    });
    cv.addEventListener("pointermove", function (ev) {
      if (drawingId !== ev.pointerId || !act) return;
      ev.preventDefault();
      var pts = (ev.getCoalescedEvents && ev.getCoalescedEvents()) || [];
      if (!pts.length) pts = [ev];
      var x = ctxA();
      x.strokeStyle = act.color; x.lineWidth = act.w;
      pts.forEach(function (e2) {
        var p = pos(e2);
        var q = act.pts[act.pts.length - 1];
        if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 1.2) return;
        x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(p[0], p[1]); x.stroke();
        act.pts.push(p);
      });
    });
    function end(ev) {
      if (drawingId !== ev.pointerId) return;
      drawingId = null; act = null;
    }
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("touchstart", function (ev) { ev.preventDefault(); }, { passive: false });

    S.padCtl = { strokes: strokes, redraw: redraw, fit: fit };
    fit();
    if (window.ResizeObserver) {
      if (S.padRO) S.padRO.disconnect();
      S.padRO = new ResizeObserver(function () { fit(); });
      S.padRO.observe(cv.parentNode);
    }
  }

  function answerArea(c) {
    if (c.type === "mcq") {
      var multi = keyOf(c).length > 1;
      return '<div class="options" id="options">' + (c.options || []).map(function (o, i) {
        var letter = "ABCDE"[i];
        var cls = "";
        if (S.answered || S.revealed) {
          var right = keyOf(c).indexOf(letter) >= 0;
          var picked = S.selected.indexOf(letter) >= 0;
          if (right) cls = "right";
          else if (picked) cls = "wrong";
          else cls = "dim";
        } else if (S.selected.indexOf(letter) >= 0) cls = "sel";
        return '<button class="option ' + cls + '" data-opt="' + letter + '"' + ((S.answered || S.revealed) ? " disabled" : "") + '>' +
          '<span class="key">' + letter + '</span><span>' + esc(o) + '</span></button>';
      }).join("") + '</div>' +
        (multi ? '<p class="q-hint">本题为多选，可点选多个选项后提交</p>' : "");
    }
    if (c.type === "tf") {
      var v = S.answered ? c.verdict : null;
      return '<div class="tf-row">' +
        ['对', '错'].map(function (t) {
          var cls = "";
          if (S.answered) {
            if (c.verdict === t) cls = "right";
            else if (S.picked === t) cls = "wrong";
          }
          return '<button class="tf-btn ' + cls + '" data-tf="' + t + '"' + (S.answered ? " disabled" : "") + '>' + t + '</button>';
        }).join("") + '</div>';
    }
    if (c.type === "fill") {
      return '<div class="fill-box"><textarea class="code-area" id="fillInput" placeholder="在这里默写（可选）" style="min-height:92px"></textarea></div>';
    }
    return "";
  }

  function actionsHtml(c) {
    if (S.answered) {
      return '<button class="btn primary block lg" data-next="1">下一题</button>';
    }
    if (S.revealed) {
      return '<div class="rate-row">' +
        '<button class="rate g0" data-rate="0">不会<small>重来</small></button>' +
        '<button class="rate g1" data-rate="1">模糊<small>再见一次</small></button>' +
        '<button class="rate g2" data-rate="2">记住了<small>推进</small></button>' +
        '</div>';
    }
    if (c.type === "mcq") {
      var multi = keyOf(c).length > 1;
      if (multi) return '<button class="btn primary block lg" data-submit="1">提交答案</button>';
      return "";
    }
    if (c.type === "tf") return "";
    return '<button class="btn primary block lg" data-reveal="1">显示答案</button>';
  }

  function bindPad() {
    var padEl = document.getElementById("pad");
    if (!padEl) return;
    padEl.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-padcolor],[data-padw],[data-padundo],[data-padclear],[data-padfull],[data-padtoggle]");
      if (!t) return;
      ev.preventDefault();
      if (t.hasAttribute("data-padcolor")) {
        PAD.color = t.getAttribute("data-padcolor");
        padEl.querySelectorAll("[data-padcolor]").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute("data-padcolor") === PAD.color);
        });
        return;
      }
      if (t.hasAttribute("data-padw")) {
        PAD.width = parseFloat(t.getAttribute("data-padw"));
        padEl.querySelectorAll("[data-padw]").forEach(function (b) {
          b.classList.toggle("on", parseFloat(b.getAttribute("data-padw")) === PAD.width);
        });
        return;
      }
      if (t.hasAttribute("data-padundo")) {
        if (S.padCtl && S.padCtl.strokes.length) { S.padCtl.strokes.pop(); S.padCtl.redraw(); }
        return;
      }
      if (t.hasAttribute("data-padclear")) {
        if (S.padCtl && S.padCtl.strokes.length && confirm("清空这一题的笔迹？")) {
          S.padCtl.strokes.length = 0; S.padCtl.redraw();
        }
        return;
      }
      if (t.hasAttribute("data-padtoggle")) {
        S.padOpen = (S.padOpen === false);
        render();
        return;
      }
      if (t.hasAttribute("data-padfull")) {
        S.padFull = !S.padFull;
        render();
        return;
      }
    });
    mountPad();
  }

  function bindSession() {
    bindPad();
    var card = document.getElementById("qcard");
    if (!card) return;
    card.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-opt]");
      if (t && !S.answered) {
        var letter = t.getAttribute("data-opt");
        var c = cur().card;
        var multi = keyOf(c).length > 1;
        if (multi) {
          var idx = S.selected.indexOf(letter);
          if (idx >= 0) S.selected.splice(idx, 1); else S.selected.push(letter);
          render();
        } else {
          S.selected = [letter];
          judgeMCQ();
        }
        return;
      }
      var tf = ev.target.closest("[data-tf]");
      if (tf && !S.answered) { S.picked = tf.getAttribute("data-tf"); judgeTF(); return; }
    });

    var actions = document.getElementById("actions");
    if (!actions) return;
    actions.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-next]")) { nextCard(); return; }
      if (ev.target.closest("[data-reveal]")) { S.revealed = true; render(); return; }
      if (ev.target.closest("[data-submit]")) {
        var c = cur().card;
        if (c.type === "mcq") judgeMCQ();
        return;
      }
      var r = ev.target.closest("[data-rate]");
      if (r) { finishRate(+r.getAttribute("data-rate")); return; }
    });
  }

  function feedbackHtml(c) {
    var ok = S.grade >= 2;
    var cls = ok ? "good" : (S.grade === 1 ? "warn" : "bad");
    var title = ok ? "✓ 答对了" : (S.grade === 1 ? "≈ 记个大概" : "✕ 答错了");
    var extra = "";
    if (c.type === "tf") {
      extra = '<div class="fb-body" style="font-weight:650;margin-bottom:6px">正确答案：' + esc(c.verdict) + '</div>';
    }
    return '<div class="feedback ' + cls + '"><div class="fb-title">' + title + '</div>' +
      extra + '<div class="fb-body">' + esc(c.a) + '</div></div>';
  }

  function record(grade) {
    var c = cur().card, e = cur();
    S.grade = grade;
    S.results.push({ id: c.id, q: c.q, a: c.a, grade: grade, type: c.type, chapter: e.chapter.title || e.chapter.name });
    schedule(c.id, grade);
  }

  function judgeMCQ() {
    var c = cur().card;
    var correct = keyOf(c);
    var picked = S.selected;
    var ok = correct.length > 0 && correct.every(function (x) { return picked.indexOf(x) >= 0; }) && picked.length === correct.length;
    S.answered = true;
    record(ok ? 2 : 0);
    render();
    scrollToFeedback();
  }

  function judgeTF() {
    var c = cur().card;
    S.answered = true;
    record(S.picked === c.verdict ? 2 : 0);
    render();
    scrollToFeedback();
  }

  function finishRate(grade) {
    record(grade);
    nextCard();
  }

  function scrollToFeedback() {
    setTimeout(function () {
      var fb = document.querySelector(".feedback");
      if (!fb) return;
      var bottom = fb.getBoundingClientRect().bottom;
      var h = window.innerHeight;
      if (bottom > h - 20) {
        window.scrollBy({ top: bottom - h + 100, behavior: "smooth" });
      }
    }, 60);
  }

  function scrollToFeedback() {
    var fb = document.querySelector(".feedback");
    if (fb) {
      var y = fb.getBoundingClientRect().bottom + window.scrollY;
      var h = window.innerHeight;
      if (y > h - 60) window.scrollTo({ top: window.scrollY + (y - h + 120), behavior: "smooth" });
    }
  }

  function nextCard() {
    S.i++;
    S.answered = false; S.grade = null; S.selected = [];
    S.revealed = false; S.picked = null;
    if (S.i >= S.queue.length) { go("result"); return; }
    render();
    window.scrollTo({ top: 0 });
  }

  /* ============ 结果 ============ */
  function renderResult() {
    if (!S) return renderHome();
    var total = S.results.length || 1;
    var good = S.results.filter(function (r) { return r.grade >= 2; }).length;
    var blur = S.results.filter(function (r) { return r.grade === 1; }).length;
    var bad = S.results.filter(function (r) { return r.grade === 0; }).length;
    var acc = Math.round(good / total * 100);
    var mins = Math.max(1, Math.round((Date.now() - S.start) / 60000));
    var msg = acc >= 85 ? "这轮很稳，继续保持" : acc >= 60 ? "有进步，把错的再过一遍" : "别急，先弄懂再刷";
    var wrongList = S.results.filter(function (r) { return r.grade < 2; });
    var y = total ? Math.round(good / total * 100) : 0;

    return '<div class="wrap"><div class="card result-hero">' +
      '<div class="big">' + acc + '<small>%</small></div>' +
      '<div class="msg">' + msg + '</div>' +
      '<p class="sub">共 ' + S.results.length + ' 题 · 用时 ' + mins + ' 分钟</p>' +
      '<div class="stat-grid" style="margin-top:20px">' +
      '<div class="stat"><b style="color:var(--ok)">' + good + '</b><span>记住了</span></div>' +
      '<div class="stat"><b style="color:var(--warn)">' + blur + '</b><span>模糊</span></div>' +
      '<div class="stat"><b style="color:var(--bad)">' + bad + '</b><span>不会</span></div>' +
      '</div></div>' +

      (wrongList.length ?
        '<div class="section-title"><span class="h3">需要回头看（' + wrongList.length + '）</span></div>' +
        '<div class="review-list">' + wrongList.map(function (r) {
          return '<div class="review-item"><div class="rq">' + esc(r.q) + '</div>' +
            '<div class="ra"><span class="rbad">答案：</span>' + esc(r.a) + '</div></div>';
        }).join("") + '</div>' : "") +

      '<div class="s-actions" style="position:static;margin-top:18px">' +
      '<button class="btn primary block lg" data-go="home">回到首页</button>' +
      (wrongList.length ? '<button class="btn block" data-go="wrong">去刷错题本</button>' : '') +
      '</div></div>';
  }

  /* ============ 错题 ============ */
  function renderWrong() {
    var rows = [];
    allChapters().forEach(function (x) {
      x.chapter.cards.forEach(function (c) {
        var st = store.cards[c.id];
        if (st && ((st.lapses || 0) > 0 || st.last === 0)) {
          rows.push({ c: c, ch: x.chapter, st: st });
        }
      });
    });
    rows.sort(function (a, b) { return (b.st.lapses || 0) - (a.st.lapses || 0); });

    return '<div class="wrap"><div class="subhead"><button class="back" data-go="home">‹</button>' +
      '<div class="grow"><div class="h1" style="font-size:26px">错题本</div>' +
      '<p class="sub">' + rows.length + ' 题待攻克</p></div></div>' +
      (rows.length ? '<button class="btn primary block lg" data-session="wrong" style="margin-bottom:16px">开始重练（' + rows.length + ' 题）</button>' : '') +
      '<div class="review-list">' + rows.slice(0, 200).map(function (r) {
        return '<div class="review-item"><div class="q-tags"><span class="pill">' + TYPE_LABEL[r.c.type] + '</span>' +
          '<span class="pill">' + esc(r.ch.title) + '</span>' +
          '<span class="pill bad">错 ' + (r.st.lapses || 1) + ' 次</span></div>' +
          '<div class="rq">' + esc(r.c.q) + '</div>' +
          '<div class="ra"><span class="rbad">答案：</span>' + esc(r.c.a) + '</div></div>';
      }).join("") + '</div></div>';
  }

  /* ============ 统计 ============ */
  function renderStats() {
    var g = globalStats();
    var st = streakInfo();
    var cells = "";
    for (var i = 29; i >= 0; i--) {
      var k = addDays(today(), -i);
      var n = (store.days[k] && store.days[k].n) || 0;
      var lv = n === 0 ? "" : n < 8 ? "l1" : n < 20 ? "l2" : n < 40 ? "l3" : "l4";
      cells += '<div class="cell ' + lv + '" title="' + k + '：' + n + ' 题"></div>';
    }
    var bars = allChapters().map(function (x) {
      var cs = chapterStats(x.chapter);
      var pct = cs.total ? Math.round(cs.mastered / cs.total * 100) : 0;
      return '<div class="brow"><span class="nm">' + esc(x.chapter.title) + '</span>' +
        '<span class="bar" style="--sc:' + esc(x.subject.color) + '"><i style="width:' + pct + '%"></i></span>' +
        '<span class="pc">' + pct + '%</span></div>';
    }).join("");

    return '<div class="wrap"><div class="subhead"><button class="back" data-go="home">‹</button>' +
      '<div class="grow"><div class="h1" style="font-size:26px">学习数据</div>' +
      '<p class="sub">连续 ' + st.cur + ' 天 · 累计 ' + Object.keys(store.days).length + ' 天有记录</p></div></div>' +
      '<div class="stat-grid" style="grid-template-columns:repeat(2,1fr)">' +
      '<div class="stat"><b>' + g.total + '</b><span>题库总题</span></div>' +
      '<div class="stat"><b style="color:var(--brand)">' + g.seen + '</b><span>已练过</span></div>' +
      '<div class="stat"><b style="color:var(--ok)">' + g.mastered + '</b><span>长期掌握</span></div>' +
      '<div class="stat"><b style="color:var(--bad)">' + g.bad + '</b><span>错题待攻</span></div>' +
      '</div>' +
      '<div class="section-title"><span class="h3">最近 30 天</span></div>' +
      '<div class="card"><div class="heatmap">' + cells + '</div>' +
      '<p class="sub" style="margin-top:12px">颜色越深表示当天刷题越多</p></div>' +
      '<div class="section-title"><span class="h3">各章掌握度</span></div>' +
      '<div class="card bars">' + bars + '</div></div>';
  }

  /* ============ 设置 ============ */
  function renderSettings() {
    var s = store.settings;
    return '<div class="wrap"><div class="subhead"><button class="back" data-go="home">‹</button>' +
      '<div class="grow"><div class="h1" style="font-size:26px">设置</div>' +
      '<p class="sub">数据保存在本机（Safari 本地存储）</p></div></div>' +

      '<div class="list">' +
      '<div class="li"><div class="l-main"><b>每日新题上限</b><span>每天自动推送的新题数量</span></div>' +
      '<div class="stepper"><button data-step="-10">−</button><span class="val" id="newVal">' + s.dailyNew + '</span><button data-step="10">＋</button></div></div>' +
      '<div class="li"><div class="l-main"><b>外观</b><span>跟随系统或固定深浅色</span></div>' +
      '<div class="seg" id="themeSeg">' +
      ['auto', 'light', 'dark'].map(function (t) {
        var label = t === "auto" ? "自动" : t === "light" ? "浅色" : "深色";
        return '<button data-theme="' + t + '" class="' + (s.theme === t ? "on" : "") + '">' + label + '</button>';
      }).join("") + '</div></div>' +
      '<div class="li"><div class="l-main"><b>手写答题板</b><span>每题下方显示画板，手指或 Apple Pencil 都能写</span></div>' +
      '<button class="btn sm" data-act="pad">' + (s.pad === false ? "已关闭" : "已开启") + '</button></div>' +
      '</div>' +

      '<div class="section-title"><span class="h3">数据</span></div>' +
      '<div class="list">' +
      '<div class="li"><div class="l-main"><b>导出备份</b><span>生成 JSON 文件，可换设备导入</span></div>' +
      '<button class="btn sm" data-act="export">导出</button></div>' +
      '<div class="li"><div class="l-main"><b>导入题库</b><span>新增科目板块或补充题目</span></div>' +
      '<button class="btn sm" data-go="import">去导入</button></div>' +
      '<div class="li"><div class="l-main"><b>清空学习进度</b><span>题库保留，只清除记录</span></div>' +
      '<button class="btn sm" data-act="reset" style="color:var(--bad)">清空</button></div>' +
      '</div>' +

      '<p class="sub" style="margin-top:18px;text-align:center">866 刷题 · 本地优先 · 无账号 · 无联网要求</p>' +
      '</div>';
  }

  /* ============ 导入 ============ */
  function renderImport() {
    return '<div class="wrap"><div class="subhead"><button class="back" data-go="home">‹</button>' +
      '<div class="grow"><div class="h1" style="font-size:26px">导入题库</div>' +
      '<p class="sub">新增一个科目板块，或给已有科目补题</p></div></div>' +

      '<div class="card" style="display:grid;gap:12px">' +
      '<div class="drop"><b>选择 JSON 文件</b>也可以直接粘贴到下面<br>' +
      '<input type="file" id="fileInput" accept=".json,application/json" style="margin-top:12px"></div>' +
      '<textarea class="code-area" id="importText" placeholder="粘贴 JSON，例如：{&quot;name&quot;:&quot;材料力学&quot;,&quot;cards&quot;:[{&quot;type&quot;:&quot;mcq&quot;,&quot;q&quot;:&quot;...&quot;,&quot;options&quot;:[&quot;...&quot;],&quot;a&quot;:&quot;B&quot;}]}"></textarea>' +
      '<button class="btn primary block lg" data-act="import">导入</button>' +
      '</div>' +

      '<div class="section-title"><span class="h3">支持的格式</span><span class="link" data-act="sample">填入示例</span></div>' +
      '<div class="card"><p class="sub" style="line-height:1.8;color:var(--text-2)">' +
      '<b>1. 单科题库</b><br>{"name":"材料力学","cards":[...]}<br><br>' +
      '<b>2. 多科目</b><br>{"subjects":[{"name":"科目A","chapters":[{"name":"第一章","cards":[...]}]}]}<br><br>' +
      '<b>3. 纯题目数组</b><br>[{"q":"题干","a":"答案","type":"mcq","options":["A项","B项"],"a":"B"}]<br><br>' +
      'type 可选：tf 判断 / mcq 选择 / fill 填空 / term 名词解释 / short 简答 / calc 计算 / essay 论述。' +
      '选择题答案用字母（多选写 B、D）；判断题写 verdict 为「对」或「错」。' +
      '</p></div>' +

      '<div class="section-title"><span class="h3">已导入的板块</span></div>' +
      '<div class="list" id="customList">' +
      ((store.custom || []).length ? store.custom.map(function (s) {
        return '<div class="li"><div class="l-main"><b>' + esc(s.name) + '</b><span>' +
          (s.chapters || []).length + ' 章 · ' + (s.chapters || []).reduce(function (a, c) { return a + (c.cards || []).length; }, 0) + ' 题</span></div>' +
          '<button class="btn sm" data-del="' + esc(s.id) + '" style="color:var(--bad)">删除</button></div>';
      }).join("") : '<div class="li"><div class="l-main"><span>还没有导入过自定义题库</span></div></div>') +
      '</div></div>';
  }

  function doImport(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { toast("JSON 格式有误"); return; }
    if (!data) { toast("没认出这个格式"); return; }
    // 备份恢复：{v, cards:{...}, days:{...}}
    if (data.v && data.cards && !Array.isArray(data.cards)) {
      if (!confirm("这是学习进度备份，恢复后会覆盖当前进度，继续？")) return;
      store.cards = data.cards || {};
      store.days = data.days || {};
      store.settings = Object.assign(store.settings, data.settings || {});
      store.custom = data.custom || [];
      save(); rebuildIndex(); toast("已恢复学习进度"); go("home"); return;
    }
    var subjects = [];
    if (data && data.subjects) subjects = data.subjects;
    else if (data && Array.isArray(data.cards)) subjects = [{ name: data.name || "自定义题库", cards: data.cards }];
    else if (Array.isArray(data)) subjects = [{ name: "自定义题库", cards: data }];
    else if (data && data.chapters) subjects = [data];
    else { toast("没认出这个格式"); return; }

    var added = 0;
    subjects.forEach(function (s, si) {
      var sid = "custom" + Date.now() + si;
      var chapters = s.chapters || [{ name: s.name || "全部题目", cards: s.cards || [] }];
      var total = 0;
      chapters = chapters.map(function (ch, ci) {
        var cards = (ch.cards || []).map(function (c, i) {
          total++;
          var type = c.type || "short";
          var item = {
            id: sid + "-" + ci + "-" + i,
            type: type, q: c.q || c.question || "", a: c.a || c.answer || "",
            stars: c.stars || 3, sec: c.sec || "", num: i + 1
          };
          if (c.options) item.options = c.options;
          if (c.verdict) item.verdict = c.verdict;
          return item;
        });
        return { id: sid + "-c" + ci, no: ci + 1, name: ch.name || "第" + (ci + 1) + "章", title: ch.name || "第" + (ci + 1) + "章", cards: cards, reading: ch.reading || [] };
      });
      if (!total) return;
      store.custom.push({
        id: sid, name: s.name || "自定义题库", short: "自", color: s.color || "#0F766E",
        chapters: chapters
      });
      added += total;
    });
    save();
    rebuildIndex();
    toast("已导入 " + added + " 题");
    go("import");
  }

  function exportData() {
    var text = JSON.stringify(store, null, 1);
    try {
      var blob = new Blob([text], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "866刷题备份-" + today() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
    showSheet("备份数据", text);
  }

  function showSheet(title, text) {
    var wrap = document.createElement("div");
    wrap.className = "sheet-back";
    wrap.innerHTML = '<div class="sheet"><div class="row between" style="margin-bottom:12px">' +
      '<div class="h2">' + esc(title) + '</div>' +
      '<button class="btn ghost sm" data-close="1">关闭</button></div>' +
      '<p class="sub" style="margin-bottom:10px">iPad 上如果没弹出下载，点「复制」把这段文本存到备忘录里。</p>' +
      '<textarea class="code-area" readonly>' + esc(text) + '</textarea>' +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<button class="btn primary block" data-copy="1">复制</button>' +
      '<button class="btn block" data-close="1">关闭</button></div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-close]")) { wrap.remove(); return; }
      if (ev.target.closest("[data-copy]")) {
        var ta = wrap.querySelector("textarea");
        ta.select(); ta.setSelectionRange(0, ta.value.length);
        var done = function () { toast("已复制"); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () { document.execCommand("copy"); done(); });
        } else { document.execCommand("copy"); done(); }
      }
    });
  }

  /* ============ 事件 ============ */
  function bindCommon() {
    document.body.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () {
        var to = el.getAttribute("data-go");
        if (to === "start-today") { startSession("today", {}); return; }
        if (to === "mixed") { startSession("mixed", { limit: 30 }); return; }
        if (to === "mock") { startSession("mock", { limit: 30 }); return; }
        go(to, { sid: el.getAttribute("data-sid"), cid: el.getAttribute("data-cid") });
      });
    });

    document.body.querySelectorAll("[data-session]").forEach(function (el) {
      el.addEventListener("click", function () {
        var mode = el.getAttribute("data-session");
        var sid = el.getAttribute("data-sid"), cid = el.getAttribute("data-cid");
        var ch = cid ? findChapter(sid, cid) : null;
        var sub = sid ? findSubject(sid) : null;
        if ((mode === "chapter" || mode === "quick" || mode === "osec" || mode === "ssec" || mode === "points") && ch) {
          startSession(mode, { chapter: ch, subject: sub });
        } else {
          startSession(mode, {});
        }
      });
    });

    document.body.querySelectorAll("[data-act]").forEach(function (el) {
      el.addEventListener("click", function () {
        var act = el.getAttribute("data-act");
        if (act === "export") exportData();
        if (act === "pad") {
          store.settings.pad = !(store.settings.pad !== false);
          save(); toast(store.settings.pad === false ? "已关闭手写板" : "已开启手写板"); render();
        }
        if (act === "reset") {
          if (confirm("确定清空所有学习进度？题库会保留。")) { store.cards = {}; store.days = {}; save(); toast("已清空进度"); render(); }
        }
        if (act === "import") {
          var t = document.getElementById("importText").value.trim();
          if (!t) { toast("先粘贴 JSON 或选文件"); return; }
          doImport(t);
        }
        if (act === "sample") {
          var sample = {
            name: "材料力学",
            cards: [
              { type: "mcq", q: "低碳钢拉伸曲线的四个阶段依次是", options: ["弹性、屈服、强化、颈缩", "屈服、弹性、强化、颈缩", "弹性、强化、屈服、颈缩", "弹性、屈服、颈缩、强化"], a: "A" },
              { type: "tf", q: "材料的弹性模量随温度升高而增大。", verdict: "错", a: "温度升高，原子间结合力下降，弹性模量降低。" },
              { type: "term", q: "屈服强度", a: "材料开始产生明显塑性变形时的应力，常用 ReL 表示。" }
            ]
          };
          document.getElementById("importText").value = JSON.stringify(sample, null, 2);
        }
        if (act === "importFile") {}
      });
    });

    document.body.querySelectorAll("[data-del]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-del");
        if (!confirm("删除这个板块？该板块的学习记录也会一并清除。")) return;
        store.custom = store.custom.filter(function (s) { return s.id !== id; });
        save(); rebuildIndex(); toast("已删除"); render();
      });
    });

    var fileInput = document.getElementById("fileInput");
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () { doImport(String(fr.result)); };
        fr.readAsText(f);
      });
    }

    var stepBtns = document.body.querySelectorAll("[data-step]");
    stepBtns.forEach(function (el) {
      el.addEventListener("click", function () {
        var d = +el.getAttribute("data-step");
        store.settings.dailyNew = Math.max(10, Math.min(200, store.settings.dailyNew + d));
        save();
        var v = document.getElementById("newVal");
        if (v) v.textContent = store.settings.dailyNew;
      });
    });

    document.body.querySelectorAll("[data-theme]").forEach(function (el) {
      el.addEventListener("click", function () {
        store.settings.theme = el.getAttribute("data-theme");
        save(); applyTheme(); render();
      });
    });

    document.body.querySelectorAll("[data-exit]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (S && S.results.length) { go("result"); } else { S = null; go("home"); }
      });
    });

    document.body.querySelectorAll("[data-toggle]").forEach(function (el) {
      el.addEventListener("click", function () {
        var box = document.getElementById("reading");
        if (!box) return;
        var open = box.getAttribute("data-open") === "1";
        box.style.display = open ? "none" : "block";
        box.setAttribute("data-open", open ? "0" : "1");
        el.textContent = open ? "展开" : "收起";
      });
    });
  }

  /* ============ 主题 ============ */
  function applyTheme() {
    var t = store.settings.theme || "auto";
    var dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if ((store.settings.theme || "auto") === "auto") applyTheme();
    });
  } catch (e) {}

  /* ============ 键盘（桌面调试用） ============ */
  document.addEventListener("keydown", function (ev) {
    if (view.name !== "session" || !S) return;
    if (ev.key === "Enter" || ev.key === " ") {
      if (S.answered) { ev.preventDefault(); nextCard(); }
      else if (S.revealed) { }
      else if (["fill", "term", "short", "calc", "essay"].indexOf(cur().card.type) >= 0) {
        ev.preventDefault(); S.revealed = true; render();
      }
    }
    if (/^[1-4]$/.test(ev.key) && !S.answered) {
      var opts = document.body.querySelectorAll("[data-opt]");
      if (opts[+ev.key - 1]) opts[+ev.key - 1].click();
    }
  });

  /* ============ 启动 ============ */
  applyTheme();
  render();

  // 横竖屏切换 / 窗口变化时重排手写板画布
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (S && S.padCtl && document.getElementById("padCanvas")) S.padCtl.fit();
    }, 120);
  });

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
