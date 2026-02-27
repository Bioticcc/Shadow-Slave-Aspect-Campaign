import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

export function LoginGuard({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("campaign_auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "SigmaGoon18") {
      localStorage.setItem("campaign_auth", "true");
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword("");
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <Dialog open={true}>
      <DialogContent className="glass-panel border-primary/30 sm:max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary text-glow flex items-center gap-2">
            <Lock className="w-5 h-5" /> Restricted Access
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleLogin} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Enter Campaign Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`bg-black/50 border-white/10 focus-visible:ring-primary ${
                error ? "border-destructive animate-shake" : ""
              }`}
              placeholder="••••••••"
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive font-medium">
                Incorrect password. The weave rejects you.
              </p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Enter Campaign
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
