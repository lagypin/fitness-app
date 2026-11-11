import { PRINCIPLES, SOURCES, doiUrl } from "../engine/evidence.js";
import { ACE_LIBRARY_URL } from "../exercises.js";

export default function WhyScreen() {
  return (
    <>
      <div className="card">
        <h2 className="plan-title">Why the app works this way</h2>
        <p className="plan-meta">
          Each card pairs a rule the app follows with the research behind it and the limits of that research.
          Citations were checked against PubMed in November 2026.
        </p>
        <p className="plan-meta">
          This is general fitness guidance and does not replace advice from a clinician who knows you.
          Exercise form guides link to the{" "}
          <a href={ACE_LIBRARY_URL} target="_blank" rel="noreferrer">ACE exercise library (opens in a new tab)</a>.
        </p>
      </div>

      {PRINCIPLES.map((p) => (
        <article key={p.id} className="card why-card" id={`why-${p.id}`}>
          <h3>{p.title}</h3>
          <h4>What the app does</h4>
          <p>{p.rule}</p>
          <h4>What the research found</h4>
          <p>{p.evidence}</p>
          {p.limits && (<><h4>Limits</h4><p>{p.limits}</p></>)}
          {p.sources.length > 0 && (
            <>
              <h4>Sources</h4>
              <ul>
                {p.sources.map((key) => {
                  const src = SOURCES[key];
                  return (
                    <li key={key}>
                      <a href={doiUrl(src.doi)} target="_blank" rel="noreferrer">
                        {src.cite}. {src.title}. {src.journal}. (opens in a new tab)
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </article>
      ))}
    </>
  );
}
