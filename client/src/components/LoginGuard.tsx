import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ACCOUNTS } from "@shared/schema";

export function LoginGuard({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const { currentUser, login } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(username, password);
    if (success) {
      setError(false);
      setUsername("");
      setPassword("");
    } else {
      setError(true);
      setPassword("");
    }
  };

  if (currentUser) {
    return <>{children}</>;
  }

  return (
    <Dialog open={true}>
      <DialogContent className="glass-panel border-primary/30 sm:max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary text-glow flex items-center gap-2">
            <Lock className="w-5 h-5" /> Enter the Realm
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleLogin} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Username
            </label>
            <Input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(false); }}
              className={`bg-black/50 border-white/10 focus-visible:ring-primary ${error ? "border-destructive animate-shake" : ""}`}
              placeholder="Your name"
              autoFocus
              data-testid="input-username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              className={`bg-black/50 border-white/10 focus-visible:ring-primary ${error ? "border-destructive animate-shake" : ""}`}
              placeholder="••••••••"
              data-testid="input-password"
            />
            {error && (
              <p className="text-xs text-destructive font-medium">
                Invalid credentials. The weave rejects you.
              </p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-login"
          >
            Enter the Realm
          </Button>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {ACCOUNTS.map(a => (
              <span key={a.username} className="text-xs text-muted-foreground/50">{a.username}</span>
            ))}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LogoutButton() {
  const { currentUser, logout } = useAuth();
  if (!currentUser) return null;
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={logout}
      className="text-muted-foreground hover:text-foreground gap-1.5"
      data-testid="button-logout"
    >
      <LogOut className="w-3 h-3" />
      <span className="text-xs">{currentUser}</span>
    </Button>
  );
}
