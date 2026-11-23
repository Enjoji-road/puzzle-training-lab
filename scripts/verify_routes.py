"""Enumerate induced orthogonal S–G paths. Standard Python 3, no puzzle answers used for search."""
from pathlib import Path
import argparse
import json


def adjacency(board):
    n = board["size"]
    by_position = {(i // n, i % n): cell["key"] for i, cell in enumerate(board["cells"])}
    return {
        key: [by_position[p] for p in ((r-1,c), (r+1,c), (r,c-1), (r,c+1)) if p in by_position]
        for (r,c), key in by_position.items()
    }


def enumerate_routes(puzzle):
    board = puzzle["board"]
    neighbors = adjacency(board)
    start, finish = board["start"], board["finish"]
    cells = board["cells"]
    available = {c["key"] for c in cells if c.get("given") != "B"}
    required = {c["key"] for c in cells if c.get("given") == "W"}
    found = []
    traversed = {start}

    def extend(tail):
        if tail == finish:
            if required <= traversed:
                found.append(frozenset(traversed))
            return
        for v in neighbors[tail]:
            if v not in available or v in traversed:
                continue
            # Taking an adjacent occupied cell would introduce a chord, branch or cycle.
            if any(w in traversed and w != tail for w in neighbors[v]):
                continue
            traversed.add(v)
            extend(v)
            traversed.remove(v)

    extend(start)
    return found


def satisfies(route, condition, neighbors):
    kind = condition["type"]
    if kind == "count":
        return sum(key in route for key in neighbors[condition["at"]]) == condition["number"]
    if kind in ("straight", "turn"):
        at = condition["at"]
        if at not in route:
            return False
        adjacent_white = [key for key in neighbors[at] if key in route]
        if len(adjacent_white) != 2:
            return False
        left, right = [tuple(map(int, v[1:].split("c"))) for v in adjacent_white]
        straight = left[0] == right[0] or left[1] == right[1]
        return straight == (kind == "straight")
    if kind == "quota":
        return sum(key in route for key in condition["cells"]) == condition["number"]
    if kind == "same":
        return len(set(key in route for key in condition["cells"])) == 1
    if kind == "different":
        a, b = condition["cells"]
        return (a in route) != (b in route)
    if kind == "implies":
        a, b = condition["cells"]
        a_value, b_value = condition["values"]
        return (a in route) != (a_value == "W") or (b in route) == (b_value == "W")
    raise ValueError(f"Unknown route constraint: {kind}")


def verify(puzzle, candidates=None):
    board = puzzle["board"]
    n = board["size"]
    cells = board["cells"]
    expected_keys = [f"r{r+1}c{c+1}" for r in range(n) for c in range(n)]
    assert [c["key"] for c in cells] == expected_keys
    assert all(c["label"] == f"{chr(65+i%n)}{1+i//n}" for i,c in enumerate(cells))
    labels = {c["key"]: c for c in cells}
    assert all(c.get("given") in (None,"B","W") for c in cells)
    assert labels[board["start"]]["badge"] == "S" and labels[board["finish"]]["badge"] == "G"
    assert labels[board["start"]]["given"] == labels[board["finish"]]["given"] == "W"
    editable = {c["key"] for c in cells if not c.get("given")}
    assert set(puzzle["solution"]) == editable
    assert set(puzzle["solution"].values()) <= {"W","B"}
    given_badges = {c["key"]:c["badge"] for c in cells if "badge" in c}
    for co in board["constraints"]:
        if co["type"] == "count":
            assert given_badges[co["at"]] == str(co["number"])
            assert labels[co["at"]]["given"] == "B"
        if co["type"] in ("straight","turn"):
            assert given_badges[co["at"]] == {"straight":"直","turn":"曲"}[co["type"]]
            assert labels[co["at"]]["given"] == "W"
        assert all(k in labels for k in co.get("cells",[]))
    neighbors = adjacency(board)
    if candidates is None:
        candidates = enumerate_routes(puzzle)
    co_by_id = {c["id"]:c for c in board["constraints"]}
    clue_ids = {c["id"] for c in puzzle["clues"]}
    assert len(co_by_id) == len(board["constraints"])
    assert set(co_by_id) <= clue_ids and len(clue_ids) == len(puzzle["clues"])
    valid = [path for path in candidates if all(satisfies(path,c,neighbors) for c in co_by_id.values())]
    assert len(valid) == 1, (puzzle["id"],"solution count",len(valid))
    expected = {v:("W" if v in valid[0] else "B") for v in editable}
    assert puzzle["solution"] == expected
    cases_checked = 0

    def matching(refs, facts):
        chosen = [co_by_id[i] for i in refs if i in co_by_id]
        return [path for path in candidates if all(satisfies(path,c,neighbors) for c in chosen) and
                all((key in path) == (val == "W") for key,val in facts.items())]

    def check_facts(item, premise):
        nonlocal cases_checked
        assert set(item["clues"]) <= clue_ids
        asserted = item.get("facts",{})
        assert set(asserted) <= editable
        models = matching(item["clues"], premise)
        assert models, (puzzle["id"],"inconsistent premises",item)
        for key,val in asserted.items():
            assert val in ("B","W") and all((key in p) == (val == "W") for p in models), (puzzle["id"], "unsupported assertion",key,item.get("title",item.get("text")))
        for case in item.get("cases", []):
            assume, before, rejected_by = case["assume"], case["before"], case["by"]
            assert assume and set(assume) <= editable and not set(assume) & premise.keys()
            assert set(assume.values()) <= {"B", "W"}
            assert rejected_by not in before and set([*before, rejected_by]) <= set(item["clues"])
            branch = premise | assume
            possible = matching(before, branch)
            assert possible, (puzzle["id"], "branch impossible before contradiction", case)
            for key, value in case.get("holds", {}).items():
                assert key in editable and value in ("B", "W")
                assert all((key in p) == (value == "W") for p in possible), (puzzle["id"], "unsupported branch assertion", case)
            assert not matching([*before, rejected_by], branch), (puzzle["id"], "branch survives contradiction", case)
            cases_checked += 1
    assert len(puzzle["hints"]) == 3 and puzzle["hints"][2].get("facts")
    assert len(puzzle["hints"][2]["facts"]) < len(editable)
    for hint in puzzle["hints"]:
        check_facts(hint,{})
    context = {}
    for step in puzzle["steps"]:
        assert step.get("facts"), (puzzle["id"],step["title"])
        check_facts(step,context)
        context.update(step["facts"])
    assert context == expected, (puzzle["id"],"walkthrough does not reconstruct board",editable-set(context))
    return {"id":puzzle["id"],"size":n,"editable":len(editable),"base_paths":len(candidates),"solutions":len(valid),"walkthrough_steps":len(puzzle["steps"]),"step_assignments":len(context),"branches":cases_checked}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", nargs="?", type=Path)
    args = parser.parse_args()
    file = args.file or next((p for p in [Path(__file__).with_name("routes.json"),Path(__file__).resolve().parents[1]/"dist"/"data"/"routes.json"] if p.exists()),None)
    if file is None:
        parser.error("Pass the path to routes.json")
    data = json.loads(file.read_text(encoding="utf-8"))
    assert len({p["id"] for p in data}) == len(data)
    for puzzle in data:
        if puzzle.get("genre") == "route":
            print(json.dumps(verify(puzzle), ensure_ascii=False))


if __name__ == "__main__":
    main()
