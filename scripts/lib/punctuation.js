'use strict';

// 句末/分句标点紧挨另一个标点（。。 。， 。； 。、 ：。）几乎只可能是句子被切断或拼接留下的痕迹，
// 常见于自动改写“在句中插入一句总结”：原句 F1 + 。 + F2 被拆成 F1 / 总结。。F2 之类。
// ？！ 之间的组合是合法的强调写法，不报；省略号、括号、引号不在字符集内，所以 …… 。 ） ” 后接句号照常通过。
const COLLISION = /[。，；：、][。，；：、！？]|[！？][。，；：、]/g;

// 返回正文里所有“标点相撞”的匹配（带 index），调用方负责把 index 映射回原文位置。
function collisions(text) {
  return [...text.matchAll(COLLISION)];
}

module.exports = { collisions };
