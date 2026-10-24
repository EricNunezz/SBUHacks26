export default function NodePanel({node, nodes, edges, onClose}){

  const {label, summary, key_points = [], files = []} = node.data; 
  
  //turn the node id like "api" into its label like "API Server"
  const nameOf = (id) => nodes.find((n) => n.id === id)?.data.label ?? id;

  //figure out the connections from the edges 
  const outgoing = edges.filter((e) => e.source === node.id);
  const incoming = edges.filter((e) => e.target === node.id);


  return (
    <aside className="absolute right-4 top-4 bottom-4 w-96 overflow-y-auto rounded-xl border bg-background p-5 shadow-lg">
      {/*Header */}
      <div className="mb-4 flex items-start justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <button
          onClick={onClose}
          className="rounded px-2 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      {/* Plain english summary */}
      <Section title="In plain English">
        <p className="text-sm leading-relaxed">{summary}</p>
      </Section>
      {/* Key points */}
      {key_points.length > 0 && (
        <Section title="Key points">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {key_points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Section>
      )}
      {/* connections */ }
      {(outgoing.length > 0 || incoming.length > 0) && (
        <Section title="Connects to">
          <ul className="space-y-1 text-sm">
            {outgoing.map((e) => (
              <li key={e.id}>→ {e.label} <b>{nameOf(e.target)}</b></li>
            ))}
            {incoming.map((e) => (
              <li key={e.id}>← <b>{nameOf(e.source)}</b> {e.label} this</li>
            ))}
          </ul>
        </Section>
      )}
      {/* files */}
      {files.length > 0 && (
        <Section title="Main files">
          <ul className="space-y-1 font-mono text-xs">
            {files.map((file) => (
              <li key={file} className="rounded bg-muted px-2 py-1">{file}</li>
            ))}
          </ul>
        </Section>
      )}
    </aside>
  );
}

function Section({title, children}){
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

