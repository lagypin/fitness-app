import "../styles.css";
import { PRINCIPLES, SOURCES, doiUrl } from "../engine/evidence.js";
import { ACE_LIBRARY_URL } from "../exercises.js";

/**
 * The standalone Why page at /why, built from evidence.js so the app and the
 * page share one source of truth. A Home Screen web app has no browser back
 * button, so the page carries its own "Back to Move" link.
 */
export default function WhyPage() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <a className="header-link" href="/"><span aria-hidden="true">← </span>Back to Move</a>
            <h1 className="app-title" style={{ marginTop: 8 }}>Why the app works this way</h1>
          </div>
        </div>
      </header>

      <main className="scroll">
        <div className="card">
          <p className="plan-meta" style={{ marginTop: 0 }}>
            Each card pairs a rule the app follows with the research behind it and the limits of that research.
            Citations were checked against PubMed in November 2026.
          </p>
          <p className="plan-meta">
            This is general fitness guidance and does not replace advice from a clinician who knows you.
            Exercise form guides link to the{" "}
            <a href={ACE_LIBRARY_URL} target="_blank" rel="noreferrer">ACE exercise library</a>.
          </p>
        </div>

        {PRINCIPLES.map((p) => (
          <article key={p.id} className="card why-card" id={p.id}>
            <h2>{p.title}</h2>
            <h3>What the app does</h3>
            <p>{p.rule}</p>
            <h3>What the research found</h3>
            <p>{p.evidence}</p>
            {p.limits && (<><h3>Limits</h3><p>{p.limits}</p></>)}
            {p.sources.length > 0 && (
              <>
                <h3>Sources</h3>
                <ul>
                  {p.sources.map((key) => {
                    const src = SOURCES[key];
                    return (
                      <li key={key}>
                        <a href={doiUrl(src.doi)} target="_blank" rel="noreferrer">
                          {src.cite}. {src.title}. {src.journal}.
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </article>
        ))}

        <p style={{ textAlign: "center", marginTop: 8 }}>
          <a className="btn-link" href="/"><span aria-hidden="true">← </span>Back to Move</a>
        </p>
      </main>
    </div>
  );
}
