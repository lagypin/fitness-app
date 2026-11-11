import { useMemo, useState } from "react";
import { EXERCISES, FORM_GUIDES, ACE_LIBRARY_URL } from "../exercises.js";

const CATS = ["all", "squat", "hinge", "press", "pull", "core", "mobility"];

export default function LibraryScreen() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");

  const filtered = useMemo(
    () => EXERCISES.filter((e) =>
      (cat === "all" || e.category === cat) &&
      (!query || e.name.toLowerCase().includes(query.toLowerCase()))),
    [query, cat]
  );

  return (
    <>
      <label className="sr-only" htmlFor="lib-search">Search exercises</label>
      <input id="lib-search" className="search-input" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="chips" role="group" aria-label="Category" style={{ marginBottom: 10 }}>
        {CATS.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      <p className="muted" role="status" style={{ marginBottom: 10 }}>
        {filtered.length} exercises. Form guides link to the{" "}
        <a href={ACE_LIBRARY_URL} target="_blank" rel="noreferrer">ACE exercise library (opens in a new tab)</a>.
      </p>
      {filtered.map((ex) => (
        <div key={ex.id} className="card">
          <h3 className="lib-name">{ex.name}</h3>
          <div className="lib-meta">
            <span className="tag">{ex.category}</span>{" "}
            {ex.isAnchor && <span className="tag green">main lift</span>}{" "}
            {ex.equipment.join(", ").replace(/_/g, " ")} · {ex.defaultSets} × {ex.defaultReps}
          </div>
          {ex.notes && <p className="lib-notes">{ex.notes}</p>}
          {FORM_GUIDES[ex.id] && (
            <p className="ex-links">
              <a href={FORM_GUIDES[ex.id]} target="_blank" rel="noreferrer">Form guide for {ex.name} (ACE, opens in a new tab)</a>
            </p>
          )}
        </div>
      ))}
    </>
  );
}
