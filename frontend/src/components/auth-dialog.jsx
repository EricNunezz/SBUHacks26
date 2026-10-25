import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";

function AuthForm({
  submitLabel,
  onSubmit,
  passwordAutoComplete = "current-password",
  passwordHint,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit(email, password);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-4">
      <Input
        type="email"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        autoComplete={passwordAutoComplete}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {passwordHint && <p className="text-xs text-muted-foreground">{passwordHint}</p>}
      {error && <p role="alert" className="stamp-error">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Please wait..." : submitLabel}
      </Button>
    </form>
  );
}

// Popup with two modes, chosen by hasPendingRepo:
//  - true: opened by the home form, so a repo is waiting to be saved
//  - false: opened by the "Log in" link (returning user), no repo and no guest option
// All paths end in onContinue().
export default function AuthDialog({ open, hasPendingRepo, onCancel, onContinue }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup": the header and the form follow the tab

  useEffect(() => {
    if (!open) setMode("login"); // each time the popup opens it starts on Log in
  }, [open]);

  const copy = {
    login: {
      title: hasPendingRepo ? "Show your ticket" : "Welcome back, traveler",
      text: hasPendingRepo ? "Log in to save your repo and board." : "Log in to pick up where you left off.",
    },
    signup: {
      title: hasPendingRepo ? "Save your ticket" : "New passenger",
      text: hasPendingRepo ? "Create an account to keep your repo and board." : "Create an account to start mapping repos.",
    },
  }[mode];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="ticket-window gap-0 overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="ticket-window-header" data-mode={mode}>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.text}</DialogDescription>
        </DialogHeader>
        <div className="ticket-window-body">
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="h-auto w-full gap-3 bg-transparent p-0">
            <TabsTrigger value="login" className="ticket-tab">Log in</TabsTrigger>
            <TabsTrigger value="signup" className="ticket-tab">New passenger</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <AuthForm
              submitLabel="Log in"
              onSubmit={async (email, password) => {
                await signIn(email, password);
                onContinue(); // only runs if signIn didn't throw
              }}
            />
          </TabsContent>
          <TabsContent value="signup">
            <AuthForm
              submitLabel="Create account"
              passwordAutoComplete="new-password"
              passwordHint="At least 6 characters"
              onSubmit={async (email, password) => {
                await signUp(email, password);
                onContinue(); // only runs if signUp didn't throw
              }}
            />
          </TabsContent>
        </Tabs>
        {/* Demo/testing shortcut that skips auth. Needs a repo to save, so not for returning users. */}
        {hasPendingRepo && (
          <>
            <Separator className="my-4 border-t-2 border-dashed border-[var(--iron)] bg-transparent" />
            <Button variant="outline" className="w-full font-mono font-bold uppercase tracking-wider" onClick={() => onContinue(true)}>
              Board as guest
            </Button>
          </>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
