import { useState } from "react";
import { useCharacters, useUpdateCharacter } from "@/hooks/use-characters";
import { useAuth } from "@/lib/auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { CharacterCard } from "@/components/CharacterCard";
import { CharacterSheet } from "@/components/CharacterSheet";
import { CreateCharacterDialog } from "@/components/CreateCharacterDialog";
import { LogoutButton } from "@/components/LoginGuard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wifi, WifiOff, LayoutGrid, List } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type Character, getTagColorForOwner, ACCOUNTS } from "@shared/schema";

const TAG_COLOR_MAP: Record<string, string> = {
  cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  pink: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  orange: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  gray: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

function OwnerTag({ owner }: { owner: string }) {
  const color = getTagColorForOwner(owner);
  const classes = TAG_COLOR_MAP[color] || TAG_COLOR_MAP.gray;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${classes}`} data-testid={`tag-owner-${owner}`}>
      {owner}
    </span>
  );
}

function CharacterListItem({ character }: { character: Character }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const updateChar = useUpdateCharacter();
  const { currentUser, isDM } = useAuth();
  const isActive = (character.isActive ?? 1) === 1;
  const canEdit = isDM || currentUser === character.owner;
  const canToggle = isDM || currentUser === character.owner;

  const handleToggle = (checked: boolean) => {
    if (!canToggle) return;
    updateChar.mutate({ id: character.id, updates: { isActive: checked ? 1 : 0 } });
  };

  return (
    <>
      <div
        onClick={() => setSheetOpen(true)}
        className="flex items-center justify-between p-4 bg-black/30 rounded-xl border border-white/5 hover:border-primary/30 cursor-pointer transition-all group"
        data-testid={`list-item-${character.id}`}
      >
        <div className="flex items-center gap-4">
          <Avatar className="w-10 h-10 border border-primary/30">
            {character.icon ? (
              <img src={character.icon} alt={character.name} className="w-full h-full object-cover" />
            ) : (
              <AvatarFallback className="bg-secondary font-display text-sm text-primary">
                {character.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex items-center gap-3">
            <div>
              <p className="font-display font-bold text-foreground group-hover:text-primary transition-colors">
                {character.name}
              </p>
              <p className="text-xs text-muted-foreground">{character.aspect || "No Aspect"}</p>
            </div>
            <OwnerTag owner={character.owner || "DM"} />
          </div>
        </div>

        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          {isDM && (
            <Select
              value={character.owner || "DM"}
              onValueChange={(v) => updateChar.mutate({ id: character.id, updates: { owner: v } })}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs bg-black/50 border-white/10" data-testid={`select-owner-${character.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map(a => (
                  <SelectItem key={a.username} value={a.username}>{a.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'text-emerald-400' : 'text-muted-foreground'}`}>
            {isActive ? "Active" : "Inactive"}
          </span>
          <Switch
            checked={isActive}
            onCheckedChange={handleToggle}
            disabled={!canToggle}
            data-testid={`toggle-active-${character.id}`}
          />
        </div>
      </div>

      <CharacterSheet
        character={character}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        canEdit={canEdit}
      />
    </>
  );
}

export default function Board() {
  const { data: characters, isLoading, error } = useCharacters();
  const { connected } = useWebSocket();
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<"board" | "list">("board");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-destructive space-y-4">
        <h2 className="font-display text-2xl">The weave is severed</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  const activeCharacters = characters?.filter(c => (c.isActive ?? 1) === 1) || [];
  const allCharacters = characters || [];

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-glow text-primary tracking-wider uppercase">
            Aspects <span className="text-foreground">Campaign</span>
          </h1>
          <div className="flex items-center gap-2 mt-2 text-sm">
            {connected ? (
              <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <Wifi className="w-3 h-3" /> Spell synced
              </span>
            ) : (
              <span className="text-destructive flex items-center gap-1.5 bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20">
                <WifiOff className="w-3 h-3" /> Reconnecting...
              </span>
            )}
            <span className="text-muted-foreground ml-2">Active Participants: {activeCharacters.length}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <LogoutButton />
          <CreateCharacterDialog />
        </div>
      </header>

      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setTab("board")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-widest transition-all ${
            tab === "board"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-black/30 text-muted-foreground hover:text-foreground hover:bg-black/50 border border-white/5"
          }`}
          data-testid="tab-board"
        >
          <LayoutGrid className="w-4 h-4" /> Board
        </button>
        <button
          onClick={() => setTab("list")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-widest transition-all ${
            tab === "list"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-black/30 text-muted-foreground hover:text-foreground hover:bg-black/50 border border-white/5"
          }`}
          data-testid="tab-list"
        >
          <List className="w-4 h-4" /> Character List
        </button>
      </div>

      {tab === "board" && (
        <>
          {activeCharacters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 opacity-50">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground animate-[spin_10s_linear_infinite]" />
              <h3 className="font-display text-2xl">No active souls</h3>
              <p className="text-muted-foreground">Set characters to Active in the Character List to display them here.</p>
            </div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              layout
            >
              <AnimatePresence>
                {activeCharacters.map((char) => (
                  <CharacterCard key={char.id} character={char} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}

      {tab === "list" && (
        <div className="space-y-3 max-w-3xl">
          {allCharacters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 opacity-50">
              <h3 className="font-display text-2xl">No souls manifested</h3>
              <p className="text-muted-foreground">Create a character to begin.</p>
            </div>
          ) : (
            allCharacters.map((char) => (
              <CharacterListItem key={char.id} character={char} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
