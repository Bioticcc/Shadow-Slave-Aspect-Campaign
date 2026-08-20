import { useMemo } from "react";
import {
  type Character,
  type Memory,
  normalizeMemory,
  getProficiencyBonus,
  type MemoryTradeRequestPayload,
  type MemoryTradeSessionPayload,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY_OFFER = {
  characterId: null,
  memoryIndexes: [] as number[],
};

interface MemoryTradeTabProps {
  characters: Character[];
  currentUser: string;
  pendingRequests: MemoryTradeRequestPayload[];
  outgoingRequests: MemoryTradeRequestPayload[];
  activeSession: MemoryTradeSessionPayload | null;
  statusMessage: string | null;
  onClearStatusMessage: () => void;
  onRequestTrade: (targetUser: string, targetCharacterId: number) => void;
  onAcceptRequest: (requestId: string) => void;
  onDeclineRequest: (requestId: string) => void;
  onUpdateOffer: (sessionId: string, characterId: number, memoryIndexes: number[]) => void;
  onSetAccepted: (sessionId: string, accepted: boolean) => void;
  onCancelSession: (sessionId: string) => void;
}

function getMemories(character: Character | undefined): Memory[] {
  if (!character) return [];
  const proficiencyBonus = getProficiencyBonus(character.soulFragments ?? 0);
  return (character.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus));
}

function uniqueSorted(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value >= 0))).sort((a, b) => a - b);
}

