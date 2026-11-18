"""Clean the original, book-based character-deaths.csv and build offline data."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "data" / "character-deaths.csv"
TARGET = ROOT / "data" / "character-deaths-cleaned.csv"
OFFLINE = ROOT / "data" / "characters.js"
SUMMARY = ROOT / "data" / "quality-report.json"
BOOKS = {1: "A Game of Thrones", 2: "A Clash of Kings", 3: "A Storm of Swords", 4: "A Feast for Crows", 5: "A Dance with Dragons"}
EXPECTED = ["Name", "Allegiances", "Death Year", "Book of Death", "Death Chapter", "Book Intro Chapter", "Gender", "Nobility", "GoT", "CoK", "SoS", "FfC", "DwD"]


def optional_int(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").astype("Int64")


def main() -> None:
    raw = pd.read_csv(SOURCE, dtype={"Name": "string", "Allegiances": "string"})
    if list(raw.columns) != EXPECTED:
        raise ValueError(f"Unexpected CSV columns: {list(raw.columns)!r}")
    report = {
        "source_rows": len(raw),
        "source_columns": list(raw.columns),
        "source_missing": {col: int(value) for col, value in raw.isna().sum().items()},
        "exact_duplicates": int(raw.duplicated().sum()),
    }
    df = raw.drop_duplicates().copy()
    df["Name"] = df["Name"].str.strip()
    df = df[df["Name"].notna() & df["Name"].ne("")].copy()
    for col in ["Death Year", "Book of Death", "Death Chapter", "Book Intro Chapter"]:
        df[col] = optional_int(df[col])
    for col in ["Gender", "Nobility", "GoT", "CoK", "SoS", "FfC", "DwD"]:
        df[col] = optional_int(df[col])
        if not df[col].isin([0, 1]).all():
            raise ValueError(f"Invalid binary values in {col}")
    if not df["Book of Death"].dropna().isin(BOOKS).all():
        raise ValueError("Book of Death outside 1–5")
    allegiance = df["Allegiances"].fillna("").str.strip()
    allegiance = allegiance.mask(allegiance.eq(""), "None")
    house = allegiance.where(~allegiance.isin(["Night's Watch", "Wildling", "None"]), allegiance)
    house = house.map(lambda x: x if x in ["Night's Watch", "Wildling", "None"] else "House " + x.removeprefix("House "))
    df["House"] = house
    df["Death Book Label"] = df["Book of Death"].map(BOOKS).fillna("Unknown")
    df["Death Status"] = df["Death Year"].notna().map({True: "Known year", False: "Unknown year"})
    df["Gender Label"] = df["Gender"].map({1: "Male", 0: "Female"})
    df["Nobility Label"] = df["Nobility"].map({1: "Noble", 0: "Non-noble"})
    df["Books Appeared"] = df[["GoT", "CoK", "SoS", "FfC", "DwD"]].sum(axis=1).astype("Int64")
    df["Death Year"] = df["Death Year"].where(df["Death Year"].between(0, 999))
    df.to_csv(TARGET, index=False, encoding="utf-8-sig")
    records = json.loads(df.to_json(orient="records"))
    OFFLINE.write_text("window.GOT_DATA = " + json.dumps(records, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    report.update({
        "cleaned_rows": len(df),
        "cleaned_missing": {col: int(value) for col, value in df.isna().sum().items()},
        "known_death_year": int(df["Death Year"].notna().sum()),
        "known_death_book": int(df["Book of Death"].notna().sum()),
        "mean_death_year": round(float(df["Death Year"].mean()), 2),
        "death_books": {BOOKS[int(book)]: int(count) for book, count in df["Book of Death"].value_counts().sort_index().items()},
        "houses": {str(house): int(count) for house, count in df["House"].value_counts().items()},
    })
    SUMMARY.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
