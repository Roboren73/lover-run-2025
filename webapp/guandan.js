/*
 * 掼蛋核心引擎 (JavaScript 移植自 guandan/core.py + play.py 的 advise 部分)
 * 纯逻辑，无依赖。浏览器 <script> 与 Node(require) 均可用。
 * 点数：2..10, J=11,Q=12,K=13,A=14, 小王=16, 大王=17。
 * 级牌比较时升为 15；红桃级牌=逢人配(wild)。
 */
(function (root) {
  "use strict";

  const SUITS = ["S", "H", "D", "C"]; // 黑桃 红桃 方块 梅花
  const RANK_NAMES = { 11: "J", 12: "Q", 13: "K", 14: "A", 16: "小王", 17: "大王" };

  function rankName(r) { return RANK_NAMES[r] || String(r); }
  function isJoker(c) { return c.rank === 16 || c.rank === 17; }
  function cardStr(c) { return isJoker(c) ? rankName(c.rank) : c.suit + rankName(c.rank); }

  function isWild(c, level) {
    return !isJoker(c) && c.suit === "H" && c.rank === level;
  }
  function orderValue(rank, level) {
    if (rank === 16 || rank === 17) return rank;
    if (rank === level) return 15;
    return rank;
  }
  function bombTier(category, n) {
    if (category === "joker_bomb") return 100;
    if (category === "straight_flush") return 6;
    return n <= 5 ? n : n + 1;
  }

  // Combo: {category,length,rank,cards,isBomb,bombPower:[tier,rank]|null}
  function combo(category, length, rank, cards, isBomb, bombPower) {
    return { category, length, rank, cards, isBomb: !!isBomb, bombPower: bombPower || null };
  }

  function cmpTuple(a, b) { // 比较 [tier,rank]
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  }

  function beats(b, a) {
    if (!b) return false;
    if (!a) return true;
    if (b.isBomb && !a.isBomb) return true;
    if (a.isBomb && !b.isBomb) return false;
    if (b.isBomb && a.isBomb) return cmpTuple(b.bombPower, a.bombPower) > 0;
    return b.category === a.category && b.length === a.length && b.rank > a.rank;
  }

  function splitHand(cards, level) {
    const byRank = new Map();
    const jokers = [], wilds = [];
    for (const c of cards) {
      if (isJoker(c)) jokers.push(c);
      else if (isWild(c, level)) wilds.push(c);
      else {
        if (!byRank.has(c.rank)) byRank.set(c.rank, []);
        byRank.get(c.rank).push(c);
      }
    }
    return { byRank, jokers, wilds };
  }

  // requirements: [[rank,need],...]
  function build(requirements, byRank, wilds, suit) {
    const used = [];
    const wleft = wilds.slice();
    const consumed = new Map();
    for (const [r, need0] of requirements) {
      let need = need0;
      let avail = (byRank.get(r) || []);
      if (suit) avail = avail.filter((c) => c.suit === suit);
      const skip = consumed.get(r) || 0;
      avail = avail.slice(skip);
      const take = Math.min(need, avail.length);
      for (let i = 0; i < take; i++) used.push(avail[i]);
      consumed.set(r, skip + take);
      need -= take;
      while (need > 0 && wleft.length) { used.push(wleft.pop()); need--; }
      if (need > 0) return null;
    }
    return used;
  }

  // 长度为 size 的连续点数窗口；A 可高可低。返回 [{ranks:[...], top}]
  function windows(size) {
    const res = [];
    for (let start = 1; start <= 14 - size + 1; start++) {
      const window = [];
      for (let x = start; x < start + size; x++) window.push(x);
      const ranks = window.map((x) => (x === 1 ? 14 : x));
      res.push({ ranks, top: window[window.length - 1] });
    }
    return res;
  }

  function classify(cards, level) {
    const n = cards.length;
    if (n === 0) return null;
    const { byRank, jokers, wilds } = splitHand(cards, level);
    const w = wilds.length;
    const ov = (r) => orderValue(r, level);

    if (n === 4 && jokers.length === 4)
      return combo("joker_bomb", 4, 100, cards.slice(), true, [100, 0]);
    if (jokers.length > 0 && n !== 1) return null;

    if (n === 1) {
      const c = cards[0];
      return combo("single", 1, orderValue(c.rank, level), cards.slice());
    }

    function sameRankCombo() {
      for (const [r, lst] of byRank) {
        if (lst.length + w >= n && lst.length >= 1) {
          const built = build([[r, n]], byRank, wilds);
          if (built) return { r, built };
        }
      }
      if (w >= n && byRank.size === 0) return { r: level, built: wilds.slice(0, n) };
      return null;
    }

    if (n === 2) {
      const sc = sameRankCombo();
      return sc ? combo("pair", 2, ov(sc.r), sc.built) : null;
    }
    if (n === 3) {
      const sc = sameRankCombo();
      return sc ? combo("triple", 3, ov(sc.r), sc.built) : null;
    }
    if (n >= 4) {
      const sc = sameRankCombo();
      if (sc) {
        const tier = bombTier("bomb", n);
        return combo("bomb", n, ov(sc.r), sc.built, true, [tier, ov(sc.r)]);
      }
    }

    if (n === 5) {
      const ranksPresent = [...byRank.keys()];
      const cand = ranksPresent.concat(w ? [level] : []);
      for (const t of cand) for (const p of cand) {
        if (t === p) continue;
        const built = build([[t, 3], [p, 2]], byRank, wilds);
        if (built && built.length === 5) return combo("full_house", 5, ov(t), built);
      }
      for (const suit of SUITS) for (const { ranks, top } of windows(5)) {
        const built = build(ranks.map((r) => [r, 1]), byRank, wilds, suit);
        if (built && built.length === 5) return combo("straight_flush", 5, top, built, true, [6, top]);
      }
      for (const { ranks, top } of windows(5)) {
        const built = build(ranks.map((r) => [r, 1]), byRank, wilds);
        if (built && built.length === 5) return combo("straight", 5, top, built);
      }
      return null;
    }

    if (n === 6) {
      for (const { ranks, top } of windows(3)) {
        const built = build(ranks.map((r) => [r, 2]), byRank, wilds);
        if (built && built.length === 6) return combo("consec_pairs", 6, top, built);
      }
      for (const { ranks, top } of windows(2)) {
        const built = build(ranks.map((r) => [r, 3]), byRank, wilds);
        if (built && built.length === 6) return combo("consec_triples", 6, top, built);
      }
      return null;
    }
    return null;
  }

  function removeCards(hand, used) {
    const rem = hand.slice();
    for (const u of used) {
      for (let i = 0; i < rem.length; i++) {
        if (rem[i] === u || (rem[i].rank === u.rank && rem[i].suit === u.suit)) {
          rem.splice(i, 1); break;
        }
      }
    }
    return rem;
  }

  function genMoves(hand, level) {
    const { byRank, jokers, wilds } = splitHand(hand, level);
    const w = wilds.length;
    const ranks = [...byRank.keys()].sort((a, b) => a - b);
    const out = [];
    const seen = new Set();
    function add(c) {
      if (!c) return;
      const sig = c.category + "|" + c.length + "|" + c.rank + "|" +
        c.cards.map(cardStr).sort().join(",");
      if (seen.has(sig)) return;
      seen.add(sig); out.push(c);
    }
    for (const c of hand) add(combo("single", 1, orderValue(c.rank, level), [c]));
    for (const r of ranks) {
      const cnt = byRank.get(r).length;
      for (const [need, cat] of [[2, "pair"], [3, "triple"]]) {
        if (cnt + w >= need && cnt >= 1) {
          const built = build([[r, need]], byRank, wilds);
          if (built) add(combo(cat, need, orderValue(r, level), built));
        }
      }
      const maxn = Math.min(cnt + w, 8);
      for (let nb = 4; nb <= maxn; nb++) {
        const built = build([[r, nb]], byRank, wilds);
        if (built) {
          const tier = bombTier("bomb", nb);
          add(combo("bomb", nb, orderValue(r, level), built, true, [tier, orderValue(r, level)]));
        }
      }
    }
    const small = jokers.filter((c) => c.rank === 16), big = jokers.filter((c) => c.rank === 17);
    if (small.length >= 2 && big.length >= 2)
      add(combo("joker_bomb", 4, 100, small.slice(0, 2).concat(big.slice(0, 2)), true, [100, 0]));

    for (const t of ranks) {
      if (byRank.get(t).length + w < 3) continue;
      const triple = build([[t, 3]], byRank, wilds);
      if (!triple) continue;
      const rem = removeCards(hand, triple);
      const sp = splitHand(rem, level);
      for (const p of [...sp.byRank.keys()].sort((a, b) => a - b)) {
        const pair = build([[p, 2]], sp.byRank, sp.wilds);
        if (pair && pair.length === 2) {
          add(combo("full_house", 5, orderValue(t, level), triple.concat(pair)));
          break;
        }
      }
    }
    for (const { ranks: rw, top } of windows(5)) {
      const built = build(rw.map((r) => [r, 1]), byRank, wilds);
      if (built && built.length === 5) add(combo("straight", 5, top, built));
      for (const suit of SUITS) {
        const sb = build(rw.map((r) => [r, 1]), byRank, wilds, suit);
        if (sb && sb.length === 5) add(combo("straight_flush", 5, top, sb, true, [6, top]));
      }
    }
    for (const { ranks: rw, top } of windows(3)) {
      const built = build(rw.map((r) => [r, 2]), byRank, wilds);
      if (built && built.length === 6) add(combo("consec_pairs", 6, top, built));
    }
    for (const { ranks: rw, top } of windows(2)) {
      const built = build(rw.map((r) => [r, 3]), byRank, wilds);
      if (built && built.length === 6) add(combo("consec_triples", 6, top, built));
    }
    return out;
  }

  function legalResponses(hand, current, level) {
    const moves = genMoves(hand, level);
    if (!current) return moves;
    return moves.filter((m) => beats(m, current));
  }

  // ---- 策略 / 建议 ----
  function bombRanks(hand, level) {
    const cnt = new Map();
    for (const c of hand) {
      if (isJoker(c) || (c.suit === "H" && c.rank === level)) continue;
      cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
    }
    const s = new Set();
    for (const [r, c] of cnt) if (c >= 4) s.add(r);
    return s;
  }

  function chooseLead(hand, level) {
    const moves = genMoves(hand, level);
    const br = bombRanks(hand, level);
    const safe = moves.filter((m) => !m.isBomb && !m.cards.some((c) => br.has(c.rank)));
    const nonBomb = moves.filter((m) => !m.isBomb);
    const pool = safe.length ? safe : (nonBomb.length ? nonBomb : moves);
    pool.sort((a, b) => (b.length - a.length) || (a.rank - b.rank));
    return pool[0];
  }

  function chooseFollow(hand, current, ownerIsPartner, level, oppLow) {
    if (ownerIsPartner && !oppLow) return null;
    const resp = legalResponses(hand, current, level);
    if (!resp.length) return null;
    const nonBomb = resp.filter((m) => !m.isBomb);
    if (nonBomb.length) {
      nonBomb.sort((a, b) => (a.rank - b.rank) || (a.length - b.length));
      return nonBomb[0];
    }
    if (oppLow) {
      resp.sort((a, b) => cmpTuple(a.bombPower, b.bombPower));
      return resp[0];
    }
    return null;
  }

  function teammate(seat) { return (seat + 2) % 4; }

  // ---- V2：手牌拆解(最少手数) + 规划型策略 ----
  function decompose(hand, level) {
    const pool = new Map(), wilds = [], jokers = [];
    for (const c of hand) {
      if (isJoker(c)) jokers.push(c);
      else if (isWild(c, level)) wilds.push(c);
      else { if (!pool.has(c.rank)) pool.set(c.rank, []); pool.get(c.rank).push(c); }
    }
    const combos = [];
    const ov = (r) => orderValue(r, level);
    const cnt = (r) => (pool.get(r) || []).length;
    const pop = (r) => pool.get(r).pop();

    // 天王炸
    const small = jokers.filter((c) => c.rank === 16), big = jokers.filter((c) => c.rank === 17);
    if (small.length >= 2 && big.length >= 2) {
      const jb = small.slice(0, 2).concat(big.slice(0, 2));
      combos.push(combo("joker_bomb", 4, 100, jb, true, [100, 0]));
      for (const c of jb) jokers.splice(jokers.indexOf(c), 1);
    }
    // 自然炸弹
    for (const r of [...pool.keys()]) {
      if (cnt(r) >= 4) {
        const cards = pool.get(r).slice(); const n = cards.length;
        combos.push(combo("bomb", n, ov(r), cards, true, [bombTier("bomb", n), ov(r)]));
        pool.set(r, []);
      }
    }
    // 顺子(长5)。允许百搭补缺：纯自然优先，再借1张、2张——
    // 一条顺子把3~5张零牌并成1手，比留给对子升级(每张只省1手)划算。
    let changed = true;
    for (const maxWild of [0, 1, 2]) {
      changed = true;
      while (changed) { changed = false;
        for (const { ranks, top } of windows(5)) {
          const missing = ranks.filter((r) => cnt(r) < 1);
          if (missing.length > maxWild || missing.length > wilds.length) continue;
          const built = [];
          for (const r of ranks) if (cnt(r) >= 1) built.push(pop(r));
          for (let i = 0; i < missing.length; i++) built.push(wilds.pop());
          combos.push(combo("straight", 5, top, built)); changed = true;
        }
      }
    }
    // 钢板
    changed = true;
    while (changed) { changed = false;
      for (const { ranks, top } of windows(2)) {
        if (ranks.every((r) => cnt(r) >= 3)) {
          const b = []; for (const r of ranks) for (let i = 0; i < 3; i++) b.push(pop(r));
          combos.push(combo("consec_triples", 6, top, b)); changed = true;
        }
      }
    }
    // 三连对
    changed = true;
    while (changed) { changed = false;
      for (const { ranks, top } of windows(3)) {
        if (ranks.every((r) => cnt(r) >= 2)) {
          const b = []; for (const r of ranks) for (let i = 0; i < 2; i++) b.push(pop(r));
          combos.push(combo("consec_pairs", 6, top, b)); changed = true;
        }
      }
    }
    // 三同
    for (const r of [...pool.keys()].sort((a, b) => a - b))
      while (cnt(r) >= 3) combos.push(combo("triple", 3, ov(r), [pop(r), pop(r), pop(r)]));
    // 对子
    for (const r of [...pool.keys()].sort((a, b) => a - b))
      while (cnt(r) >= 2) combos.push(combo("pair", 2, ov(r), [pop(r), pop(r)]));
    // 用百搭把剩余"自然牌"单张升级成对。王不参与：百搭不能替王，
    // 王+百搭不是合法对子(classify 会拒绝)，王只能单出。
    const singles = [];
    for (const r of [...pool.keys()].sort((a, b) => a - b)) { while (cnt(r)) singles.push(pop(r)); }
    for (const c of singles) {
      if (wilds.length) combos.push(combo("pair", 2, ov(c.rank), [c, wilds.pop()]));
      else combos.push(combo("single", 1, orderValue(c.rank, level), [c]));
    }
    for (const j of jokers) combos.push(combo("single", 1, orderValue(j.rank, level), [j]));
    for (const wc of wilds) combos.push(combo("single", 1, orderValue(wc.rank, level), [wc]));

    // 三带二合并：三同张 + 最小的对子 → full_house，总手数再减一
    const triples = combos.filter((c) => c.category === "triple").sort((a, b) => a.rank - b.rank);
    const pairs2 = combos.filter((c) => c.category === "pair").sort((a, b) => a.rank - b.rank);
    for (const t of triples) {
      if (!pairs2.length) break;
      const p = pairs2.shift();
      combos.splice(combos.indexOf(t), 1);
      combos.splice(combos.indexOf(p), 1);
      combos.push(combo("full_house", 5, t.rank, t.cards.concat(p.cards)));
    }
    return combos;
  }
  function playsNeeded(hand, level) { return decompose(hand, level).length; }

  function removeFrom(hand, used) {
    const rem = hand.slice();
    for (const u of used) {
      for (let i = 0; i < rem.length; i++)
        if (rem[i] === u || (rem[i].rank === u.rank && rem[i].suit === u.suit)) { rem.splice(i, 1); break; }
    }
    return rem;
  }
  function leadV2(hand, level) {
    const plan = decompose(hand, level);
    const nb = plan.filter((c) => !c.isBomb);
    const pool = nb.length ? nb : plan;
    pool.sort((a, b) => (a.rank - b.rank) || (a.length - b.length));
    // 安全网：绝不建议非法牌型——曾有王+百搭凑对的 bug
    for (const c of pool) if (classify(c.cards, level)) return c;
    return combo("single", 1, orderValue(hand[0].rank, level), [hand[0]]);
  }
  function followV2(hand, current, ownerIsPartner, level, oppLow) {
    if (ownerIsPartner && !oppLow) return null;
    const resp = legalResponses(hand, current, level);
    if (!resp.length) return null;
    const base = playsNeeded(hand, level);
    const nonBomb = resp.filter((m) => !m.isBomb);
    let best = null, bestKey = null;
    for (const m of nonBomb) {
      const remCost = playsNeeded(removeFrom(hand, m.cards), level);
      const key = [remCost, m.rank, m.length];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])
          || (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])) {
        bestKey = key; best = m;
      }
    }
    if (best && (bestKey[0] <= base || oppLow)) return best;
    if (oppLow) {
      const bombs = resp.filter((m) => m.isBomb).sort((a, b) => cmpTuple(a.bombPower, b.bombPower));
      if (bombs.length) return bombs[0];
    }
    return null;
  }

  // ---- 可插拔引擎注册表（与 guandan/engine_api.py 对应）----
  // 现在只有 v2_plan(默认)/v1_heuristic 两个；以后要接更强的引擎(比如把
  // DanZero+/rlcard 训练出的策略网络导出成 onnx 在浏览器里跑)，调用
  // Guandan.registerEngine("danzero_plus", {lead(hand,level,ctx){...}, follow(hand,current,level,ctx){...}})
  // 然后 advise(hand, current, level, {...opts, engine:"danzero_plus"}) 即可切换，
  // camera.html 等调用点不用改。
  const ENGINES = {
    v2_plan: { lead: (hand, level) => leadV2(hand, level),
              follow: (hand, current, level, ctx) => followV2(hand, current, ctx.ownerIsPartner, level, ctx.oppLow) },
    v1_heuristic: { lead: (hand, level) => chooseLead(hand, level),
                    follow: (hand, current, level, ctx) => chooseFollow(hand, current, ctx.ownerIsPartner, level, ctx.oppLow) },
  };
  function registerEngine(name, engine) { ENGINES[name] = engine; }
  function getEngine(nameOrEngine) {
    if (nameOrEngine && typeof nameOrEngine === "object") return nameOrEngine;
    const eng = ENGINES[nameOrEngine || "v2_plan"];
    if (!eng) throw new Error("未知引擎 '" + nameOrEngine + "'，可选: " + Object.keys(ENGINES).join(","));
    return eng;
  }

  // 建议接口：前端核心调用。opts.engine 选引擎(默认 v2_plan)，不填即维持原行为。
  function advise(hand, current, level, opts) {
    opts = opts || {};
    const eng = getEngine(opts.engine);
    const ctx = { mySeat: opts.mySeat, ownerSeat: opts.ownerSeat,
                 oppMinCards: opts.oppMinCards != null ? opts.oppMinCards : 99 };
    ctx.oppLow = ctx.oppMinCards <= 3;
    if (!current) {
      const c = eng.lead(hand, level, ctx);
      const plan = decompose(hand, level);
      return { action: "play", combo: c,
        reason: "你是首家，按最少 " + plan.length + " 手的计划先走小牌、保留炸弹：出 " + comboStr(c) };
    }
    ctx.ownerIsPartner = (opts.ownerSeat != null && opts.mySeat != null &&
      opts.ownerSeat === teammate(opts.mySeat));
    const c = eng.follow(hand, current, level, ctx);
    if (!c) {
      return { action: "pass", combo: null,
        reason: ctx.ownerIsPartner ? "台面是队友的牌，建议过牌不盖队友。"
                               : "无更优解或为保留炸弹，建议过牌。" };
    }
    const extra = c.isBomb ? "（对手快走完，动用炸弹拦截）" : "";
    return { action: "play", combo: c, reason: ("建议压牌：出 " + comboStr(c) + " " + extra).trim() };
  }

  const CAT_CN = {
    single: "单张", pair: "对子", triple: "三同张", full_house: "三带二",
    straight: "顺子", consec_pairs: "三连对", consec_triples: "钢板",
    bomb: "炸弹", straight_flush: "同花顺", joker_bomb: "天王炸",
  };
  function comboStr(c) {
    if (!c) return "过";
    return (CAT_CN[c.category] || c.category) + " [" + c.cards.map(cardStr).join(" ") + "]";
  }

  const API = {
    SUITS, RANK_NAMES, rankName, isJoker, cardStr, isWild, orderValue,
    beats, classify, genMoves, legalResponses, advise, chooseLead, chooseFollow,
    decompose, playsNeeded, leadV2, followV2, registerEngine, getEngine,
    comboStr, CAT_CN, card: (rank, suit) => ({ rank, suit: suit == null ? null : suit }),
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.Guandan = API;
})(typeof window !== "undefined" ? window : globalThis);
