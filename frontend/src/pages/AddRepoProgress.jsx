import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProgressCog from "@/components/ProgressCog";
import useEstimatedProgress from "@/hooks/useEstimatedProgress";
import { cn } from "@/lib/utils";

const STEPS = [
  { at: 0, label: "Reading the file tree" },
  { at: 25, label: "Grouping the codebase" },
  { at: 50, label: "Writing explanations" },
  { at: 75, label: "Drawing the diagram" },
];

// Shown while a repo is being added. runAdd() resolves with the new repo (or throws);
// onComplete(repo) fires after the cog fills; onAddDifferent() leaves after an error.
export default function AddRepoProgress({ name, runAdd, onComplete, onAddDifferent, differentLabel = "Add a different repo" }) {
  const { progress, slow, start, finish, stop } = useEstimatedProgress();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const inFlight = useRef({ attempt: -1, promise: null }); // StrictMode runs effects twice; send one request

  useEffect(() => {
    let live = true;
    setError("");
    start();

    if (inFlight.current.attempt !== attempt) {
      inFlight.current = { attempt, promise: runAdd() };
    }
    inFlight.current.promise.then(
      async (repo) => {
        if (!live) return;
        await finish();
        if (live) onComplete(repo);
      },
      (err) => {
        if (!live) return;
        stop();
        setError(err.message || "Couldn't add that repo.");
      }
    );

    return () => {
      live = false;
      stop();
    };
  }, [attempt]);

  const current = STEPS.findLastIndex((s) => progress >= s.at);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-sm">{name}</p>
      <ProgressCog progress={progress} error={Boolean(error)} />

      {error ? (
        <div className="flex max-w-sm flex-col items-center gap-4">
          <p role="alert" className="text-sm" style={{ color: "var(--rust)" }}>
            {error}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
            {onAddDifferent && (
              <Button variant="outline" onClick={onAddDifferent}>
                {differentLabel}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {Math.round(progress)}%
          </p>
          <ul className="flex flex-col gap-1.5 text-left text-sm">
            {STEPS.map((step, i) => {
              const done = i < current || progress >= 100;
              return (
                <li
                  key={step.label}
                  className={cn(
                    "flex items-center gap-2",
                    i === current && !done ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className="flex size-4 items-center justify-center">
                    {done ? (
                      <Check className="size-4" style={{ color: "var(--copper)" }} />
                    ) : (
                      i === current && (
                        <span className="size-1.5 rounded-full" style={{ background: "var(--copper)" }} />
                      )
                    )}
                  </span>
                  {step.label}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            {slow ? "Almost there, larger repos take a bit longer" : "This can take up to a minute"}
          </p>
        </>
      )}
    </div>
  );
}
