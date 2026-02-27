import { useCharacters } from "@/hooks/use-characters";
import { useWebSocket } from "@/hooks/use-websocket";
import { CharacterCard } from "@/components/CharacterCard";
import { CreateCharacterDialog } from "@/components/CreateCharacterDialog";
import { Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Board() {
  const { data: characters, isLoading, error } = useCharacters();
  const { connected } = useWebSocket();

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

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 border-b border-white/10 pb-8">
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
            <span className="text-muted-foreground ml-2">Active Participants: {characters?.length || 0}</span>
          </div>
        </div>
        
        <CreateCharacterDialog />
      </header>

      {characters?.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 opacity-50">
          <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground animate-[spin_10s_linear_infinite]" />
          <h3 className="font-display text-2xl">No souls manifested</h3>
          <p className="text-muted-foreground">The board lies empty. Manifest a character to begin.</p>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          layout
        >
          <AnimatePresence>
            {characters?.map((char) => (
              <CharacterCard key={char.id} character={char} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
