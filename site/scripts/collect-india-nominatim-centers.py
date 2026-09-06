#!/usr/bin/env python3
"""Collect review coordinates for weak India LGD-to-GeoNames matches.

The collector is intentionally rate-limited to one request every 1.1 seconds
and writes a resumable JSON snapshot. It only queries entries whose existing
district-aware GeoNames match scores below 0.9.
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path


def search_name(value: str) -> str:
    value = value.replace("Co-Operation", "Corporation")
    value = re.sub(
        r"\b(?:Municipal Committee|Municipal Council|Municipal Board|"
        r"City Corporation|Municipal Corporation|Muncipal Council|"
        r"Nagar Parishad)\b",
        "",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"\((?:Gba|M Corp\.)\)", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\b(?:Mb|Np)\b$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip(" ,-()")
    return value


def load_importer(path: Path):
    spec = importlib.util.spec_from_file_location("india_city_importer", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main() -> None:
    if len(sys.argv) != 8:
        raise SystemExit(
            "用法：py -3.12 scripts/collect-india-nominatim-centers.py "
            "<urban_local_bodies.csv> <statewise_ulbs_coverage.csv> <IN.txt> "
            "<wikidata-lgd-coordinates.json> <output.json> <max-new-requests> "
            "<project-url>"
        )

    importer = load_importer(Path(__file__).with_name("import-india-municipal-cities.py"))
    ulbs = importer.parse_ulbs(Path(sys.argv[1]))
    coverage = importer.parse_coverage(Path(sys.argv[2]))
    geonames = importer.parse_geonames(Path(sys.argv[3]))
    wikidata = importer.parse_wikidata_points(Path(sys.argv[4]))
    output_path = Path(sys.argv[5])
    max_new = int(sys.argv[6])
    # Final positional value is a contact/project URL included in User-Agent.
    project_url = sys.argv[7]

    state_keys = importer.map_states(ulbs, geonames)
    district_keys, _ = importer.map_districts(ulbs, coverage, state_keys, geonames)
    places_by_state = defaultdict(list)
    places_by_district = defaultdict(list)
    places_by_id = {}
    for place in geonames:
        places_by_id[place["id"]] = place
        if place["feature_class"] != "P":
            continue
        places_by_state[place["admin1"]].append(place)
        places_by_district[(place["admin1"], place["admin2"])].append(place)

    weak = []
    for row in ulbs:
        _, score, method = importer.choose_point(
            row,
            coverage,
            state_keys[row["state"]],
            district_keys,
            places_by_state,
            places_by_district,
            places_by_id,
            wikidata,
            {},
        )
        if score < 0.9 and method != "wikidata-lgd":
            weak.append(row)

    if output_path.exists():
        snapshot = json.loads(output_path.read_text(encoding="utf-8"))
    else:
        snapshot = {
            "generated_at": "2026-09-06",
            "provider": "https://nominatim.openstreetmap.org/",
            "entries": {},
        }

    new_requests = 0
    for row in weak:
        code = row["code"]
        existing = snapshot["entries"].get(code)
        if existing and (existing["results"] or "fallback_query" in existing):
            continue
        if new_requests >= max_new:
            break
        district_names = [name for _, name in coverage.get(code, [])]
        if existing:
            query_parts = [search_name(importer.display_name(row["name"])), row["state"], "India"]
        else:
            query_parts = [
                search_name(importer.display_name(row["name"])),
                *district_names,
                row["state"],
                "India",
            ]
        query = ", ".join(dict.fromkeys(part for part in query_parts if part))
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
            {
                "q": query,
                "format": "jsonv2",
                "addressdetails": "1",
                "countrycodes": "in",
                "limit": "5",
            }
        )
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": f"travel-database-city-catalog/1.0 ({project_url})",
                "Accept-Language": "en",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                results = json.load(response)
        except Exception as error:
            print(f"请求失败 {code} / {query}: {error}")
            break
        if existing:
            existing["fallback_query"] = query
            existing["results"] = results
        else:
            snapshot["entries"][code] = {
                "name": row["name"],
                "state": row["state"],
                "districts": district_names,
                "query": query,
                "results": results,
            }
        output_path.write_text(
            json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        new_requests += 1
        print(f"{len(snapshot['entries'])}/{len(weak)} {code} {row['name']}: {len(results)} 个结果")
        time.sleep(1.1)

    print(
        f"本轮新增 {new_requests} 次请求；"
        f"已缓存 {len(snapshot['entries'])}/{len(weak)} 个低置信城市"
    )


if __name__ == "__main__":
    main()
