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
      base.map = p.map || {};
      base.bag = p.bag || [];
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
    if (mode === "cards") {
      var wanted = opts.ids || [];
      return wanted.map(function (id) { return all.filter(function (e) { return e.card.id === id; })[0]; }).filter(Boolean);
    }
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
  var LPAD = { pad: {}, padOpen: true, padFull: false, padCtl: null }; // 知识闯关里的独立画板状态

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
    else if (view.name === "map") app.innerHTML = renderMap(view.params.cid);
    else if (view.name === "maps") app.innerHTML = renderMaps();
    else if (view.name === "lesson") app.innerHTML = renderLesson();
    else if (view.name === "bag") app.innerHTML = renderBag();
    else app.innerHTML = renderHome();
    bindCommon();
    if (view.name === "session") bindSession();
    if (view.name === "lesson") bindPad();
  }

  /* ============ 首页 ============ */
  function renderHome() {
    var g = globalStats();
    var st = streakInfo();
    var log = todayLog();
    var target = Math.max(10, Math.min(g.due + Math.min(g.fresh, store.settings.dailyNew), 200));
    var ringP = Math.min(100, Math.round(log.n / target * 100));
    var mt = mapTotals();
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

      '<button class="mapentry" data-go="maps">' +
      '<span class="me-glow"></span>' +
      '<span class="me-top"><span class="me-ico">🗺</span>' +
      '<span class="me-tt"><span class="me-title">知识地图闯关</span>' +
      '<span class="me-sub">' + mt.nodes + ' 个知识点 · 已闯 ' + mt.studied + ' · 三星 ' + mt.three + '</span></span>' +
      '<span class="me-go">开始 ›</span></span>' +
      '<span class="me-bar"><i style="width:' + (mt.maxstars ? Math.round(mt.stars / mt.maxstars * 100) : 0) + '%"></i></span>' +
      '<span class="me-foot"><span>⭐ ' + mt.stars + ' / ' + mt.maxstars + ' 星</span><span>点知识点 → 讲解配图 → 小测 → 三星抽卡</span></span>' +
      '</button>' +

      '<div class="section-title"><span class="h3">科目板块</span><span class="link" data-go="import">＋ 导入题库</span></div>' +
      '<div class="subjects">' + subCards + '</div>' +

      '<div class="section-title"><span class="h3">其他入口</span></div>' +
      '<div class="quick">' +
      '<button data-go="mixed"><span class="ico">🎲</span>随机 30 题</button>' +
      '<button data-go="mock"><span class="ico">🧾</span>模拟卷</button>' +
      '<button data-go="wrong"><span class="ico">📕</span>错题本<span class="num">' + g.bad + '</span></button>' +
      '<button data-go="bag"><span class="ico">🗂</span>卡册<span class="num">' + ((store.bag || []).length) + '</span></button>' +
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
        (ch.hot >= 6 ? '<span class="pill warn" style="height:19px;padding:0 6px;font-size:10.5px">重点 ' + ch.hot + '</span>' : '') +
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
      (mapOf(ch.id) ? '<button class="btn block lg mapbtn" data-map="' + esc(ch.id) + '">🗺 知识地图闯关 · ' + mapOf(ch.id).nodes.length + ' 个知识点</button>' : '') +
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
      '<div class="q-stem">' + formatStem(c.q) + '</div>' + cardMediaHtml(c, "q") +
      (c.from ? '<p class="q-src">来源：' + esc(c.from) + '</p>' : "") +
      padHtml() +
      (["term", "short", "calc", "essay", "fill", "point"].indexOf(c.type) >= 0 && !S.revealed && !S.answered
        ? '<p class="q-hint">在手写板上写出要点，再对照参考答案自评</p>' : "") +
      answerArea(c) +
      (c.type === "tf" && !S.answered ? '<p class="q-hint">判断对错，点一下即判分</p>' : "") +
      (c.type === "mcq" && !(S.answered || S.revealed) ? (
        keyOf(c).length > 1 ? '<p class="q-hint">多选题，选完后点提交</p>' : '<p class="q-hint">点选项即判分</p>'
      ) : "") +
      (S.revealed && !S.answered ? '<div class="answer-reveal"><span class="lab">' + (c.math ? '考研步骤导读＋原推导' : '参考答案') + '</span>' + esc(c.a) + '</div>' + cardMediaHtml(c, "a") : "") +
      (S.answered ? feedbackHtml(c) : "") +
      '</div>' +

      '<div class="s-actions" id="actions">' + actionsHtml(c) + '</div></div>';
  }

  function formatStem(q) {
    var t = esc(q);
    t = t.replace(/＿{2,}/g, '<span class="blank"></span>');
    return t;
  }

  function cardMediaHtml(c, kind) {
    var srcs = kind === "q" ? (c.qimgs || []) : (c.aimgs || []);
    if (!srcs.length) return "";
    return '<div class="card-media ' + (kind === "q" ? 'question-media' : 'answer-media') + '">' +
      srcs.map(function (src, i) {
        return '<img src="' + esc(src) + '" alt="' + (kind === "q" ? '原题高清图' : '原解析高清图') + (i + 1) + '" loading="lazy" data-imgzoom="' + esc(src) + '">';
      }).join("") + (kind === "q" ? '<p class="media-tip">公式以原题高清图为准 · 点图可放大</p>' : '<p class="media-tip">原解析高清图 · 点图可放大核对公式</p>') + '</div>';
  }

  /* ============ 手写答题板 ============ */
  var PAD = { color: "#111827", width: 2.2, mode: "pen", eraserW: 22 };
  var PAD_COLORS = ["#111827", "#1D4ED8", "#DC2626"];
  var PAD_WIDTHS = [[1.6, "细"], [2.8, "中"], [5, "粗"]];
  var PAD_ERASERS = [[14, "小"], [24, "中"], [36, "大"]];

  function padHost() { return view.name === "lesson" ? LPAD : S; }

  function padCardId() {
    if (view.name === "lesson" && L) return "L:" + L.nd.id + ":" + L.i + ":" + L.step;
    if (S) { var e = cur(); return e ? e.card.id : ""; }
    return "pad";
  }

  function padHtml() {
    if (store.settings.pad === false) return "";
    var H = padHost();
    var open = H.padOpen !== false;
    return '<div class="pad' + (open ? "" : " off") + (H.padFull ? " full" : "") + '" id="pad">' +
      '<div class="pad-bar">' +
      '<span class="pad-title"><i class="pad-ico">✎</i>手写答题区</span>' +
      '<div class="pad-tools">' +
      '<button class="pad-btn' + (PAD.mode === "pen" ? " on" : "") + '" data-padmode="pen">笔</button>' +
      '<button class="pad-btn' + (PAD.mode === "eraser" ? " on" : "") + '" data-padmode="eraser">像素橡皮</button>' +
      (PAD.mode === "eraser" ? "" : PAD_COLORS.map(function (c) {
        return '<button class="pad-dot' + (PAD.color === c ? " on" : "") + '" data-padcolor="' + c + '" style="--c:' + c + '" aria-label="笔色"></button>';
      }).join("")) +
      (PAD.mode === "eraser" ? PAD_ERASERS : PAD_WIDTHS).map(function (w) {
        var active = PAD.mode === "eraser" ? PAD.eraserW === w[0] : PAD.width === w[0];
        return '<button class="pad-btn' + (active ? " on" : "") + '" data-padw="' + w[0] + '">' + w[1] + '</button>';
      }).join("") +
      '<button class="pad-btn" data-padundo="1">撤销</button>' +
      '<button class="pad-btn" data-padclear="1">清空</button>' +
      '<button class="pad-btn" data-padfull="1">' + (H.padFull ? "退出全屏" : "全屏") + '</button>' +
      '<button class="pad-btn" data-padtoggle="1">' + (open ? "收起" : "展开") + '</button>' +
      '</div></div>' +
      '<div class="pad-body"><canvas id="padCanvas"></canvas></div></div>';
  }

  function mountPad() {
    var cv = document.getElementById("padCanvas");
    if (!cv) return;
    var H = padHost();
    var cid = padCardId();
    if (!H.pad) H.pad = {};
    var strokes = H.pad[cid] || (H.pad[cid] = []);
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var drawingId = null, act = null;

    function ctxA() {
      var x = cv.getContext("2d");
      x.lineCap = "round"; x.lineJoin = "round";
      return x;
    }
    function paint(s) {
      var x = ctxA();
      if (s.mode === "eraser") {
        x.globalCompositeOperation = "destination-out";
        x.strokeStyle = "rgba(0,0,0,1)"; x.fillStyle = "rgba(0,0,0,1)";
        x.lineCap = "butt";
      } else {
        x.globalCompositeOperation = "source-over";
        x.strokeStyle = s.color; x.fillStyle = s.color;
        x.lineCap = "round"; x.lineJoin = "round";
      }
      x.lineWidth = s.w;
      if (s.pts.length < 2) {
        var p = s.pts[0];
        if (p) { x.beginPath(); x.arc(p[0], p[1], s.w / 2, 0, 6.2832); x.fill(); }
      } else {
        x.beginPath(); x.moveTo(s.pts[0][0], s.pts[0][1]);
        for (var i = 1; i < s.pts.length; i++) x.lineTo(s.pts[i][0], s.pts[i][1]);
        x.stroke();
      }
      x.globalCompositeOperation = "source-over";
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
      act = {
        mode: PAD.mode,
        color: PAD.color,
        w: PAD.mode === "eraser" ? PAD.eraserW : PAD.width,
        pts: [pos(ev)]
      };
      strokes.push(act);
      paint(act);
    });
    cv.addEventListener("pointermove", function (ev) {
      if (drawingId !== ev.pointerId || !act) return;
      ev.preventDefault();
      var pts = (ev.getCoalescedEvents && ev.getCoalescedEvents()) || [];
      if (!pts.length) pts = [ev];
      var x = ctxA();
      x.lineWidth = act.w;
      if (act.mode === "eraser") {
        x.globalCompositeOperation = "destination-out";
        x.strokeStyle = "rgba(0,0,0,1)"; x.lineCap = "butt";
      } else {
        x.globalCompositeOperation = "source-over";
        x.strokeStyle = act.color; x.lineCap = "round"; x.lineJoin = "round";
      }
      pts.forEach(function (e2) {
        var p = pos(e2);
        var q = act.pts[act.pts.length - 1];
        if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 1.2) return;
        x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(p[0], p[1]); x.stroke();
        act.pts.push(p);
      });
      x.globalCompositeOperation = "source-over";
    });
    function end(ev) {
      if (drawingId !== ev.pointerId) return;
      drawingId = null; act = null;
    }
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("touchstart", function (ev) { ev.preventDefault(); }, { passive: false });

    H.padCtl = { strokes: strokes, redraw: redraw, fit: fit };
    fit();
    if (window.ResizeObserver) {
      if (H.padRO) H.padRO.disconnect();
      H.padRO = new ResizeObserver(function () { fit(); });
      H.padRO.observe(cv.parentNode);
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
    var H = padHost();
    padEl.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-padcolor],[data-padw],[data-padmode],[data-padundo],[data-padclear],[data-padfull],[data-padtoggle]");
      if (!t) return;
      ev.preventDefault();
      if (t.hasAttribute("data-padcolor")) {
        PAD.color = t.getAttribute("data-padcolor");
        padEl.querySelectorAll("[data-padcolor]").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute("data-padcolor") === PAD.color);
        });
        return;
      }
      if (t.hasAttribute("data-padmode")) {
        PAD.mode = t.getAttribute("data-padmode");
        render();
        return;
      }
      if (t.hasAttribute("data-padw")) {
        var wv = parseFloat(t.getAttribute("data-padw"));
        if (PAD.mode === "eraser") PAD.eraserW = wv; else PAD.width = wv;
        padEl.querySelectorAll("[data-padw]").forEach(function (b) {
          var v2 = parseFloat(b.getAttribute("data-padw"));
          b.classList.toggle("on", PAD.mode === "eraser" ? v2 === PAD.eraserW : v2 === PAD.width);
        });
        return;
      }
      if (t.hasAttribute("data-padundo")) {
        if (H.padCtl && H.padCtl.strokes.length) { H.padCtl.strokes.pop(); H.padCtl.redraw(); }
        return;
      }
      if (t.hasAttribute("data-padclear")) {
        if (H.padCtl && H.padCtl.strokes.length && confirm("清空这一题的笔迹？")) {
          H.padCtl.strokes.length = 0; H.padCtl.redraw();
        }
        return;
      }
      if (t.hasAttribute("data-padtoggle")) {
        H.padOpen = (H.padOpen === false);
        render();
        return;
      }
      if (t.hasAttribute("data-padfull")) {
        H.padFull = !H.padFull;
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
      extra +
      '<div class="fb-lab">答案与解析' + (c.from ? '　<span class="fb-from">' + esc(c.from) + '</span>' : '') + '</div>' +
      '<div class="fb-body">' + esc(c.a) + '</div></div>' + cardMediaHtml(c, "a");
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
      '<div class="li"><div class="l-main"><b>音效</b><span>答对、答错、升星、抽卡的声音</span></div>' +
      '<button class="btn sm" data-act="sound">' + (s.sound === false ? "已关闭" : "已开启") + '</button></div>' +
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
      store.map = data.map || {};
      store.bag = data.bag || [];
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
        if (act === "sound") {
          store.settings.sound = !(store.settings.sound !== false);
          save(); render();
          if (store.settings.sound !== false) sfx("right");
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

  /* ============ 知识地图 / 闯关 / 卡册 ============ */
  function ensureMap() {
    if (!store.map) store.map = {};
    if (!store.bag) store.bag = [];
  }
  ensureMap();

  var L = null;          // 当前闯关状态
  var MCARD = null;      // 当前抽卡
  var AC = null;

  function sfx(kind) {
    if (store.settings.sound === false) return;
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      var t0 = AC.currentTime + 0.01;
      function note(freq, dur, when, type, vol, glideTo) {
        var o = AC.createOscillator(), g = AC.createGain();
        o.type = type || "sine";
        o.frequency.setValueAtTime(freq, t0 + when);
        if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + when + dur * .5);
        g.gain.setValueAtTime(0.0001, t0 + when);
        g.gain.exponentialRampToValueAtTime(vol || 0.09, t0 + when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + when + dur);
        o.connect(g); g.connect(AC.destination);
        o.start(t0 + when); o.stop(t0 + when + dur + 0.02);
      }
      if (kind === "tap") { note(760, .06, 0, "triangle", .05, 900); }
      else if (kind === "right") {
        note(784, .10, 0, "triangle", .09);       // G5
        note(1046, .16, .09, "triangle", .09);    // C6
        note(1568, .12, .16, "sine", .045);       // 高亮泛音
      } else if (kind === "wrong") {
        note(196, .20, 0, "sawtooth", .055, 150);
        note(147, .24, .14, "sine", .05);
      } else if (kind === "star") {
        note(659, .10, 0, "triangle", .085);
        note(880, .10, .09, "triangle", .085);
        note(1175, .18, .18, "triangle", .095);
        note(1760, .14, .30, "sine", .05);
      } else if (kind === "card") {
        [523, 659, 784, 1046, 1319].forEach(function (f, i) { note(f, .12, i * .075, "triangle", .085); });
        note(2093, .20, .40, "sine", .05);
      }
    } catch (e) {}
  }

  /* 多邻国式举报语音（短促夸奖） */
  var SPOKEN = { key: "" };
  function voice(kind) {
    if (store.settings.sound === false) return;
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
      var pools = {
        right: ["Nice!", "Great!", "Correct!", "Perfect!", "Yes!"],
        wrong: ["Not quite.", "Almost.", "Try again."],
        star: ["Three stars!", "Nailed it!", "Excellent!", "Awesome!"],
        card: ["Wow, a new card!", "Lucky you!", "New card!"],
        levelup: ["Level up!"]
      };
      var arr = pools[kind];
      if (!arr) return;
      var key = kind + Date.now();
      SPOKEN.key = key;
      var say = arr[Math.floor(Math.random() * arr.length)];
      var u = new SpeechSynthesisUtterance(say);
      u.lang = "en-US"; u.rate = 1.05; u.pitch = 1.15; u.volume = 0.9;
      var vs = window.speechSynthesis.getVoices() || [];
      var v = vs.filter(function (x) { return /en[-_]US/i.test(x.lang); })[0];
      if (v) u.voice = v;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function mapOf(cid) {
    try { return BANK.map.chapters[cid]; } catch (e) { return null; }
  }

  function chapterById(cid) {
    var out = null;
    allSubjects.forEach(function (s) {
      (s.chapters || []).forEach(function (c) { if (c.id === cid) out = { subject: s, chapter: c }; });
    });
    return out;
  }

  function cardById(id) {
    var hit = null;
    allSubjects.forEach(function (s) {
      (s.chapters || []).forEach(function (c) {
        (c.cards || []).forEach(function (k) { if (!hit && k.id === id) hit = k; });
      });
    });
    return hit;
  }

  function nodeState(id) { ensureMap(); return store.map[id] || { stars: 0 }; }

  function shortLabel(s) {
    var t = String(s || "").replace(/（.*?）/g, "").replace(/\(.*?\)/g, "").trim();
    return t.length > 7 ? t.slice(0, 7) + "…" : t;
  }

  function mapTotals() {
    var out = { nodes: 0, studied: 0, stars: 0, maxstars: 0, three: 0 };
    allSubjects.forEach(function (s) {
      (s.chapters || []).forEach(function (ch) {
        var mp = mapOf(ch.id);
        if (!mp) return;
        (mp.nodes || []).forEach(function (n) {
          var st = nodeState(n.id);
          out.nodes += 1; out.maxstars += 3;
          if (st.stars > 0) out.studied += 1;
          out.stars += st.stars || 0;
          if (st.stars >= 3) out.three += 1;
        });
      });
    });
    return out;
  }

  function examLabel(id) {
    var c = cardById(id);
    if (!c) return "真题";
    var sec = String(c.sec || "").replace(/^[一二三四五六七八九十]+、/, "").replace(/（.*?）/g, "");
    return id.slice(4, 8) + " · " + sec + (c.num ? " " + c.num : "");
  }

  function chapterFlowHtml(s) {
    var items = [];
    (s.chapters || []).forEach(function (ch, i) {
      var mp = mapOf(ch.id);
      if (!mp || !mp.logic) return;
      if (items.length) items.push('<span class="flow-arrow">→</span>');
      items.push('<button class="flow-ch" data-map="' + esc(ch.id) + '">' +
        '<b>' + (ch.no < 10 ? "0" + ch.no : ch.no) + ' ' + esc(ch.title) + '</b>' +
        '<span>' + esc(mp.logic.question) + '</span></button>');
    });
    if (!items.length) return "";
    return '<div class="section-title"><span class="h3">' + esc(s.name) + ' · 章节逻辑主线</span></div>' +
      '<div class="flowline">' + items.join("") + '</div>';
  }

  function chapterLogicHtml(cid) {
    var mp = mapOf(cid), lg = mp && mp.logic;
    if (!lg) return "";
    function chBtn(id, fallback, cls) {
      if (!id) return '<span class="logic-edge ' + cls + '">' + esc(fallback) + '</span>';
      var info = chapterById(id);
      return '<button class="logic-edge ' + cls + '" data-map="' + esc(id) + '">' + esc(info ? info.chapter.title : id) + '</button>';
    }
    var related = (lg.links || []).map(function (x) {
      var info = chapterById(x.cid);
      return '<button class="rel-link" data-map="' + esc(x.cid) + '"><b>↗ ' + esc(info ? info.chapter.title : x.cid) + '</b><span>' + esc(x.text) + '</span></button>';
    }).join("");
    return '<section class="logic-card">' +
      '<div class="logic-kicker">本章解决的问题</div><h2>' + esc(lg.question) + '</h2>' +
      '<p class="logic-role">' + esc(lg.role) + '</p>' +
      '<div class="logic-chain">' + chBtn(lg.prev, "起点", "prev") +
      '<span class="logic-arrow">→</span><span class="logic-now">' + esc(mp.title) + '</span>' +
      '<span class="logic-arrow">→</span>' + chBtn(lg.next, "本科目终点", "next") + '</div>' +
      '<div class="logic-io"><span><b>输入</b>' + esc(lg.input) + '</span><span><b>输出</b>' + esc(lg.output) + '</span></div>' +
      (related ? '<div class="rel-title">跨章连接 · 为什么学它</div><div class="rel-grid">' + related + '</div>' : '') +
      '</section>';
  }

  function chapterFocusHtml(cid) {
    var mp = mapOf(cid), lg = mp && mp.logic;
    if (!lg) return "";
    var focus = (lg.focus || []).map(function (x, i) { return '<li><b>' + (i + 1) + '</b><span>' + esc(x) + '</span></li>'; }).join("");
    var common = (lg.common || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("");
    var refs = (mp.examRefs || []);
    var exams = refs.map(function (id) {
      var c = cardById(id);
      if (!c) return "";
      return '<button class="exam-link" data-exam="' + esc(id) + '"><span class="exam-year">' + esc(examLabel(id)) + '</span>' +
        '<span>' + esc(String(c.q).replace(/\s+/g, " ").slice(0, 54)) + '…</span><i>练这题 ›</i></button>';
    }).join("");
    var audit = mp.audit || {};
    return '<section class="review-card"><div class="review-head"><b>本章重点与常考题 · 已复核</b>' +
      '<span>资料 ' + (audit.sourceNodes || 0) + ' 条' + (audit.added ? '＋补漏 ' + audit.added : '') + '</span></div>' +
      '<div class="review-cols"><div><h4>必须掌握</h4><ol class="focus-list">' + focus + '</ol></div>' +
      '<div><h4>常见设问</h4><ul class="common-list">' + common + '</ul></div></div>' +
      (refs.length ? '<div class="rel-title">已录原卷中的对应题 · 点击直接练</div><div class="exam-list">' + exams + '</div>'
        : '<p class="no-direct-exam">已录原卷中未单列本章直接题；仍需按本章知识体系掌握，不能据此认定“不考”。</p>') +
      '<p class="audit-note">' + esc(audit.scope || "") + ' 当前有 ' + (audit.withQuiz || 0) + '/' + (audit.nodes || 0) + ' 个知识点带对应小测；不再用无关题凑满 3 题。</p></section>';
  }

  function renderMaps() {
    var tot = mapTotals();
    var pct = tot.maxstars ? Math.round(tot.stars / tot.maxstars * 100) : 0;
    var groups = allSubjects.map(function (s) {
      var rows = (s.chapters || []).map(function (ch) {
        var mp = mapOf(ch.id);
        if (!mp) return "";
        var nodes = mp.nodes || [], done = 0, starSum = 0;
        nodes.forEach(function (n) {
          var st = nodeState(n.id);
          if (st.stars > 0) done += 1;
          starSum += st.stars || 0;
        });
        var p = nodes.length ? Math.round(done / nodes.length * 100) : 0;
        var q = mp.logic ? mp.logic.question : "";
        return '<button class="maps-row" data-map="' + esc(ch.id) + '">' +
          '<span class="mr-no">' + (ch.no < 10 ? "0" + ch.no : ch.no) + '</span>' +
          '<span class="mr-main"><span class="mr-name">' + esc(ch.title || ch.name) + '</span>' +
          '<span class="mr-question">' + esc(q) + '</span>' +
          '<span class="mr-sub">' + nodes.length + ' 个知识点 · 结算 ' + starSum + ' / ' + (nodes.length * 3) + ' 星</span>' +
          '<div class="bar"><i style="width:' + p + '%;background:linear-gradient(90deg,#ff9ec7,#ff4fa3)"></i></div></span>' +
          '<span class="mr-pct">' + done + '/' + nodes.length + '</span></button>';
      }).join("");
      if (!rows) return "";
      return chapterFlowHtml(s) + '<div class="section-title"><span class="h3">按章进入地图</span></div><div class="maps-group">' + rows + '</div>';
    }).join("");

    return '<div class="wrap">' +
      '<div class="subhead"><button class="back" data-go="home">‹</button><span class="h3">知识地图闯关</span></div>' +
      '<div class="mh-card"><p class="mh-k">总进度</p>' +
      '<div class="mh-big">' + tot.stars + '<span> / ' + tot.maxstars + ' 星</span></div>' +
      '<p class="mh-note">已闯 ' + tot.studied + ' 个知识点 · 三星 ' + tot.three + ' 个 · 共 ' + tot.nodes + ' 个知识点</p>' +
      '<div class="bar"><i style="width:' + pct + '%;background:linear-gradient(90deg,#ff9ec7,#ff4fa3)"></i></div>' +
      '<p class="mh-tip">先看章节逻辑，再点知识点：讲解与配图 → 对应小测 → 得星 → 三星抽卡。</p></div>' +
      '<div class="logic-bridge"><b>课程怎样接上？</b><span>高化回答“链怎样合成与控制”，高物解释“结构为何产生性能”；高数训练连续变化与累积，线代刻画线性结构。每章地图还列有跨章连接。</span></div>' +
      groups + '</div>';
  }

  function renderMap(cid) {
    var info = chapterById(cid);
    var mp = mapOf(cid);
    if (!info || !mp) return renderHome();
    var nodes = mp.nodes;
    var done = 0, full = 0, starSum = 0;
    nodes.forEach(function (n) {
      var st = nodeState(n.id);
      if (st.stars) done++;
      if (st.stars >= 3) full++;
      starSum += (st.stars || 0);
    });

    function pos(i, total, rx, ry) {
      var a = (-90 + i * 360 / total) * Math.PI / 180;
      return [50 + rx * Math.cos(a), 50 + ry * Math.sin(a)];
    }
    var r1 = nodes.slice(0, 8), r2 = nodes.slice(8);
    var chips = [], lines = [];
    r1.forEach(function (n, i) {
      var p = pos(i, r1.length, 33, 31);
      chips.push([n, p]);
      lines.push('<line x1="50" y1="50" x2="' + p[0] + '" y2="' + p[1] + '"/>');
    });
    r2.forEach(function (n, i) {
      var p = pos(i, r2.length, 45, 43, 22);
      chips.push([n, p]);
      lines.push('<line x1="50" y1="50" x2="' + p[0] + '" y2="' + p[1] + '"/>');
    });

    var chipHtml = chips.map(function (pair) {
      var n = pair[0], p = pair[1];
      var st = nodeState(n.id).stars || 0;
      return '<button class="mnode s' + st + (n.added ? " added" : "") + '" title="' + esc(n.fullLabel || n.label) + '" style="left:' + p[0].toFixed(2) + '%;top:' + p[1].toFixed(2) + '%" data-node="' + esc(n.id) + '">' +
        '<span class="mlab">' + esc(shortLabel(n.label)) + '</span>' +
        '<span class="mstar">' + (st ? "★".repeat(st) : "待闯") + '</span></button>';
    }).join("");

    return '<div class="wrap">' +
      '<div class="subhead"><button class="back" data-go="chapter" data-sid="' + esc(info.subject.id) + '" data-cid="' + esc(cid) + '">‹</button>' +
      '<div class="grow"><div class="h1" style="font-size:24px">' + esc(mp.title) + ' 知识地图</div>' +
      '<p class="sub">' + (info.subject.short || info.subject.name) + ' · ' + nodes.length + ' 个知识点 · 已闯 ' + done + ' · 三星 ' + full + ' · 共 ' + starSum + '/' + nodes.length * 3 + ' 星</p></div></div>' +
      chapterLogicHtml(cid) +
      '<div class="mapbox"><svg class="maplines" viewBox="0 0 100 100" preserveAspectRatio="none">' + lines.join("") + '</svg>' +
      '<div class="mcenter"><span>' + esc(mp.title) + '</span><em>' + done + '/' + nodes.length + '</em></div>' +
      chipHtml + '</div>' +
      '<p class="maplegend"><i class="lg s0"></i>没学 <i class="lg s1"></i>一星 <i class="lg s2"></i>二星 <i class="lg s3"></i>三星 <i class="lg added-dot"></i>真题补漏</p>' +
      '<p class="sub" style="margin-top:10px">点一个知识点：先看完整讲解和配图，再做对应小测（题数按实际相关题，不再硬凑 3 题）。全对三星，60% 以上二星，完成一星；首次三星可抽卡。</p>' +
      chapterFocusHtml(cid) +
      '</div>';
  }

  function startLesson(cid, nodeId) {
    var mp = mapOf(cid);
    var nd = mp && mp.nodes.filter(function (x) { return x.id === nodeId; })[0];
    if (!nd) return;
    L = {
      cid: cid, nd: nd, i: 0, step: "read", correct: 0,
      answered: false, ok: false, sel: [], shown: false,
      quiz: (nd.quiz || []).map(function (q) { return cardById(q.id); }).filter(Boolean)
    };
    if (!L.quiz.length) L.quiz = [];
    go("lesson");
  }

  function noteHtml(nd) {
    var notes = nd.notes || [];
    if (!notes.length) return "";
    return '<div class="lnotes"><div class="lesson-lab">' + esc(nd.notesTitle || "知识要点 · 分章节资料原文") + '</div>' +
      notes.map(function (n) {
        var body = String(n.t || "").split(/\n+/).map(function (ln) {
          ln = ln.trim();
          if (!ln) return "";
          if (ln.indexOf("｜") >= 0) return '<div class="ltr">' + esc(ln) + '</div>';
          return '<p class="lp">' + esc(ln) + '</p>';
        }).join("");
        return '<div class="lnote"><h4>' + esc(n.h || "") + '</h4>' + body + '</div>';
      }).join("") + '</div>';
  }

  function renderLesson() {
    if (!L) return renderHome();
    var nd = L.nd;
    var step = L.step === "read" ? "第 1 步 · 讲解" : (L.step === "quiz" ? "第 2 步 · 小测" : "结算");
    var head = '<div class="wrap"><div class="subhead"><button class="back" data-mapback="1">‹</button>' +
      '<div class="grow"><div class="h1" style="font-size:23px">' + esc(nd.fullLabel || nd.label) + '</div>' +
      '<p class="sub">资料重要度 ' + "★".repeat(nd.stars) + (nd.added ? ' · 真题补漏' : '') + ' · ' + step + '</p></div></div>';

    if (L.step === "read") {
      return head +
        '<div class="card lesson"><div class="lesson-lab">一句话要点</div>' +
        '<p class="lesson-text">' + esc(nd.point || "（这一条暂无要点文字，先按教材小节过一遍）") + '</p>' +
        noteHtml(nd) +
        '</div>' +
        (nd.imgs && nd.imgs.length
          ? '<div class="card lesson"><div class="lesson-lab">教材／课件原图 · ' + nd.imgs.length + ' 张</div>' +
            nd.imgs.map(function (s, k) {
              var cap = nd.imgCaps && nd.imgCaps[k] ? nd.imgCaps[k] : '教材或课件截图';
              return '<figure class="lfig"><img loading="lazy" src="' + esc(s) + '" alt="' + esc(cap) + '" data-imgzoom="' + esc(s) + '"><figcaption>图 ' + (k + 1) + ' · ' + esc(cap) + ' · 点图放大</figcaption></figure>';
            }).join("") + '</div>'
          : '<p class="sub" style="margin:8px 2px">本条暂无配图，按上面的文字要点理解即可。</p>') +
        (L.quiz.length ? '<button class="btn primary block lg" data-lstart="1">开始小测 · ' + L.quiz.length + ' 题</button>'
          : '<p class="no-direct-exam">现有资料中暂未找到与本知识点精准对应的小测，不拿无关题凑数；请先按讲解学习并完成本节。</p><button class="btn primary block lg" data-lfinish="1">完成这一节</button>') +
        '</div>';
    }

    if (L.step === "quiz") {
      var c = L.quiz[L.i];
      if (!c) return finishLessonHtml();
      var answerZone = "";
      if (c.type === "mcq") {
        answerZone = '<div class="options" id="loptions">' + (c.options || []).map(function (o, i) {
          var letter = "ABCDE"[i];
          var cls = "";
          if (L.answered) {
            var right = (c.key || "").split("").indexOf(letter) >= 0;
            if (right) cls = "right";
            else if (L.sel.indexOf(letter) >= 0) cls = "wrong";
            else cls = "dim";
          } else if (L.sel.indexOf(letter) >= 0) cls = "sel";
          return '<button class="option ' + cls + '" data-lopt="' + letter + '">' +
            '<span class="key">' + letter + '</span><span>' + esc(o) + '</span></button>';
        }).join("") + '</div>' +
          ((c.key || "").length > 1 && !L.answered ? '<p class="q-hint">多选题：可选多个选项</p><button class="btn primary block" data-lsubmit="1">提交答案</button>' : '');
      } else if (c.type === "tf") {
        answerZone = '<div class="tf-row">' + ['对', '错'].map(function (t) {
          var cls = "";
          if (L.answered) { if (c.verdict === t) cls = "right"; else if (L.sel.indexOf(t) >= 0) cls = "wrong"; }
          return '<button class="tf-btn ' + cls + '" data-ltf="' + t + '">' + t + '</button>';
        }).join("") + '</div>';
      } else {
        answerZone = '<button class="btn block sm" data-lshow="1">' + (L.shown ? "收起答案" : "看答案") + '</button>' +
          (L.shown ? '<div class="answer-reveal"><span class="lab">' + (c.math ? '考研步骤导读＋原推导' : '参考答案') + '</span>' + esc(c.a) + '</div>' + cardMediaHtml(c, "a") +
            (!L.answered ? '<div class="rate-row" style="margin-top:12px">' +
              '<button class="rate g0" data-lself="0">没想起来</button>' +
              '<button class="rate g2" data-lself="1">想起来了</button></div>' : "") : "");
      }

      return head +
        '<div class="q-card" style="margin:0"><div class="q-tags"><span class="pill">' + TYPE_LABEL[c.type] + '</span>' +
        '<span class="pill">' + (L.i + 1) + ' / ' + L.quiz.length + '</span></div>' +
        '<div class="q-stem">' + formatStem(c.q) + '</div>' + cardMediaHtml(c, "q") +
        (c.from ? '<p class="q-src">来源：' + esc(c.from) + '</p>' : '') + answerZone +
        (c.type === "mcq" && L.answered ? '<div class="feedback ' + (L.ok ? "good" : "bad") + '"><div class="fb-lab">答案与解析</div><div class="fb-body">' + esc(c.a) + '</div></div>' + cardMediaHtml(c, "a") : "") +
        '</div>' +
        padHtml() +
        (L.answered ? '<button class="btn primary block lg" data-lnext="1">下一题</button>' : "") +
        '</div>';
    }
    return finishLessonHtml();
  }

  function finishLessonHtml() {
    var total = L.quiz.length || 0;
    var ratio = total ? L.correct / total : 1;
    var stars = total ? (L.correct === total ? 3 : (ratio >= 0.6 ? 2 : 1)) : 1;
    var st = store.map[L.nd.id] || { stars: 0 };
    L.stars = stars;
    var canDraw = stars >= 3 && !st.rewarded;
    return '<div class="wrap"><div class="subhead"><button class="back" data-mapback="1">‹</button>' +
      '<div class="grow"><div class="h1" style="font-size:23px">' + esc(L.nd.label) + '</div>' +
      '<p class="sub">答对 ' + L.correct + ' / ' + total + '</p></div></div>' +
      '<div class="card result-hero"><div class="bigstars">' +
      [1, 2, 3].map(function (i) { return '<span class="bs' + (i <= stars ? " on" : "") + '">★</span>'; }).join("") +
      '</div><p class="sub">' + (stars === 3 ? "完美通关，这一段拿满三星！" : stars === 2 ? "差一点满分，再刷一遍就三星了" : "先混个脸熟，回去再闯一次") + '</p></div>' +
      (canDraw ? '<button class="btn primary block lg" data-draw="' + esc(L.nd.id) + '">🎁 三星奖励 · 抽一张卡</button>' : '') +
      '<div class="row" style="gap:10px;margin-top:10px">' +
      '<button class="btn block" data-lagain="1">再闯一次</button>' +
      '<button class="btn block" data-mapback="1">回到地图</button>' +
      '</div></div>';
  }

  function finishLesson() {
    var total = L.quiz.length || 0;
    var stars = total ? (L.correct === total ? 3 : (L.correct / total >= 0.6 ? 2 : 1)) : 1;
    var totalStars = Math.max(1, Math.min(3, stars));
    var st = store.map[L.nd.id] || { stars: 0 };
    st.stars = Math.max(st.stars || 0, totalStars);
    st.ts = today();
    store.map[L.nd.id] = st;
    save();
    sfx("star");
    voice(totalStars >= 3 ? "star" : "right");
    L.step = "done";
    render();
  }

  function drawCard(nodeId) {
    var ch = L && L.cid;
    var info = chapterById(ch);
    var pool = [];
    if (info) {
      (info.chapter.cards || []).forEach(function (c) {
        if (["mcq", "tf", "fill", "term", "short", "calc", "essay", "point"].indexOf(c.type) >= 0 && (c.stars || 0) >= 4) pool.push(c);
      });
    }
    if (!pool.length && L && L.quiz.length) pool = L.quiz;
    if (!pool.length) { toast("这一章暂时没有可抽的卡"); return; }
    var r = Math.random();
    var rarity = r < 0.1 ? "SR" : (r < 0.4 ? "R" : "N");
    var list = pool.filter(function (c) { return (c.stars || 0) >= (rarity === "SR" ? 5 : 4); });
    if (!list.length) list = pool;
    var pick = list[Math.floor(Math.random() * list.length)];
    MCARD = {
      id: "bag" + Date.now().toString(36) + Math.floor(Math.random() * 999),
      q: pick.q, a: pick.a, rarity: rarity,
      from: pick.from || "", ts: Date.now(), flipped: false
    };
    store.bag.push({ id: MCARD.id, q: MCARD.q, a: MCARD.a, rarity: MCARD.rarity, from: MCARD.from, ts: MCARD.ts });
    var st = store.map[nodeId] || {};
    st.rewarded = true;
    store.map[nodeId] = st;
    save();
    sfx("card");
    voice("card");
    renderCardModal();
  }

  function renderCardModal() {
    var old = document.querySelector(".cardmask");
    if (old) old.remove();
    if (!MCARD) return;
    var wrap = document.createElement("div");
    wrap.className = "cardmask";
    wrap.innerHTML = '<div class="cmod"><div class="cmod-tip">' + (MCARD.flipped ? "收进卡册了" : "点一下翻开") + '</div>' +
      '<div class="mgcard ' + (MCARD.flipped ? "flip r" + MCARD.rarity : "") + '">' +
      (MCARD.flipped
        ? '<div class="mg-rar">' + MCARD.rarity + '</div><div class="mg-q">' + esc(MCARD.q) + '</div><div class="mg-a">' + esc(MCARD.a) + '</div>'
        : '<div class="mg-back">866</div><div class="mg-backtip">' + MCARD.rarity + ' 卡</div>') +
      '</div>' +
      '<button class="btn primary block" data-closecard="1">' + (MCARD.flipped ? "收进卡册" : "翻开") + '</button></div>';
    document.body.appendChild(wrap);
  }

  function renderBag() {
    ensureMap();
    var list = store.bag.slice().sort(function (a, b) { return b.ts - a.ts; });
    return '<div class="wrap"><div class="subhead"><button class="back" data-go="home">‹</button>' +
      '<div class="grow"><div class="h1" style="font-size:24px">卡册</div>' +
      '<p class="sub">共 ' + list.length + ' 张 · 三星闯关抽到的卡都在这</p></div></div>' +
      (list.length ? '<div class="baggrid">' + list.map(function (c) {
        return '<button class="bagcard r' + esc(c.rarity) + '" data-bag="' + esc(c.id) + '">' +
          '<span class="bag-rar">' + esc(c.rarity) + '</span>' +
          '<span class="bag-q">' + esc(String(c.q).slice(0, 42)) + '</span></button>';
      }).join("") + '</div>' +
        '<div class="card" id="bagDetail" style="margin-top:14px;display:none"></div>'
        : '<div class="card"><p class="sub">还没有卡。把任意一章地图里的知识点闯到三星，就能抽第一张。</p></div>') +
      '</div>';
  }

  applyTheme();
  render();

  // 横竖屏切换 / 窗口变化时重排手写板画布
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var HH = padHost();
      if (HH && HH.padCtl && document.getElementById("padCanvas")) HH.padCtl.fit();
    }, 120);
  });

  /* ============ 地图 / 闯关事件（全局一次） ============ */
  document.body.addEventListener("click", function (ev) {
    var t;
    if ((t = ev.target.closest("[data-closezoom]"))) {
      var oldZoom = document.getElementById("imgZoom");
      if (oldZoom) oldZoom.remove();
      document.body.style.overflow = ""; return;
    }
    if ((t = ev.target.closest("[data-imgzoom]"))) {
      var prior = document.getElementById("imgZoom");
      if (prior) prior.remove();
      var z = document.createElement("div");
      z.id = "imgZoom"; z.className = "img-zoom"; z.setAttribute("data-closezoom", "1");
      z.innerHTML = '<button type="button" aria-label="关闭">×</button><img src="' + esc(t.getAttribute("data-imgzoom")) + '" alt="放大原图">';
      document.body.appendChild(z); document.body.style.overflow = "hidden"; return;
    }
    if ((t = ev.target.closest("[data-exam]"))) {
      sfx("tap"); startSession("cards", { ids: [t.getAttribute("data-exam")], title: "本章对应真题" }); return;
    }
    if ((t = ev.target.closest("[data-map]"))) {
      sfx("tap"); go("map", { cid: t.getAttribute("data-map") }); return;
    }
    if ((t = ev.target.closest("[data-node]"))) {
      sfx("tap"); startLesson(view.params.cid, t.getAttribute("data-node")); return;
    }
    if ((t = ev.target.closest("[data-lstart]"))) {
      if (!L) return;
      sfx("tap");
      if (!L.quiz.length) { finishLesson(); return; }
      L.step = "quiz"; L.i = 0; L.correct = 0; L.answered = false; L.sel = []; L.shown = false;
      render(); return;
    }
    if ((t = ev.target.closest("[data-lshow]"))) {
      L.shown = !L.shown; render(); return;
    }
    if ((t = ev.target.closest("[data-lopt]"))) {
      if (!L || L.answered) return;
      var c = L.quiz[L.i];
      var key = (c.key || "").split("");
      var letter = t.getAttribute("data-lopt");
      if (key.length > 1) {
        var at = L.sel.indexOf(letter);
        if (at >= 0) L.sel.splice(at, 1); else L.sel.push(letter);
        render(); return;
      }
      L.sel = [letter];
      L.answered = true;
      L.ok = key.length === 1 && key[0] === letter;
      if (L.ok) L.correct++;
      sfx(L.ok ? "right" : "wrong");
      voice(L.ok ? "right" : "wrong");
      render(); return;
    }
    if ((t = ev.target.closest("[data-lsubmit]"))) {
      if (!L || L.answered) return;
      var cm = L.quiz[L.i], km = (cm.key || "").split("");
      L.answered = true;
      L.ok = km.length > 0 && km.every(function (x) { return L.sel.indexOf(x) >= 0; }) && L.sel.length === km.length;
      if (L.ok) L.correct++;
      sfx(L.ok ? "right" : "wrong"); voice(L.ok ? "right" : "wrong"); render(); return;
    }
    if ((t = ev.target.closest("[data-ltf]"))) {
      if (!L || L.answered) return;
      var c2 = L.quiz[L.i];
      var v = t.getAttribute("data-ltf");
      L.sel = [v];
      L.answered = true;
      L.ok = c2.verdict === v;
      if (L.ok) L.correct++;
      sfx(L.ok ? "right" : "wrong");
      voice(L.ok ? "right" : "wrong");
      render(); return;
    }
    if ((t = ev.target.closest("[data-lself]"))) {
      if (!L || L.answered) return;
      L.answered = true;
      L.ok = t.getAttribute("data-lself") === "1";
      if (L.ok) L.correct++;
      sfx(L.ok ? "right" : "wrong");
      voice(L.ok ? "right" : "wrong");
      render(); return;
    }
    if ((t = ev.target.closest("[data-lnext]"))) {
      L.i++;
      L.answered = false; L.sel = []; L.shown = false;
      if (L.i >= L.quiz.length) finishLesson(); else render();
      return;
    }
    if ((t = ev.target.closest("[data-lfinish]"))) { finishLesson(); return; }
    if ((t = ev.target.closest("[data-lagain]"))) {
      L.i = 0; L.correct = 0; L.answered = false; L.sel = []; L.shown = false;
      L.step = "read"; render(); return;
    }
    if ((t = ev.target.closest("[data-mapback]"))) { sfx("tap"); go("map", { cid: L ? L.cid : "" }); return; }
    if ((t = ev.target.closest("[data-draw]"))) { drawCard(t.getAttribute("data-draw")); return; }
    if ((t = ev.target.closest("[data-closecard]"))) {
      if (MCARD && !MCARD.flipped) { MCARD.flipped = true; renderCardModal(); return; }
      var m = document.querySelector(".cardmask"); if (m) m.remove();
      MCARD = null; render(); return;
    }
    if (ev.target.classList && ev.target.classList.contains("cardmask")) {
      var m2 = document.querySelector(".cardmask"); if (m2) m2.remove();
      MCARD = null; render(); return;
    }
    if ((t = ev.target.closest("[data-bag]"))) {
      var bc = (store.bag || []).filter(function (x) { return x.id === t.getAttribute("data-bag"); })[0];
      var det = document.getElementById("bagDetail");
      if (bc && det) {
        det.style.display = "block";
        det.innerHTML = '<div class="row between" style="margin-bottom:8px"><b> ' + esc(bc.rarity) + ' 卡</b>' +
          '<span class="sub">' + (bc.from ? esc(bc.from) : "") + '</span></div>' +
          '<div class="q-stem" style="font-size:17px">' + esc(bc.q) + '</div>' +
          '<div class="fb-lab">答案与解析</div><div class="fb-body">' + esc(bc.a) + '</div>';
      }
      return;
    }
  });

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
