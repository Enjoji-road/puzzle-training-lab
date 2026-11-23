"""Check repeated IDs, titles and mechanically equivalent puzzle presentations."""
from itertools import permutations, product
import json
import re
from unicodedata import normalize

from verify_symbols import coefficients


def _json(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _route_signature(puzzle, include_clues):
    board = puzzle["board"]
    n = board["size"]
    coords = {cell["key"]: divmod(i, n) for i, cell in enumerate(board["cells"])}
    walkable = [cell for cell in board["cells"] if cell.get("given") != "B"]
    conditions = board["constraints"] if include_clues else []
    used = {c["key"] for c in walkable} | {c["at"] for c in conditions if "at" in c}
    versions = []
    for mirror, turns in product((False, True), range(4)):
        transformed = {}
        for key, (y, x) in coords.items():
            if mirror:
                x = -x
            for _ in range(turns):
                y, x = x, -y
            transformed[key] = y, x
        y0 = min(transformed[k][0] for k in used)
        x0 = min(transformed[k][1] for k in used)
        positions = {k: (y-y0, x-x0) for k, (y, x) in transformed.items()}
        path_cells = sorted((*positions[cell["key"]], cell.get("given", "-")) for cell in walkable)
        ends = sorted(positions[board[end]] for end in ("start", "finish"))
        refs = []
        for clue in conditions:
            kind = clue["type"]
            value = clue.get("number")
            if "at" in clue:
                refs.append((kind, positions[clue["at"]], value))
            else:
                cells = [positions[k] for k in clue["cells"]]
                if kind != "implies":
                    cells.sort()
                refs.append((kind, cells, value, clue.get("values", [])))
        versions.append(_json([path_cells, ends, sorted(refs, key=_json)]))
    return min(versions)


def route_layout(puzzle):
    return _route_signature(puzzle, include_clues=False)


def _logic_signature(puzzle):
    tables = puzzle["board"]["tables"]

    def expression(expr, ids, rows):
        if isinstance(expr, int):
            return expr
        op, *args = expr
        if op == "at":
            return op, rows[args[0]]
        if op == "changed":
            return op, ids[args[0]], args[1]
        if op in {"row", "inv"}:
            return op, ids[args[0]], expression(args[1], ids, rows)
        children = [expression(arg, ids, rows) for arg in args]
        if op in {"add", "and", "or", "eq", "ne", "distance"}:
            children.sort(key=_json)
        if op == "in":
            children[1:] = sorted(children[1:], key=_json)
        return op, children

    versions = []
    sizes = sorted({len(t["rows"]) for t in tables})
    groups = [permutations(t for t in tables if len(t["rows"]) == n) for n in sizes]
    for arrangement in product(*groups):
        order = [table for group in arrangement for table in group]
        ids = {t["id"]: i for i, t in enumerate(order)}
        rows = {r["key"]: (i, j) for i, t in enumerate(order) for j, r in enumerate(t["rows"])}
        clues = [expression(c["test"], ids, rows) for c in puzzle["clues"]]
        versions.append(_json([[len(t["rows"]) for t in order], sorted(clues, key=_json)]))
    return min(versions)


def _symbol_signature(puzzle):
    table = puzzle["board"]["tables"][0]
    keys = [r["key"] for r in table["rows"]]
    equations = []
    leads = set()
    for clue in puzzle["clues"]:
        spec = clue["constraint"]
        kind = spec["type"]
        if kind == "domain":
            continue
        if kind == "equation":
            terms = [(1, spec["left"]), (1 if spec["op"] == "+" else -1, spec["right"]), (-1, spec["result"])]
        else:
            terms = [(1, spec["left"]), (-1, spec["right"])]
        leads.update(word[0] for _, word in terms if len(word) > 1)
        constant, sparse = coefficients(terms, keys)
        weights = dict(sparse)
        equations.append((kind, constant, [weights.get(i, 0) for i in range(len(keys))]))

    # Coefficient magnitude and leading-zero restrictions are invariant under renaming.
    groups = {}
    for i, key in enumerate(keys):
        profile = (key in leads, tuple(sorted((kind, abs(w[i])) for kind, _, w in equations)))
        groups.setdefault(profile, []).append(i)
    versions = []
    for choices in product(*(permutations(groups[profile]) for profile in sorted(groups))):
        order = [i for group in choices for i in group]
        relations = []
        for kind, constant, weights in equations:
            values = (*[weights[i] for i in order], constant)
            if kind == "equation":
                values = min(values, tuple(-v for v in values))
            relations.append((kind, values))
        versions.append((tuple(keys[i] in leads for i in order), tuple(sorted(relations))))
    return _json([sorted(table["options"]), min(versions)])


def title_key(value):
    return re.sub(r"\s+", "", normalize("NFKC", value).casefold())


def signature(puzzle):
    genre = puzzle["genre"]
    if genre == "route":
        return genre, _route_signature(puzzle, include_clues=True)
    if genre == "logic":
        return genre, _logic_signature(puzzle)
    if genre == "symbol":
        return genre, _symbol_signature(puzzle)
    raise ValueError(f"unknown genre: {genre}")


class Uniqueness:
    def __init__(self):
        self.ids = set()
        self.titles = {}
        self.models = {}

    def add(self, puzzle):
        pid = puzzle["id"]
        name = title_key(puzzle["title"])
        model = signature(puzzle)
        if pid in self.ids:
            raise ValueError(f"IDが重複しています: {pid}")
        if name in self.titles:
            raise ValueError(f"題名が重複しています: {pid} / {self.titles[name]}")
        if model in self.models:
            raise ValueError(f"盤面と条件が重複しています: {pid} / {self.models[model]}")
        self.ids.add(pid)
        self.titles[name] = pid
        self.models[model] = pid

