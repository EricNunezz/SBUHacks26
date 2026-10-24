import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
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
    <form onSubmit={handleSubmit} className="space-y-3">
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
      {error && <p className="text-sm text-destructive">{error}</p>}
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

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{hasPendingRepo ? "Save your repo" : "Welcome back"}</DialogTitle>
          <DialogDescription>
            {hasPendingRepo
              ? "Log in or create an account to continue."
              : "Log in to pick up where you left off."}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="login">
          <TabsList className="w-full">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
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
            <Separator />
            <Button variant="outline" className="w-full" onClick={() => onContinue(true)}>
              Continue as guest
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
