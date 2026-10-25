import { useEffect, useRef, useState } from "react";
import { Check, TrainFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import TrainProgress from "@/components/TrainProgress";
import useEstimatedProgress from "@/hooks/useEstimatedProgress";
import { GRASS, makeTexture } from "@/components/GrassBackground";
import { cn } from "@/lib/utils";

const STEPS = [
  { at: 0, label: "Surveying the land" },
  { at: 25, label: "Laying the tracks" },
  { at: 50, label: "Building the stations" },
  { at: 75, label: "Arriving at the station" },
];
const ARRIVED_HOLD_MS = 700; // the ARRIVED stamp stays this long before the diagram fades in

// Shown while a repo is being added. runAdd() resolves with the new repo (or throws);
// onComplete(repo) fires once the train has pulled in; onAddDifferent() leaves after an error.
export default function AddRepoProgress({ name, runAdd, onComplete, onAddDifferent, differentLabel = "Pick a different repo" }) {
  const { progress, slow, start, finish, stop } = useEstimatedProgress();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [limited, setLimited] = useState(false); // a usage limit or the daily kill switch: "Try again" would just repeat it
  const [arrived, setArrived] = useState(false);
  const [grass, setGrass] = useState(null); // same grass texture as the board, made after the first paint
  const inFlight = useRef({ attempt: -1, promise: null }); // StrictMode runs effects twice; send one request

  useEffect(() => {
    setGrass(makeTexture());
  }, []);

  useEffect(() => {
    let live = true;
    let timer;
    setError("");
    setLimited(false);
    setArrived(false);
    start();

    if (inFlight.current.attempt !== attempt) {
      inFlight.current = { attempt, promise: runAdd() };
    }
    inFlight.current.promise.then(
      async (repo) => {
        if (!live) return;
        await finish();
        if (!live) return;
        setArrived(true);
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        timer = setTimeout(() => live && onComplete(repo), reduce ? 200 : ARRIVED_HOLD_MS);
      },
      (err) => {
        if (!live) return;
        stop();
        setError(err.message || "Couldn't add that repo.");
        setLimited(Boolean(err.limited));
      }
    );

    return () => {
      live = false;
      clearTimeout(timer);
      stop();
    };
  }, [attempt]);

  const current = STEPS.findLastIndex((s) => progress >= s.at);

  return (
    <div
      className="relative isolate flex h-full items-center justify-center overflow-auto px-4 py-6"
      style={{ backgroundColor: GRASS, ...(grass && { backgroundImage: `url(${grass})`, backgroundSize: "1024px 1024px" }) }}
    >
      {/* ticket card: iron outline, hard shadow, perforation with notches (the .doc styles) */}
      <div className="doc w-full max-w-[640px]" style={{ "--nxe": "right 99px", "--nxf": "right 96px" }}>
        <div className="doc-edge">
          <div className="doc-face">
            <div className="doc-body space-y-4 !p-5 text-center">
              <p className="break-all font-mono text-sm font-bold">{name}</p>
              <div className="flex justify-center">
                <TrainProgress progress={progress} name={name} error={Boolean(error)} />
              </div>

              {error ? (
                <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                  <p role="alert" className="signal-error text-left text-sm font-semibold" style={{ color: "var(--rust)" }}>
                    <span className="signal-light" aria-hidden="true" />
                    {error}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {!limited && <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
                    {onAddDifferent && (
                      <Button variant="outline" onClick={onAddDifferent}>
                        {differentLabel}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <ul className="mx-auto flex w-fit flex-col gap-1.5 text-left text-sm">
                    {STEPS.map((step, i) => {
                      const done = i < current || progress >= 100;
                      return (
                        <li
                          key={step.label}
                          className={cn("flex items-center gap-2", i === current && !done ? "font-bold" : "text-[var(--steel-text)]")}
                        >
                          <span className="flex size-4 items-center justify-center">
                            {done ? (
                              <Check className="size-4" strokeWidth={3} style={{ color: "var(--rail-green)" }} />
                            ) : (
                              i === current && <span className="size-2 rounded-full border-2 border-[var(--iron)] bg-[var(--brass)]" />
                            )}
                          </span>
                          {step.label}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-[var(--steel-text)]">
                    {slow ? "Almost there, larger repos take a bit longer" : "This can take up to a minute"}
                  </p>
                </>
              )}
            </div>
            <span className="doc-perf" style={{ right: 95 }} aria-hidden="true" />
            <div className="doc-stub flex-none" style={{ width: 96 }}>
              <TrainFront className="size-6" aria-hidden="true" />
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]">Admit one</div>
              {arrived && <span className="stamp stamp-good !px-1.5 !text-[11px]">ARRIVED</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
