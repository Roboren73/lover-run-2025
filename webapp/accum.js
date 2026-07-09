// 认牌累加器（带去误检投票 + 手动删除封顶）。
// 为什么单独一个文件：和 guandan.js 一样双环境(浏览器/Node)，逻辑不碰 DOM，
// 可以在 node webapp/test.js 里直接回归测试。
//
// 解决的问题：旧版累加器 accum.set(k, Math.max(...)) 只增不减——摄像头一帧
// 误识别就会永久混进一张"幽灵牌"，只能全部清空重扫。
// 现在：
//   1. 扫描模式下，一张牌（的某个数量）要在 >=confirmFrames 帧里出现过
//      才被确认入表——单帧闪现的误检根本进不来；
//   2. 点牌面可删除一张；删除会"封顶"，后续扫描不会把它自动加回来
//      （直到手动清空）。「📸 单张识别」是用户明确按下的，走 instant 直接入表。
(function (root) {
  function createAccumulator(opts) {
    opts = opts || {};
    var CONFIRM = opts.confirmFrames != null ? opts.confirmFrames : 2;
    var MAX = opts.maxCount != null ? opts.maxCount : 2; // 两副牌，同一张最多2份
    var confirmed = new Map(); // key -> 已确认份数
    var pending = new Map();   // key+'@'+目标份数 -> 已见帧数
    var cap = new Map();       // key -> 手动删除后的上限(自动累加不得超过)

    // frameCounts: Map(key -> 本帧同时出现的份数)。instant=true 跳过投票(单张识别)。
    function addFrame(frameCounts, instant) {
      for (var entry of frameCounts) {
        var k = entry[0], n0 = entry[1];
        var limit = cap.has(k) ? cap.get(k) : MAX;
        var target = Math.min(n0, MAX, limit);
        if (target <= (confirmed.get(k) || 0)) continue;
        if (instant || CONFIRM <= 1) {
          confirmed.set(k, target);
          pending.delete(k + "@" + target);
          continue;
        }
        var pk = k + "@" + target;
        var seen = (pending.get(pk) || 0) + 1;
        if (seen >= CONFIRM) { confirmed.set(k, target); pending.delete(pk); }
        else pending.set(pk, seen);
      }
    }

    // 删除一份，并封顶：本轮扫描不会自动加回（清空后恢复）
    function remove(k) {
      var cur = confirmed.get(k) || 0;
      if (!cur) return;
      var nv = cur - 1;
      if (nv <= 0) confirmed.delete(k); else confirmed.set(k, nv);
      cap.set(k, nv);
      for (var pk of Array.from(pending.keys()))
        if (pk.indexOf(k + "@") === 0) pending.delete(pk);
    }

    function counts() { return new Map(confirmed); }
    function size() { var s = 0; for (var v of confirmed.values()) s += v; return s; }
    function clear() { confirmed.clear(); pending.clear(); cap.clear(); }

    return { addFrame: addFrame, remove: remove, counts: counts, size: size, clear: clear };
  }

  var API = { createAccumulator: createAccumulator };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.CardAccum = API;
})(typeof self !== "undefined" ? self : this);