export function MemoryTradeTab({
  characters,
  currentUser,
  pendingRequests,
  outgoingRequests,
  activeSession,
  statusMessage,
  onClearStatusMessage,
  onRequestTrade,
  onAcceptRequest,
  onDeclineRequest,
  onUpdateOffer,
  onSetAccepted,
  onCancelSession,
}: MemoryTradeTabProps) {
  const activeCharacters = useMemo(
    () => characters.filter((character) => (character.isActive ?? 1) === 1),
    [characters],
  );
  const byId = useMemo(() => new Map(characters.map((character) => [character.id, character])), [characters]);
  const myActiveCharacters = useMemo(
    () => activeCharacters.filter((character) => character.owner === currentUser),
    [activeCharacters, currentUser],
  );
  const partnerCandidates = useMemo(
    () => activeCharacters.filter((character) => character.owner !== currentUser),
    [activeCharacters, currentUser],
  );

  const counterpartUser = activeSession
    ? (activeSession.requester === currentUser ? activeSession.recipient : activeSession.requester)
    : null;
  const leftUser = activeSession?.requester || null;
  const rightUser = activeSession?.recipient || null;
  const isLeftLocal = !!leftUser && leftUser === currentUser;

  const leftOffer = leftUser ? (activeSession?.offers[leftUser] || EMPTY_OFFER) : EMPTY_OFFER;
  const rightOffer = rightUser ? (activeSession?.offers[rightUser] || EMPTY_OFFER) : EMPTY_OFFER;
  const leftCharacter = leftOffer.characterId ? byId.get(leftOffer.characterId) : undefined;
  const rightCharacter = rightOffer.characterId ? byId.get(rightOffer.characterId) : undefined;

  const leftMemories = getMemories(leftCharacter);
  const rightMemories = getMemories(rightCharacter);

  const localOffer = isLeftLocal ? leftOffer : rightOffer;
  const localMemories = isLeftLocal ? leftMemories : rightMemories;
  const partnerOffer = isLeftLocal ? rightOffer : leftOffer;

  const leftOfferedMemories = uniqueSorted(leftOffer.memoryIndexes)
    .map((index) => leftMemories[index])
    .filter((memory): memory is Memory => !!memory);

  const rightOfferedMemories = uniqueSorted(rightOffer.memoryIndexes)
    .map((index) => rightMemories[index])
    .filter((memory): memory is Memory => !!memory);

  const localAccepted = !!activeSession && activeSession.acceptedBy.includes(currentUser);
  const remoteAccepted = !!activeSession && !!counterpartUser && activeSession.acceptedBy.includes(counterpartUser);

  const canSetReady = !!activeSession && !!localOffer.characterId && !!partnerOffer.characterId;

  const onToggleMemory = (memoryIndex: number) => {
    if (!activeSession || !localOffer.characterId) return;
    const current = new Set(uniqueSorted(localOffer.memoryIndexes));
    if (current.has(memoryIndex)) {
      current.delete(memoryIndex);
    } else {
      current.add(memoryIndex);
    }
    onUpdateOffer(activeSession.sessionId, localOffer.characterId, Array.from(current));
  };

  const onChangeLocalCharacter = (characterIdValue: string) => {
    if (!activeSession) return;
    const characterId = Number(characterIdValue);
    if (!Number.isFinite(characterId)) return;
    onUpdateOffer(activeSession.sessionId, characterId, []);
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 flex items-start justify-between gap-3">
          <p className="text-sm text-foreground">{statusMessage}</p>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClearStatusMessage}>
            Dismiss
          </Button>
        </div>
      )}

      {!activeSession && (
        <>
          <div className="space-y-2">
            <h3 className="font-display text-2xl text-primary">Memory Trading</h3>
            <p className="text-sm text-muted-foreground">
              Choose an active character owned by another player to send a memory trade request.
            </p>
          </div>

          {pendingRequests.length > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-amber-300">Incoming Requests</h4>
              {pendingRequests.map((request) => (
                <div
                  key={request.requestId}
                  className="rounded-lg border border-white/10 bg-black/30 p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <p className="text-sm text-foreground">
                    <span className="font-bold">{request.fromUser}</span> wants to trade using
                    <span className="font-bold"> {request.targetCharacterName}</span>.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={() => onAcceptRequest(request.requestId)}
                      data-testid={`button-trade-accept-request-${request.requestId}`}
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => onDeclineRequest(request.requestId)}
                      data-testid={`button-trade-decline-request-${request.requestId}`}
                    >
                      No
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {outgoingRequests.length > 0 && (
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-cyan-300">Pending Outgoing</h4>
              <div className="mt-2 space-y-2">
                {outgoingRequests.map((request) => (
                  <p key={request.requestId} className="text-sm text-foreground">
                    Waiting for <span className="font-bold">{request.toUser}</span> to respond.
                  </p>
                ))}
              </div>
            </div>
          )}

          {myActiveCharacters.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
              You need at least one active character to start a memory trade.
            </div>
          ) : partnerCandidates.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
              No eligible active trade partners are available.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {partnerCandidates.map((partner) => (
                <div
                  key={partner.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-display text-lg text-foreground">{partner.name}</p>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Owner: {partner.owner}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onRequestTrade(partner.owner || "", partner.id)}
                    disabled={outgoingRequests.length > 0}
                    data-testid={`button-trade-request-${partner.id}`}
                  >
                    Request Trade
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeSession && counterpartUser && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-display text-2xl text-primary">Trade Session</h3>
              <p className="text-sm text-foreground">
                Trading with <span className="font-bold">{counterpartUser}</span>
              </p>
            </div>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => onCancelSession(activeSession.sessionId)}
              data-testid="button-trade-cancel-session"
            >
              Cancel Trade
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-300">
                Sender ({leftUser}{isLeftLocal ? " • You" : ""})
              </h4>
              {isLeftLocal ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Your Active Character</label>
                    <Select value={localOffer.characterId ? String(localOffer.characterId) : undefined} onValueChange={onChangeLocalCharacter}>
                      <SelectTrigger className="bg-black/50 border-white/10">
                        <SelectValue placeholder="Choose character" />
                      </SelectTrigger>
                      <SelectContent>
                        {myActiveCharacters.map((character) => (
                          <SelectItem key={character.id} value={String(character.id)}>
                            {character.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Your Memories</p>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {localMemories.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No memories.</p>
                      ) : (
                        localMemories.map((memory, memoryIndex) => {
                          const selected = localOffer.memoryIndexes.includes(memoryIndex);
                          return (
                            <button
                              key={`${memory.name}-${memoryIndex}`}
                              type="button"
                              className={cn(
                                "w-full text-left rounded-lg border p-2 transition-colors",
                                selected
                                  ? "border-emerald-400 bg-emerald-500/20"
                                  : "border-white/10 bg-black/30 hover:bg-black/45",
                              )}
                              onClick={() => onToggleMemory(memoryIndex)}
                              disabled={!localOffer.characterId}
                              data-testid={`button-trade-local-memory-${memoryIndex}`}
                            >
                              <p className="text-sm font-medium text-foreground">{memory.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {memory.isSummoned ? "Active" : "Inactive"} • {memory.memoryType}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Offer Window</p>
                    {leftOfferedMemories.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Offering nothing.</p>
                    ) : (
                      <ul className="space-y-1">
                        {leftOfferedMemories.map((memory, index) => (
                          <li key={`${memory.name}-${index}`} className="text-sm text-foreground">
                            {memory.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Selected Character</p>
                    <p className="text-sm text-foreground mt-1">
                      {leftCharacter ? leftCharacter.name : "Waiting for character selection"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Sender Memories</p>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {leftMemories.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No memories.</p>
                      ) : (
                        leftMemories.map((memory, memoryIndex) => {
                          const selected = leftOffer.memoryIndexes.includes(memoryIndex);
                          return (
                            <div
                              key={`${memory.name}-${memoryIndex}`}
                              className={cn(
                                "rounded-lg border p-2",
                                selected
                                  ? "border-emerald-400 bg-emerald-500/20"
                                  : "border-white/10 bg-black/30",
                              )}
                            >
                              <p className="text-sm font-medium text-foreground">{memory.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {memory.isSummoned ? "Active" : "Inactive"} • {memory.memoryType}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Offer Window</p>
                    {leftOfferedMemories.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Sender is offering nothing.</p>
                    ) : (
                      <ul className="space-y-1">
                        {leftOfferedMemories.map((memory, index) => (
                          <li key={`${memory.name}-${index}`} className="text-sm text-foreground">
                            {memory.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-widest text-violet-300">
                Receiver ({rightUser}{!isLeftLocal ? " • You" : ""})
              </h4>
              {!isLeftLocal ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Your Active Character</label>
                    <Select value={localOffer.characterId ? String(localOffer.characterId) : undefined} onValueChange={onChangeLocalCharacter}>
                      <SelectTrigger className="bg-black/50 border-white/10">
                        <SelectValue placeholder="Choose character" />
                      </SelectTrigger>
                      <SelectContent>
                        {myActiveCharacters.map((character) => (
                          <SelectItem key={character.id} value={String(character.id)}>
                            {character.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Your Memories</p>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {localMemories.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No memories.</p>
                      ) : (
                        localMemories.map((memory, memoryIndex) => {
                          const selected = localOffer.memoryIndexes.includes(memoryIndex);
                          return (
                            <button
                              key={`${memory.name}-${memoryIndex}`}
                              type="button"
                              className={cn(
                                "w-full text-left rounded-lg border p-2 transition-colors",
                                selected
                                  ? "border-violet-400 bg-violet-500/20"
                                  : "border-white/10 bg-black/30 hover:bg-black/45",
                              )}
                              onClick={() => onToggleMemory(memoryIndex)}
                              disabled={!localOffer.characterId}
                              data-testid={`button-trade-local-memory-${memoryIndex}`}
                            >
                              <p className="text-sm font-medium text-foreground">{memory.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {memory.isSummoned ? "Active" : "Inactive"} • {memory.memoryType}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Offer Window</p>
                    {rightOfferedMemories.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Offering nothing.</p>
                    ) : (
                      <ul className="space-y-1">
                        {rightOfferedMemories.map((memory, index) => (
                          <li key={`${memory.name}-${index}`} className="text-sm text-foreground">
                            {memory.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Selected Character</p>
                    <p className="text-sm text-foreground mt-1">
                      {rightCharacter ? rightCharacter.name : "Waiting for character selection"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Receiver Memories</p>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {rightMemories.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No memories.</p>
                      ) : (
                        rightMemories.map((memory, memoryIndex) => {
                          const selected = rightOffer.memoryIndexes.includes(memoryIndex);
                          return (
                            <div
                              key={`${memory.name}-${memoryIndex}`}
                              className={cn(
                                "rounded-lg border p-2",
                                selected
                                  ? "border-violet-400 bg-violet-500/20"
                                  : "border-white/10 bg-black/30",
                              )}
                            >
                              <p className="text-sm font-medium text-foreground">{memory.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {memory.isSummoned ? "Active" : "Inactive"} • {memory.memoryType}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Offer Window</p>
                    {rightOfferedMemories.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Receiver is offering nothing.</p>
                    ) : (
                      <ul className="space-y-1">
                        {rightOfferedMemories.map((memory, index) => (
                          <li key={`${memory.name}-${index}`} className="text-sm text-foreground">
                            {memory.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-foreground space-y-1">
              <p>
                Your status: <span className={localAccepted ? "text-emerald-400 font-bold" : "text-amber-300"}>{localAccepted ? "Accepted" : "Waiting"}</span>
              </p>
              <p>
                Partner status: <span className={remoteAccepted ? "text-emerald-400 font-bold" : "text-amber-300"}>{remoteAccepted ? "Accepted" : "Waiting"}</span>
              </p>
            </div>
            <Button
              onClick={() => onSetAccepted(activeSession.sessionId, !localAccepted)}
              disabled={!canSetReady}
              className={localAccepted ? "bg-emerald-700 hover:bg-emerald-600" : "bg-primary text-primary-foreground hover:bg-primary/90"}
              data-testid="button-trade-accept-session"
            >
              {localAccepted ? "Accepted (Click to Unready)" : "Accept Trade"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
