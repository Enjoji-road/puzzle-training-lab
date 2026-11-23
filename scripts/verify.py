"""Verify every player-visible problem and any batch proposed for registration."""
import argparse
import json
from pathlib import Path
import re

from puzzle_identity import Uniqueness, route_layout
from verify_logic import verify_record as logic
from verify_routes import adjacency, enumerate_routes, satisfies, verify as route
from verify_symbols import verify as symbol

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dist" / "data"
VERIFIERS = {"route": route, "logic": logic, "symbol": symbol}
INITIAL = {f"{genre}-{level}" for genre in VERIFIERS for level in range(1, 6)}
SKILLS = set("条件の読み取り 局所的な推理 消去法 複数条件の統合 離れた情報の関連づけ 候補管理 仮定と場合分け 矛盾の検出 全体構造の把握 桁上がり・桁下がり".split())
DATA_FILENAME = re.compile(r"[a-z0-9][a-z0-9-]*\.json")


def records_from(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data or any(not isinstance(p, dict) for p in data):
        raise ValueError(f"{path.name}: 問題の配列を指定してください。")
    return data


def read_catalog(directory=DATA):
    manifest = json.loads((directory / "catalog.json").read_text(encoding="utf-8"))
    names = manifest.get("files", [])
    if manifest.get("version") != 1 or not names or len(names) != len(set(names)):
        raise ValueError("catalog.json の形式が正しくありません。")
    puzzles = []
    for name in names:
        if not DATA_FILENAME.fullmatch(name) or name == "catalog.json":
            raise ValueError(f"無効な問題ファイル名: {name}")
        puzzles.extend(records_from(directory / name))
    return manifest, puzzles


def estimate(puzzle):
    """Estimate with clue integration and proof structure. Ignore raw board size."""
    steps = puzzle.get("steps", [])
    refs = len({cid for step in steps for cid in step["clues"]})
    joint = sum(len(set(step["clues"])) >= 2 for step in steps)
    cases = sum(len(step.get("cases", [])) + sum("reject" in c for c in step.get("claims", []))
                for step in steps)
    intermediate = sum(bool(step.get("checks") or step.get("claims") or step.get("cases")) for step in steps)
    if not steps:
        refs = len(puzzle["clues"])
        return {"band": "要作問レビュー", "conditions": refs}
    score = min(refs, 6) + min(joint, 3) + min(cases, 2) + min(intermediate, 2)
    level = 5 if score >= 10 else 4 if score >= 7 else 3 if score >= 5 else 2 if score >= 3 else 1
    return {"level": level, "conditions": refs, "joint_steps": joint, "case_checks": cases,
            "intermediate_steps": intermediate}


def _validate_common(p):
    pid = p["id"]
    assert isinstance(pid, str) and re.fullmatch("[a-z0-9][a-z0-9-]*", pid), "invalid id"
    assert p["genre"] in VERIFIERS and type(p["level"]) is int and 1 <= p["level"] <= 5, "genre/level"
    assert p.get("pool", "main") in {"main", "review"}, "pool"
    assert p["skills"] and set(p["skills"]) <= SKILLS, "skills"
    assert all(isinstance(p[k], str) and p[k].strip() for k in ("title", "goal", "intro", "pitfall", "transfer")), "text"
    assert isinstance(p["rules"], list) and p["rules"] and all(isinstance(r, str) and r.strip() for r in p["rules"]), "rules"
    ids = {c["id"] for c in p["clues"]}
    assert ids and len(ids) == len(p["clues"]) and all(c["text"].strip() for c in p["clues"]), "clues"
    assert p["steps"] and all(st["title"].strip() for st in p["steps"]), "steps"
    for part in p["steps"] + p["hints"]:
        assert part["text"].strip() and part["clues"] and set(part["clues"]) <= ids, "explanation references"
    assert len(p["hints"]) == 3 and p["hints"][2].get("facts"), "third hint needs an actual move"
    assert set(p["hints"][2]["facts"]) < set(p["solution"]), "third hint reveals the entire board"
    if pid not in INITIAL:
        review = p.get("review", {})
        assert review.get("levelReviewed") is True and review.get("explanationReviewed") is True, "作問レビューが必要です"
        assert review.get("techniques") and all(isinstance(t, str) and t.strip() for t in review["techniques"]), "推理技法を記録してください"
        assert isinstance(review.get("notes"), str) and review["notes"].strip(), "レビュー記録を記入してください"
    if p["genre"] == "route":
        assert type(p["board"]["size"]) is int and 2 <= p["board"]["size"] <= 26, "列記号が使える盤面サイズにしてください"
    else:
        for table in p["board"]["tables"]:
            assert all("~" not in v for v in table["options"]), "~ is reserved for cell notes"
            assert all("~" not in r["key"] and r["key"] not in {"__proto__", "constructor", "prototype"}
                       for r in table["rows"]), "unsafe row key"


def validate(puzzles, *, against=(), require_initial=False):
    existing = list(against)
    if require_initial:
        assert INITIAL <= {p["id"] for p in puzzles if p.get("pool") != "review"}, "初期問題が不足しています"
    index = Uniqueness()
    for p in existing:
        index.add(p)
    report = []
    for p in puzzles:
        try:
            _validate_common(p)
            index.add(p)
            if p["genre"] == "route":
                paths = enumerate_routes(p)
                result = route(p, paths)
                ns = adjacency(p["board"])
                cons = p["board"]["constraints"]
                omissions = {co["id"]: sum(all(satisfies(path, c, ns) for c in cons if c is not co)
                                            for path in paths) for co in cons}
                if p["id"] in INITIAL:
                    assert all(n > 1 for n in omissions.values()), "redundant original clue"
                result["without_one_special_clue"] = omissions
            else:
                result = VERIFIERS[p["genre"]](p)
            result.update(genre=p["genre"], level=p["level"], hints=len(p["hints"]),
                          steps=len(p["steps"]), estimate=estimate(p))
            report.append(result)
        except (AssertionError, ValueError, KeyError, TypeError, IndexError, AttributeError) as error:
            raise ValueError(f'{p.get("id", "?")}: {error or "検証に失敗しました"}') from error
    return report


def run():
    _, puzzles = read_catalog()
    evidence = validate(puzzles, require_initial=True)
    layouts = {}
    shared_by_id = {}
    for p in puzzles:
        if p["genre"] == "route":
            aliases = layouts.setdefault(route_layout(p), [])
            aliases.append(p["id"])
            shared_by_id[p["id"]] = aliases
    for item in evidence:
        if item["id"] in shared_by_id:
            item["shared_route_layout"] = [pid for pid in shared_by_id[item["id"]] if pid != item["id"]]
    return evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        data = run()
    except (ValueError, AssertionError) as error:
        raise SystemExit(str(error)) from error
    if args.json:
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        for r in data:
            print(f"{r['id']:12} 1 solution, {r['hints']} hints, {r['steps']} explanation steps")
        print(f"PASS: {len(data)} problems, {sum(r['hints'] for r in data)} hints, {sum(r['steps'] for r in data)} explanation steps.")


if __name__ == "__main__":
    main()

