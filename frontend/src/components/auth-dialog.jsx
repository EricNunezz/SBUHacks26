import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { checkEmail } from "@/api/client";

const linkCls = "font-semibold underline underline-offset-2";
const labelCls = "ticket-label mb-1 block";

// Turn Supabase's raw messages into short human ones. `exists` makes the error offer a switch to Log in.
// `knownAccount`: check-email already confirmed the account exists, so bad credentials can only mean a wrong password.
function friendlyError(err, mode, knownAccount = false) {
  const msg = err?.message || "";
  if (/invalid login credentials/i.test(msg)) {
    return knownAccount ? { text: "Wrong password. Try again or", reset: true } : { text: "Wrong email or password." };
  }
  if (/already registered|already been registered/i.test(msg)) return { text: "You already have an account.", exists: true };
  if (/email not confirmed/i.test(msg)) return { text: "Confirm your email first, then log in." };
  if (/rate limit|too many/i.test(msg)) return { text: "Too many tries. Wait a minute and try again." };
  if (/failed to fetch|network/i.test(msg)) return { text: "Can't reach the server. Check your connection." };
  return { text: msg || (mode === "login" ? "Couldn't log in. Try again." : "Couldn't create the account. Try again.") };
}

// Popup with two modes, chosen by hasPendingRepo:
//  - true: opened by the home form, so a repo is waiting to be saved
//  - false: opened by the "Log in" link (returning user), no repo
// All paths end in onContinue().
export default function AuthDialog({ open, hasPendingRepo, onCancel, onContinue }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null); // { text, exists? }
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [boarded, setBoarded] = useState(false); // success: show the punched hole + stamp, then close
  const emailRef = useRef(null);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    if (!open) return;
    // each time the popup opens it starts clean on Log in
    setMode("login");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setNotice("");
    setLoading(false);
    setBoarded(false);
  }, [open]);

  useEffect(() => {
    if (!boarded) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => onContinueRef.current(), reduce ? 150 : 500);
    return () => clearTimeout(t);
  }, [boarded]);

  function switchMode(next) {
    setMode(next); // the email is kept; only the password and messages reset
    setPassword("");
    setShowPassword(false);
    setError(null);
    setNotice("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice("");
    setLoading(true);
    let knownAccount = false; // check-email said the account exists
    try {
      if (mode === "login") {
        let checked = false; // check-email answered at all
        try {
          knownAccount = await checkEmail(email);
          checked = true;
        } catch {
          // check-email failed (network / rate limit): carry on with a plain login attempt
        }
        if (checked && !knownAccount) {
          setError({ text: "No account found for this email.", toSignup: true });
          return;
        }
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      setBoarded(true); // only runs if sign in / sign up didn't throw; the effect above calls onContinue()
    } catch (err) {
      setError(friendlyError(err, mode, knownAccount));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    setError(null);
    setNotice("");
    if (!email.trim()) {
      setError({ text: "Enter your email above, then tap Lost your ticket?" });
      emailRef.current?.focus();
      return;
    }
    try {
      await resetPassword(email.trim());
      setNotice("We sent a replacement ticket to your email.");
    } catch (err) {
      setError(friendlyError(err, mode));
    }
  }

  const title = hasPendingRepo ? "Save your map" : "Welcome back";
  const subtitle = hasPendingRepo
    ? "Log in or create a free account to keep your repos and chats."
    : "Log in or create a free account to pick up your repos and chats.";
  const isLogin = mode === "login";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        showCloseButton={!boarded}
        className="ticket-shell"
        onOpenAutoFocus={(e) => {
          e.preventDefault(); // Radix would focus the first tabbable; we want the email field
          emailRef.current?.focus();
        }}
      >
        <div className="ticket-edge">
          <div className="ticket-face">
            <DialogHeader className="ticket-window-header">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{subtitle}</DialogDescription>
            </DialogHeader>
            <div className="ticket-perforation" aria-hidden="true" />
            <div className="ticket-window-body">
              <div className="ticket-meta" aria-hidden="true">
                <span>ADMIT ONE</span>
                <span>No. 004217</span>
              </div>

              <div
                role="radiogroup"
                aria-label="Log in or sign up"
                className="auth-segment"
                data-mode={mode}
              >
                <span className="auth-segment-block" aria-hidden="true" />
                {[["login", "LOG IN"], ["signup", "SIGN UP"]].map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    onClick={() => switchMode(value)}
                  >
                    {text}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="auth-email" className={labelCls}>PASSENGER EMAIL</label>
                  <Input
                    id="auth-email"
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor="auth-password" className="ticket-label">PASSWORD</label>
                    {isLogin && (
                      <button type="button" onClick={handleForgot} className="ticket-link text-xs">
                        Lost your ticket?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-11"
                      required
                      minLength={isLogin ? undefined : 6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="ticket-eye"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Reserved line: hint, error or notice share it so the dialog never changes height */}
                <div className="ticket-msg text-sm" aria-live="polite">
                  {error ? (
                    <p role="alert" className="ticket-error">
                      <span className="signal-light" aria-hidden="true" />
                      <span>
                        {error.text}{" "}
                        {error.exists && (
                          <button type="button" className={linkCls} onClick={() => switchMode("login")}>
                            Log in instead?
                          </button>
                        )}
                        {error.toSignup && (
                          <button type="button" className={linkCls} onClick={() => switchMode("signup")}>
                            Create an account
                          </button>
                        )}
                        {error.reset && (
                          <button type="button" className={linkCls} onClick={handleForgot}>
                            reset it.
                          </button>
                        )}
                      </span>
                    </p>
                  ) : notice ? (
                    <p className="font-medium text-[var(--rail-green)]">{notice}</p>
                  ) : !isLogin ? (
                    <p className="ticket-helper">At least 6 characters</p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  className="ticket-punch w-full"
                  disabled={loading || boarded}
                  aria-label={isLogin ? "Log in" : "Create account"}
                  aria-busy={loading}
                >
                  {loading ? "Please wait..." : isLogin ? "PUNCH MY TICKET" : "ISSUE MY TICKET"}
                </Button>
              </form>

              {boarded && (
                <>
                  <span className="ticket-hole" aria-hidden="true" />
                  <span className="ticket-boarded" aria-hidden="true">BOARDED</span>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
