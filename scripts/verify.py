"""Verify every data file shipped by the static app. Requires Python 3.10+."""
import argparse
import json
from pathlib import Path
from verify_routes import verify as route, enumerate_routes, adjacency, satisfies
from verify_logic import verify_record as logic
from verify_symbols import verify as symbol

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dist" / "data"
CHECKS = {"route": route, "logic": logic, "symbol": symbol}
SKILLS = set("条件の読み取り 局所的な推理 消去法 複数条件の統合 離れた情報の関連づけ 候補管理 仮定と場合分け 矛盾の検出 全体構造の把握 桁上がり・桁下がり".split())


def run():
    manifest = json.loads((DATA / "catalog.json").read_text(encoding="utf8"))
    assert manifest["version"] == 1 and len(set(manifest["files"])) == len(manifest["files"])
    puzzles = []
    for name in manifest["files"]:
        path = DATA / name
        assert path.parent == DATA and path.suffix == ".json" and path.is_file()
        puzzles.extend(json.loads(path.read_text(encoding="utf8")))
    assert len({p["id"] for p in puzzles}) == len(puzzles)
    initials = {f"{genre}-{level}" for genre in CHECKS for level in range(1, 6)}
    assert initials <= {p["id"] for p in puzzles if p.get("pool") != "review"}
    report = []
    for p in puzzles:
        pref = p["id"] + " "
        assert p["genre"] in CHECKS and 1 <= p["level"] <= 5, pref
        assert p.get("pool", "main") in {"main", "review"}
        assert not (set(p["skills"]) - SKILLS) and p["skills"], pref + "skills"
        assert all(p[k] for k in ("title", "goal", "intro", "rules", "clues", "steps", "pitfall", "transfer")), pref
        ids = {c["id"] for c in p["clues"]}
        assert len(ids) == len(p["clues"]) and all(c["text"] for c in p["clues"])
        assert all(st["text"] and st["clues"] and set(st["clues"]) <= ids for st in p["steps"] + p["hints"])
        assert len(p["hints"]) == 3 and p["hints"][2].get("facts"), pref
        assert set(p["hints"][2]["facts"]) < set(p["solution"]), pref + "third hint reveals entire board"
        result = CHECKS[p["genre"]](p)
        if p["genre"] == "route":
            paths = enumerate_routes(p)
            ns = adjacency(p["board"])
            cons = p["board"]["constraints"]
            omissions = {co["id"]: sum(all(satisfies(r, c, ns) for c in cons if c is not co) for r in paths) for co in cons}
            if p["id"] in initials:
                assert all(n > 1 for n in omissions.values())
            result["without_one_special_clue"] = omissions
        result["hints"] = len(p["hints"])
        result["steps"] = len(p["steps"])
        report.append(result)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    data = run()
    if args.json:
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        for r in data:
            print(f"{r['id']:10} {r['solutions']} solution, {r['hints']} hints, {r['steps']} explanation steps")
        print(f"PASS: {len(data)} problems, {sum(r['hints'] for r in data)} hints, {sum(r['steps'] for r in data)} explanation steps.")

