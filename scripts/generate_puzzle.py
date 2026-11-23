"""Generate reproducible, unregistered drafts for each of the three genres."""
from collections.abc import Callable
from functools import reduce
from itertools import permutations
from operator import and_
from random import Random

from puzzle_identity import Uniqueness
from verify import read_catalog
from verify_logic import Model
from verify_routes import adjacency, enumerate_routes, satisfies
from verify_symbols import Evidence, parse_clue

TAGS = {
    "route": ["離れた情報の関連づけ", "全体構造の把握", "仮定と場合分け"],
    "logic": ["複数条件の統合", "離れた情報の関連づけ", "仮定と場合分け"],
    "symbol": ["候補管理", "複数条件の統合", "桁上がり・桁下がり"],
}
NAMES = {"route": "白黒ルート", "logic": "複合条件", "symbol": "覆面算"}
MARKS = dict(zip("abcdefg", "○△□◇☆◎▽"))


def _select(worlds, proposals, min_clues, max_clues, rng, accept: Callable | None = None):
    """Assemble essential clues that progressively narrow a finite set of models."""
    initial = (1 << len(worlds)) - 1
    choices = []
    seen = set()
    for data, test in proposals:
        support_bytes = bytearray((len(worlds) + 7) // 8)
        for i, world in enumerate(worlds):
            if test(world):
                support_bytes[i // 8] |= 1 << (i % 8)
        support = int.from_bytes(support_bytes, "little")
        if 1 < support.bit_count() < len(worlds) and support not in seen:
            seen.add(support)
            choices.append((data, support))
    for _ in range(120):
        remaining, selected, counts = initial, [], [len(worlds)]
        for _ in range(max_clues):
            eligible = []
            for data, support in choices:
                narrowed = remaining & support
                count = narrowed.bit_count()
                if 0 < count < counts[-1] and (count > 1 or len(selected) + 1 >= min_clues):
                    eligible.append((data, support, narrowed, count))
            if not eligible:
                break
            # Mix modest and decisive moves so the early clues do not settle the board at once.
            desired = .32 if len(selected) >= min_clues - 1 else .63
            eligible.sort(key=lambda item: abs(item[3] / counts[-1] - desired) + rng.random() * .35)
            data, support, remaining, count = rng.choice(eligible[:6])
            selected.append((data, support))
            counts.append(count)
            if count == 1:
                break
        if counts[-1] != 1:
            continue
        clues = [data for data, _ in selected]
        if accept is not None and not accept(clues):
            continue
        # Each proposal must add information, including when the clues are used in a different order.
        if any(reduce(and_, (s for j, (_, s) in enumerate(selected) if i != j), initial).bit_count() == 1
               for i in range(len(selected))):
            continue
        return clues, worlds[remaining.bit_length() - 1], counts
    return None


def _route(level, rng, puzzles):
    templates = [p for p in puzzles if p["genre"] == "route" and p["level"] >= 4]
    rng.shuffle(templates)
    for template in templates:
        src = template["board"]
        board = {**src, "cells": [{k: v for k, v in cell.items() if k != "badge" or v in {"S", "G"}}
                                  for cell in src["cells"]], "constraints": []}
        worlds = enumerate_routes({"board": board})
        if len(worlds) < (12 if level == 4 else 32):
            continue
        ns = adjacency(board)
        cells = {cell["key"]: cell for cell in board["cells"]}
        variable = [key for key in cells if not cells[key].get("given")
                    and 0 < sum(key in route for route in worlds) < len(worlds)]
        labels = {k: c["label"] for k, c in cells.items()}
        proposals = []
        for at, cell in cells.items():
            if cell.get("given") == "B":
                for number in {sum(k in w for k in ns[at]) for w in worlds}:
                    cond = {"type": "count", "at": at, "number": number}
                    proposals.append((cond, f'{cell["label"]}の上下左右のうち白は{number}マス。'))
        for _ in range(72):
            if len(variable) < 3:
                break
            ab = rng.sample(variable, 3)
            if abs(int(labels[ab[0]][1:]) - int(labels[ab[1]][1:])) + abs(ord(labels[ab[0]][0]) - ord(labels[ab[1]][0])) < 3:
                continue
            a, b, c = (labels[k] for k in ab)
            kind = rng.choice(("same", "different", "implies", "quota"))
            if kind == "same":
                proposals.append(({"type": kind, "cells": ab[:2]}, f"{a}と{b}は同じ色。"))
            if kind == "different":
                proposals.append(({"type": kind, "cells": ab[:2]}, f"{a}と{b}は異なる色。"))
            if kind == "implies":
                proposals.append(({"type": kind, "cells": ab[:2], "values": ["W", "B"]}, f"{a}が白なら、{b}は黒。"))
            if kind == "quota":
                count = rng.choice((1, 2))
                proposals.append(({"type": kind, "cells": ab, "number": count}, f"{a}・{b}・{c}のうち白はちょうど{count}マス。"))
        matched = _select(
            worlds, [((c, text), lambda w, c=c: satisfies(w, c, ns)) for c, text in proposals],
            3 if level == 4 else 5, 5 if level == 4 else 7, rng,
            lambda items: len({c["type"] for c, _ in items}) >= (2 if level == 4 else 3)
            and len({c["at"] for c, _ in items if c["type"] == "count"}) == sum(c["type"] == "count" for c, _ in items),
        )
        if not matched:
            continue
        chosen, route, counts = matched
        clues = [{"id": "c1", "text": "SからGまで、すべての白を枝分かれのない一本道で結ぶ。"}]
        for i, (cond, text) in enumerate(chosen, 2):
            cid = f"c{i}"
            if cond["type"] == "count":
                cells[cond["at"]]["badge"] = str(cond["number"])
            board["constraints"].append({"id": cid, **cond})
            clues.append({"id": cid, "text": text})
        answer = {key: "W" if key in route else "B" for key, cell in cells.items() if not cell.get("given")}
        return board, clues, answer, template["rules"], counts


def _logic(level, rng, _):
    names = [("cards", "紋章", ("月", "灯", "羽", "雲")),
             ("bags", "荷物", ("地図", "鍵", "時計", "巻物")),
             ("guests", "案内人", ("アオ", "レン", "ナギ", "ユイ"))]
    size = 3 if level == 4 else 4
    tables = []
    options = [f"{i}便" for i in range(1, size+1)]
    for tid, title, labels in names:
        tables.append({"id": tid, "title": title+"と出発便", "rows": [{"key": f"{tid}-{i}", "label": label}
                      for i, label in enumerate(labels[:size], 1)], "options": options, "distinct": True})
    model = Model(tables)
    rows = [row for table in tables for row in table["rows"]]
    ops = []

    def comparison(a, b):
        left, right = ["at", a["key"]], ["at", b["key"]]
        x, y = a["label"], b["label"]
        kind = rng.randrange(5)
        if kind == 0:
            return ["eq", left, right], f"{x}と{y}は同じ便"
        if kind == 1:
            return ["lt", left, right], f"{x}は{y}より早い便"
        if kind == 2:
            return ["eq", ["add", left, 1], right], f"{y}は{x}の次の便"
        if kind == 3:
            return ["eq", ["distance", left, right], 2], f"{x}と{y}の間には1便ある"
        return ["ne", left, right], f"{x}と{y}は別の便"

    for i in range(50):
        a, b, c, d = rng.sample(rows, 4)
        test, meaning = comparison(a, b)
        if i % 4 == 0:
            second, another = comparison(c, d)
            ops.append((["ne", test, second], f"「{meaning}」「{another}」の片方だけが正しい。"))
        elif a["key"].split("-")[0] != b["key"].split("-")[0]:
            ops.append((test, meaning+"。"))
    accept = lambda clues: (size == 3 or any("片方" in text for _, text in clues)) and all(
        any(tid+"-" in str(expr) for expr, _ in clues) for tid, _, _ in names)
    matched = _select(model.worlds, [((expr, text), lambda w, e=expr: bool(model.ev(e, w)))
                                    for expr, text in ops], 5 if size == 3 else 7, 10, rng, accept)
    if matched:
        chosen, world, counts = matched
        clues = [{"id": f"c{i}", "test": expr, "text": text} for i, (expr, text) in enumerate(chosen, 1)]
        return {"tables": tables}, clues, model.decoded(world), [
            "便番号が小さいものから順に出発する。各便には紋章・荷物・案内人が一つずつ対応する。",
            "それぞれの表で各便を一度ずつ使う。別の表でも同じ便番号は同じ便を指す。"
        ], counts


def _symbol(level, rng, _):
    size = 5 if level == 4 else 6
    digits = sorted(rng.sample(range(1, 10), size + 2))
    target = rng.sample(digits, size)
    keys = list(MARKS)[:size]
    glyphs = {k: MARKS[k] for k in keys}
    encode = dict(zip(map(str, target), keys))
    domain = list(map(str, digits))
    board = {"symbols": glyphs, "tables": [{"id": "digits", "title": "記号と数字", "distinct": True,
             "options": domain, "rows": [{"key": k, "label": glyphs[k]} for k in keys]}]}
    digit_clue = {"id": "c1", "text": f"使える数字は{'・'.join(domain)}です。",
                  "constraint": {"type": "domain", "digits": domain}}
    proposals = {}
    for _ in range(1100):
        left = int("".join(map(str, rng.choices(target, k=rng.choice((2, 3))))))
        right = int("".join(map(str, rng.choices(target, k=rng.choice((1, 2, 3))))))
        op = rng.choice(("+", "-"))
        answer = left + right if op == "+" else left - right
        numeric = f"{left}{right}{answer}"
        if not set(numeric) <= encode.keys() or len(set(numeric)) < 3:
            continue
        if op == "+":
            has_regrouping = any(int(x) + int(y) >= 10 for x, y in zip(str(left)[::-1], str(right)[::-1]))
        else:
            has_regrouping = any(x < y for x, y in zip(str(left)[::-1], str(right)[::-1]))
        if not has_regrouping:
            continue
        if op == "+":
            left, right = sorted((left, right))

        def word(number):
            return "".join(encode[digit] for digit in str(number))

        spec = {"type": "equation", "op": op, "left": word(left), "right": word(right), "result": word(answer)}
        parts = ["".join(glyphs[k] for k in spec[t]) for t in ("left", "right", "result")]
        clue = {"id": "draft", "constraint": spec, "text": f"{parts[0]} {'＋' if op == '+' else '−'} {parts[1]} ＝ {parts[2]}"}
        proposals[(left, op, right)] = clue
        if len(proposals) >= 75:
            break

    def accept(clues):
        words = [c["constraint"] for c in clues]
        used = {ch for word in words for key in ("left", "right", "result") for ch in word[key]}
        return used == set(keys) and (level == 4 or {w["op"] for w in words} == {"+", "-"})

    count = 2 if level == 4 else 3
    candidates = list(permutations(digits, size))
    matched = _select(candidates, [(clue, parse_clue(clue, keys, glyphs, domain)[0])
                                   for clue in proposals.values()], count, count, rng, accept)
    if matched:
        chosen, world, counts = matched
        clues = [digit_clue, *[{**c, "id": f"c{i}"} for i, c in enumerate(chosen, 2)]]
        board["equations"] = [c["text"] for c in chosen]
        ev = Evidence({"board": board, "clues": clues, "rules": ["先頭に0は置けません。"]})
        assert ev.satisfying(list(ev.bits)) == [world]
        return board, clues, dict(zip(keys, map(str, world))), [
            "異なる記号は異なる数字。複数の式で同じ記号はいつも同じ数字を表す。",
            "隣り合う記号は十進法の数を表し、2桁以上の数の先頭に0は置けません。"
        ], counts


GENERATORS = {"route": _route, "logic": _logic, "symbol": _symbol}


def generate(genre, level, seed, *, catalog=None, earlier=()):
    """Return a draft and evidence counts. No changes are made to the catalog."""
    existing = read_catalog()[1] if catalog is None else catalog
    index = Uniqueness()
    for puzzle in [*existing, *earlier]:
        index.add(puzzle)
    rng = Random(seed)
    for _ in range(8):
        result = GENERATORS[genre](level, rng, existing)
        if result is None:
            continue
        board, clues, solution, rules, counts = result
        puzzle = {
            "id": f"{genre}-{level}-draft-{rng.getrandbits(32):08x}",
            "genre": genre, "level": level, "title": f"{NAMES[genre]} Lv.{level} 候補 {rng.getrandbits(16):04x}",
            "goal": "", "intro": "", "skills": TAGS[genre], "rules": rules, "board": board,
            "clues": clues, "solution": solution, "hints": [], "steps": [], "pitfall": "", "transfer": "",
            "review": {"levelReviewed": False, "explanationReviewed": False, "techniques": [], "notes": ""},
        }
        try:
            index.add(puzzle)
        except ValueError:
            continue
        return puzzle, counts
    raise ValueError("このシードで一意解の候補を作れませんでした。別のシードを指定してください。")

