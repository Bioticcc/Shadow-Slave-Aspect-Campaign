import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import {
  normalizeEchoes,
  normalizeMemory,
  getProficiencyBonus,
  WS_EVENTS,
  serializeEchoes,
  type MemoryTradeErrorPayload,
  type Memory,
  type MemoryBankEntry,
  type MemoryTradeOffer,
  type MemoryTradeRequestDeclinedPayload,
  type MemoryTradeRequestPayload,
  type MemoryTradeSessionClosedPayload,
  type MemoryTradeSessionPayload,
  type MemoryTradeStatePayload,
  type SystemMessagePayload,
} from "@shared/schema";
import { z } from "zod";
import {
  type AuthUser,
  authenticateUser,
  canManageCharacter,
  getSessionUser,
  isCampaignAccessCodeValid,
  requireAuth,
  sessionMiddleware,
} from "./auth";
import { createRateLimiter } from "./security";
import { pool } from "./db";

type SessionRequest = {
  session?: {
    user?: string;
    regenerate: (cb: (err?: unknown) => void) => void;
    save: (cb: (err?: unknown) => void) => void;
    destroy: (cb: (err?: unknown) => void) => void;
  };
  authUser?: AuthUser;
};

type UndoMemoryDelta = {
  index: number;
  delta: number;
  previousDurability: number;
};

type UndoEchoDelta = {
  index: number;
  delta: number;
  previousHealth: number;
};

type UndoDayAdvanceEssenceDelta = {
  id: number;
  previousEssence: number;
};

type UndoHourPassCharacterDelta = {
  id: number;
  previousEssence: number;
  essenceDelta: number;
  memoryDeltas: UndoMemoryDelta[];
  echoDeltas: UndoEchoDelta[];
};

type CampaignUndoAction =
  | {
      actionType: "update-day";
      dayDelta: number;
      essenceDeltas: UndoDayAdvanceEssenceDelta[];
      performedBy: string;
      createdAt: number;
    }
  | {
      actionType: "pass-hour";
      characterDeltas: UndoHourPassCharacterDelta[];
      performedBy: string;
      createdAt: number;
    };

const MAX_CAMPAIGN_UNDO_ACTIONS = 100;
const tradeRequestSchema = z.object({
  targetUser: z.string().trim().min(1).max(64),
  targetCharacterId: z.coerce.number().int().positive(),
});
const tradeRequestDecisionSchema = z.object({
  requestId: z.string().trim().min(1),
});
const tradeSessionUpdateSchema = z.object({
  sessionId: z.string().trim().min(1),
  characterId: z.coerce.number().int().positive(),
  memoryIndexes: z.array(z.coerce.number().int().min(0)).max(200),
});
const tradeSessionAcceptSchema = z.object({
  sessionId: z.string().trim().min(1),
  accepted: z.boolean(),
});
const tradeSessionCancelSchema = z.object({
  sessionId: z.string().trim().min(1),
});
const memoryBankMemorySchema = z.custom<Memory>();
const memoryBankAssignSchema = z.object({
  characterId: z.coerce.number().int().positive(),
});

type MemoryTradeSessionRecord = {
  sessionId: string;
  requestId: string;
  requester: string;
  recipient: string;
  offers: Record<string, MemoryTradeOffer>;
  acceptedBy: Set<string>;
  createdAt: number;
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const loginSchema = z.object({
    accessCode: z.string().min(1).max(256),
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(128),
  });

  const loginLimiter = createRateLimiter({
    windowMs: 1000 * 60 * 10,
    max: 20,
    message: "Too many login attempts, please try again in a few minutes.",
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS memory_bank (
      id SERIAL PRIMARY KEY,
      memory JSON NOT NULL
    )
  `);

  // Auth routes
  app.get("/api/auth/me", (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.json({ user: null, isDM: false });
    return res.json({ user: user.username, isDM: user.isDM });
  });

  app.post("/api/auth/login", loginLimiter, (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login payload" });
    }

    if (!isCampaignAccessCodeValid(parsed.data.accessCode)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = authenticateUser(parsed.data.username, parsed.data.password);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const sessionReq = req as typeof req & SessionRequest;
    if (!sessionReq.session) {
      return res.status(500).json({ message: "Session unavailable" });
    }

    sessionReq.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        return res.status(500).json({ message: "Login session failed" });
      }

      sessionReq.session!.user = user.username;
      sessionReq.session!.save((saveErr) => {
        if (saveErr) {
          return res.status(500).json({ message: "Login session save failed" });
        }
        return res.status(200).json({ user: user.username, isDM: user.isDM });
      });
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    const sessionReq = req as typeof req & SessionRequest;
    if (!sessionReq.session) return res.status(204).send();
    sessionReq.session.destroy(() => {
      res.status(204).send();
    });
  });

  app.use("/api/characters", requireAuth);
  app.use("/api/campaign", requireAuth);
  app.use("/api/memory-bank", requireAuth);

  // Set up WebSocket server with session auth
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const path = req.url?.split("?")[0] || "";
    if (path !== "/ws") return;

    sessionMiddleware(req as any, {} as any, (sessionErr?: unknown) => {
      if (sessionErr) {
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
        return;
      }

      const sessionReq = req as typeof req & SessionRequest;
      const user = getSessionUser(req as any);
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      sessionReq.authUser = user;
      wss.handleUpgrade(req, socket, head, (ws) => {
        (ws as any).authUser = user;
        wss.emit("connection", ws, req);
      });
    });
  });
  
  const broadcast = (type: string, payload: unknown) => {
    const msg = JSON.stringify({ type, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  };

  const sendToSocket = (socket: WebSocket, type: string, payload: unknown) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type, payload }));
  };

  const sendToUser = (username: string, type: string, payload: unknown) => {
    wss.clients.forEach((client) => {
      const clientUser = ((client as any).authUser?.username || "") as string;
      if (client.readyState === WebSocket.OPEN && clientUser === username) {
        client.send(JSON.stringify({ type, payload }));
      }
    });
  };

  const hasOtherOpenSocketForUser = (username: string, excluding: WebSocket): boolean => {
    for (const client of Array.from(wss.clients)) {
      const clientUser = ((client as any).authUser?.username || "") as string;
      if (client !== excluding && client.readyState === WebSocket.OPEN && clientUser === username) {
        return true;
      }
    }
    return false;
  };

  const broadcastUpdate = (payload: unknown) => {
    broadcast(WS_EVENTS.UPDATE_CHARACTER, payload);
  };

  let campaignDay = 28;
  const campaignUndoStack: CampaignUndoAction[] = [];
  const pushUndoAction = (action: CampaignUndoAction) => {
    campaignUndoStack.push(action);
    if (campaignUndoStack.length > MAX_CAMPAIGN_UNDO_ACTIONS) {
      campaignUndoStack.shift();
    }
  };

  const applyCampaignDayDelta = async (delta: number, performedBy: string) => {
    if (delta === 0) {
      return { dayCount: campaignDay };
    }

    const previousDay = campaignDay;
    const nextDay = Math.max(1, previousDay + delta);
    const appliedDelta = nextDay - previousDay;
    if (appliedDelta === 0) {
      return { dayCount: campaignDay };
    }

    campaignDay = nextDay;
    const essenceDeltas: UndoDayAdvanceEssenceDelta[] = [];
    if (appliedDelta > 0) {
      const characters = await storage.getCharacters();
      for (const character of characters) {
        const currentEssence = character.currentEssence ?? 0;
        const maxEssence = Math.max(0, character.maxEssence ?? 10);
        if (currentEssence === maxEssence) continue;

        essenceDeltas.push({
          id: character.id,
          previousEssence: currentEssence,
        });

        const updatedCharacter = await storage.updateCharacter(character.id, {
          currentEssence: maxEssence,
        });
        broadcastUpdate(updatedCharacter);
      }
    }

    pushUndoAction({
      actionType: "update-day",
      dayDelta: appliedDelta,
      essenceDeltas,
      performedBy,
      createdAt: Date.now(),
    });

    const payload = { dayCount: campaignDay };
    broadcast(WS_EVENTS.CAMPAIGN_DAY_UPDATE, payload);
    return payload;
  };

  let nextTradeRequestId = 1;
  let nextTradeSessionId = 1;
  const pendingTradeRequests = new Map<string, MemoryTradeRequestPayload>();
  const activeTradeSessions = new Map<string, MemoryTradeSessionRecord>();
  const activeTradeSessionByUser = new Map<string, string>();

  const toSessionPayload = (session: MemoryTradeSessionRecord): MemoryTradeSessionPayload => ({
    sessionId: session.sessionId,
    requestId: session.requestId,
    requester: session.requester,
    recipient: session.recipient,
    offers: session.offers,
    acceptedBy: Array.from(session.acceptedBy),
    createdAt: session.createdAt,
  });

  const sanitizeMemoryIndexes = (values: number[], maxLength: number): number[] => {
    const deduped = Array.from(new Set(values.filter((value) => Number.isInteger(value) && value >= 0)));
    return deduped.filter((value) => value < maxLength).sort((a, b) => a - b);
  };

  const getTradeStateForUser = (username: string): MemoryTradeStatePayload => {
    const pendingRequests = Array.from(pendingTradeRequests.values())
      .filter((request) => request.toUser === username)
      .sort((a, b) => a.createdAt - b.createdAt);
    const outgoingRequests = Array.from(pendingTradeRequests.values())
      .filter((request) => request.fromUser === username)
      .sort((a, b) => a.createdAt - b.createdAt);
    const sessionId = activeTradeSessionByUser.get(username);
    const activeSession = sessionId ? activeTradeSessions.get(sessionId) : undefined;

    return {
      pendingRequests,
      outgoingRequests,
      activeSession: activeSession ? toSessionPayload(activeSession) : null,
    };
  };

  const sendTradeStateToUser = (username: string) => {
    sendToUser(username, WS_EVENTS.MEMORY_TRADE_STATE, getTradeStateForUser(username));
  };

  const sendTradeErrorToSocket = (
    socket: WebSocket,
    message: string,
    requestId?: string,
    sessionId?: string,
  ) => {
    const payload: MemoryTradeErrorPayload = { message, requestId, sessionId };
    sendToSocket(socket, WS_EVENTS.MEMORY_TRADE_ERROR, payload);
  };

  const closeTradeSession = (
    session: MemoryTradeSessionRecord,
    reason: MemoryTradeSessionClosedPayload["reason"],
    message: string,
  ) => {
    activeTradeSessions.delete(session.sessionId);
    if (activeTradeSessionByUser.get(session.requester) === session.sessionId) {
      activeTradeSessionByUser.delete(session.requester);
    }
    if (activeTradeSessionByUser.get(session.recipient) === session.sessionId) {
      activeTradeSessionByUser.delete(session.recipient);
    }

    const payload: MemoryTradeSessionClosedPayload = {
      sessionId: session.sessionId,
      reason,
      message,
    };
    sendToUser(session.requester, WS_EVENTS.MEMORY_TRADE_SESSION_CLOSED, payload);
    sendToUser(session.recipient, WS_EVENTS.MEMORY_TRADE_SESSION_CLOSED, payload);
    sendTradeStateToUser(session.requester);
    sendTradeStateToUser(session.recipient);
  };

  const executeMemoryTrade = async (session: MemoryTradeSessionRecord) => {
    const requesterOffer = session.offers[session.requester];
    const recipientOffer = session.offers[session.recipient];

    if (!requesterOffer?.characterId || !recipientOffer?.characterId) {
      sendToUser(session.requester, WS_EVENTS.MEMORY_TRADE_ERROR, {
        message: "Both players must choose a character before accepting the trade.",
        sessionId: session.sessionId,
      } satisfies MemoryTradeErrorPayload);
      sendToUser(session.recipient, WS_EVENTS.MEMORY_TRADE_ERROR, {
        message: "Both players must choose a character before accepting the trade.",
        sessionId: session.sessionId,
      } satisfies MemoryTradeErrorPayload);
      session.acceptedBy.clear();
      const payload = toSessionPayload(session);
      sendToUser(session.requester, WS_EVENTS.MEMORY_TRADE_SESSION_UPDATED, payload);
      sendToUser(session.recipient, WS_EVENTS.MEMORY_TRADE_SESSION_UPDATED, payload);
      return;
    }

    const requesterCharacter = await storage.getCharacter(requesterOffer.characterId);
    const recipientCharacter = await storage.getCharacter(recipientOffer.characterId);
    if (!requesterCharacter || !recipientCharacter) {
      closeTradeSession(session, "invalidated", "Trade cancelled because one character is no longer available.");
      return;
    }
    if ((requesterCharacter.isActive ?? 1) !== 1 || (recipientCharacter.isActive ?? 1) !== 1) {
      closeTradeSession(session, "invalidated", "Trade cancelled because one selected character is no longer active.");
      return;
    }
    if (requesterCharacter.owner !== session.requester || recipientCharacter.owner !== session.recipient) {
      closeTradeSession(session, "invalidated", "Trade cancelled because ownership changed.");
      return;
    }

    const requesterBonus = getProficiencyBonus(requesterCharacter.totalSoulFragments ?? 0);
    const recipientBonus = getProficiencyBonus(recipientCharacter.totalSoulFragments ?? 0);
    const requesterMemories = (requesterCharacter.memories || []).map((memory) => normalizeMemory(memory, requesterBonus));
    const recipientMemories = (recipientCharacter.memories || []).map((memory) => normalizeMemory(memory, recipientBonus));
    const requesterIndexes = sanitizeMemoryIndexes(requesterOffer.memoryIndexes, requesterMemories.length);
    const recipientIndexes = sanitizeMemoryIndexes(recipientOffer.memoryIndexes, recipientMemories.length);

    const requesterIndexSet = new Set(requesterIndexes);
    const recipientIndexSet = new Set(recipientIndexes);

    const requesterOfferedMemories = requesterIndexes.map((index) => ({
      ...requesterMemories[index],
      isSummoned: false,
    }));
    const recipientOfferedMemories = recipientIndexes.map((index) => ({
      ...recipientMemories[index],
      isSummoned: false,
    }));

    const nextRequesterMemories = requesterMemories
      .filter((_memory, index) => !requesterIndexSet.has(index))
      .concat(recipientOfferedMemories);
    const nextRecipientMemories = recipientMemories
      .filter((_memory, index) => !recipientIndexSet.has(index))
      .concat(requesterOfferedMemories);

    const updatedRequester = await storage.updateCharacter(requesterCharacter.id, {
      memories: nextRequesterMemories,
    });
    const updatedRecipient = await storage.updateCharacter(recipientCharacter.id, {
      memories: nextRecipientMemories,
    });

    broadcastUpdate(updatedRequester);
    broadcastUpdate(updatedRecipient);
    closeTradeSession(session, "completed", "Memory trade completed. Traded memories were set to inactive.");
  };

  const cleanupPendingRequestsForUser = (username: string) => {
    const impactedUsers = new Set<string>();
    for (const [requestId, request] of Array.from(pendingTradeRequests.entries())) {
      if (request.fromUser !== username && request.toUser !== username) continue;
      pendingTradeRequests.delete(requestId);
      impactedUsers.add(request.fromUser);
      impactedUsers.add(request.toUser);
      const counterpart = request.fromUser === username ? request.toUser : request.fromUser;
      const payload: MemoryTradeRequestDeclinedPayload = {
        requestId,
        fromUser: request.fromUser,
        toUser: request.toUser,
        message: `${username} disconnected. Trade request expired.`,
      };
      sendToUser(counterpart, WS_EVENTS.MEMORY_TRADE_REQUEST_DECLINED, payload);
    }
    impactedUsers.forEach((user) => sendTradeStateToUser(user));
  };

  const buildMemoryBankEntries = async (): Promise<MemoryBankEntry[]> => {
    const entries: MemoryBankEntry[] = [];
    const characters = await storage.getCharacters();
    for (const character of characters) {
      const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
      const characterMemories = (character.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus));
      characterMemories.forEach((memory, memoryIndex) => {
        entries.push({
          bankId: `c-${character.id}-m-${memoryIndex}`,
          source: "character",
          ownerCharacterId: character.id,
          ownerCharacterName: character.name,
          ownerUsername: character.owner || "DM",
          memoryIndex,
          unownedId: null,
          memory,
        });
      });
    }

    const bankMemories = await storage.getMemoryBankMemories();
    for (const bankMemory of bankMemories) {
      entries.push({
        bankId: `b-${bankMemory.id}`,
        source: "bank",
        ownerCharacterId: null,
        ownerCharacterName: null,
        ownerUsername: null,
        memoryIndex: null,
        unownedId: bankMemory.id,
        memory: normalizeMemory(bankMemory.memory),
      });
    }

    return entries;
  };

  const tradeMessageTypes = new Set<string>([
    WS_EVENTS.MEMORY_TRADE_REQUEST,
    WS_EVENTS.MEMORY_TRADE_ACCEPT,
    WS_EVENTS.MEMORY_TRADE_DECLINE,
    WS_EVENTS.MEMORY_TRADE_SESSION_UPDATE,
    WS_EVENTS.MEMORY_TRADE_SESSION_ACCEPT,
    WS_EVENTS.MEMORY_TRADE_SESSION_CANCEL,
  ]);

  wss.on("connection", (ws) => {
    const authUser = (ws as any).authUser as AuthUser | undefined;
    const username = authUser?.username || "Unknown";
    console.log("Client connected");

    if (authUser) {
      sendToSocket(ws, WS_EVENTS.MEMORY_TRADE_STATE, getTradeStateForUser(authUser.username));
    }

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; payload?: unknown };
        const type = typeof msg.type === "string" ? msg.type : "";
        if (!type) return;

        if (type === WS_EVENTS.DICE_ROLL) {
          broadcast(WS_EVENTS.DICE_ROLL, {
            ...(msg.payload || {}),
            user: username,
          });
          return;
        }

        if (!tradeMessageTypes.has(type)) return;
        if (!authUser) {
          sendTradeErrorToSocket(ws, "Authentication required for memory trading.");
          return;
        }

        if (type === WS_EVENTS.MEMORY_TRADE_REQUEST) {
          const parsed = tradeRequestSchema.safeParse(msg.payload);
          if (!parsed.success) {
            sendTradeErrorToSocket(ws, "Invalid trade request payload.");
            return;
          }

          const { targetUser, targetCharacterId } = parsed.data;
          if (targetUser === authUser.username) {
            sendTradeErrorToSocket(ws, "You cannot trade with yourself.");
            return;
          }
          if (activeTradeSessionByUser.has(authUser.username) || activeTradeSessionByUser.has(targetUser)) {
            sendTradeErrorToSocket(ws, "One of the players is already in an active trade session.");
            return;
          }

          const targetCharacter = await storage.getCharacter(targetCharacterId);
          if (!targetCharacter) {
            sendTradeErrorToSocket(ws, "Selected trade character was not found.");
            return;
          }
          if ((targetCharacter.isActive ?? 1) !== 1) {
            sendTradeErrorToSocket(ws, "Selected trade character is not active.");
            return;
          }
          if (targetCharacter.owner !== targetUser) {
            sendTradeErrorToSocket(ws, "Selected character does not match the target user.");
            return;
          }

          const allCharacters = await storage.getCharacters();
          const hasActiveCharacter = allCharacters.some(
            (character) => character.owner === authUser.username && (character.isActive ?? 1) === 1,
          );
          if (!hasActiveCharacter) {
            sendTradeErrorToSocket(ws, "You need at least one active character to start a trade.");
            return;
          }

          const requestId = `trade-req-${nextTradeRequestId++}`;
          const payload: MemoryTradeRequestPayload = {
            requestId,
            fromUser: authUser.username,
            toUser: targetUser,
            targetCharacterId,
            targetCharacterName: targetCharacter.name,
            createdAt: Date.now(),
          };
          pendingTradeRequests.set(requestId, payload);
          sendToUser(targetUser, WS_EVENTS.MEMORY_TRADE_REQUEST, payload);
          sendToUser(authUser.username, WS_EVENTS.MEMORY_TRADE_REQUEST_SENT, payload);
          sendTradeStateToUser(targetUser);
          sendTradeStateToUser(authUser.username);
          return;
        }

        if (type === WS_EVENTS.MEMORY_TRADE_ACCEPT) {
          const parsed = tradeRequestDecisionSchema.safeParse(msg.payload);
          if (!parsed.success) {
            sendTradeErrorToSocket(ws, "Invalid trade accept payload.");
            return;
          }

          const request = pendingTradeRequests.get(parsed.data.requestId);
          if (!request) {
            sendTradeErrorToSocket(ws, "Trade request no longer exists.");
            sendTradeStateToUser(authUser.username);
            return;
          }
          if (request.toUser !== authUser.username) {
            sendTradeErrorToSocket(ws, "You are not allowed to accept this trade request.");
            return;
          }
          if (activeTradeSessionByUser.has(request.fromUser) || activeTradeSessionByUser.has(request.toUser)) {
            pendingTradeRequests.delete(request.requestId);
            sendTradeStateToUser(request.fromUser);
            sendTradeStateToUser(request.toUser);
            sendTradeErrorToSocket(ws, "Trade request expired because one player is already in a trade.");
            return;
          }

          const sessionId = `trade-session-${nextTradeSessionId++}`;
          const session: MemoryTradeSessionRecord = {
            sessionId,
            requestId: request.requestId,
            requester: request.fromUser,
            recipient: request.toUser,
            offers: {
              [request.fromUser]: {
                characterId: null,
                memoryIndexes: [],
              },
              [request.toUser]: {
                characterId: request.targetCharacterId,
                memoryIndexes: [],
              },
            },
            acceptedBy: new Set<string>(),
            createdAt: Date.now(),
          };

          pendingTradeRequests.delete(request.requestId);
          activeTradeSessions.set(sessionId, session);
          activeTradeSessionByUser.set(request.fromUser, sessionId);
          activeTradeSessionByUser.set(request.toUser, sessionId);

          const payload = toSessionPayload(session);
          sendToUser(request.fromUser, WS_EVENTS.MEMORY_TRADE_SESSION_STARTED, payload);
          sendToUser(request.toUser, WS_EVENTS.MEMORY_TRADE_SESSION_STARTED, payload);
          sendTradeStateToUser(request.fromUser);
          sendTradeStateToUser(request.toUser);
          return;
        }

        if (type === WS_EVENTS.MEMORY_TRADE_DECLINE) {
          const parsed = tradeRequestDecisionSchema.safeParse(msg.payload);
          if (!parsed.success) {
            sendTradeErrorToSocket(ws, "Invalid trade decline payload.");
            return;
          }

          const request = pendingTradeRequests.get(parsed.data.requestId);
          if (!request) {
            sendTradeErrorToSocket(ws, "Trade request no longer exists.");
            sendTradeStateToUser(authUser.username);
            return;
          }
          if (request.toUser !== authUser.username) {
            sendTradeErrorToSocket(ws, "You are not allowed to decline this trade request.");
            return;
          }

          pendingTradeRequests.delete(request.requestId);
          const payload: MemoryTradeRequestDeclinedPayload = {
            requestId: request.requestId,
            fromUser: request.fromUser,
            toUser: request.toUser,
            message: `${request.toUser} declined your memory trade request.`,
          };
          sendToUser(request.fromUser, WS_EVENTS.MEMORY_TRADE_REQUEST_DECLINED, payload);
          sendTradeStateToUser(request.fromUser);
          sendTradeStateToUser(request.toUser);
          return;
        }

        if (type === WS_EVENTS.MEMORY_TRADE_SESSION_UPDATE) {
          const parsed = tradeSessionUpdateSchema.safeParse(msg.payload);
          if (!parsed.success) {
            sendTradeErrorToSocket(ws, "Invalid trade session update payload.");
            return;
          }

          const session = activeTradeSessions.get(parsed.data.sessionId);
          if (!session) {
            sendTradeErrorToSocket(ws, "Trade session no longer exists.");
            sendTradeStateToUser(authUser.username);
            return;
          }
          if (session.requester !== authUser.username && session.recipient !== authUser.username) {
            sendTradeErrorToSocket(ws, "You are not a participant in this trade session.");
            return;
          }

          const character = await storage.getCharacter(parsed.data.characterId);
          if (!character) {
            sendTradeErrorToSocket(ws, "Selected character was not found.", undefined, session.sessionId);
            return;
          }
          if ((character.isActive ?? 1) !== 1) {
            sendTradeErrorToSocket(ws, "Selected character must be active.", undefined, session.sessionId);
            return;
          }
          if (character.owner !== authUser.username) {
            sendTradeErrorToSocket(ws, "You can only trade with your own active characters.", undefined, session.sessionId);
            return;
          }

          const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
          const memories = (character.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus));
          session.offers[authUser.username] = {
            characterId: parsed.data.characterId,
            memoryIndexes: sanitizeMemoryIndexes(parsed.data.memoryIndexes, memories.length),
          };
          session.acceptedBy.clear();

          const payload = toSessionPayload(session);
          sendToUser(session.requester, WS_EVENTS.MEMORY_TRADE_SESSION_UPDATED, payload);
          sendToUser(session.recipient, WS_EVENTS.MEMORY_TRADE_SESSION_UPDATED, payload);
          return;
        }

        if (type === WS_EVENTS.MEMORY_TRADE_SESSION_ACCEPT) {
          const parsed = tradeSessionAcceptSchema.safeParse(msg.payload);
          if (!parsed.success) {
            sendTradeErrorToSocket(ws, "Invalid trade accept state payload.");
            return;
          }

          const session = activeTradeSessions.get(parsed.data.sessionId);
          if (!session) {
            sendTradeErrorToSocket(ws, "Trade session no longer exists.");
            sendTradeStateToUser(authUser.username);
            return;
          }
          if (session.requester !== authUser.username && session.recipient !== authUser.username) {
            sendTradeErrorToSocket(ws, "You are not a participant in this trade session.");
            return;
          }

          if (parsed.data.accepted) {
            session.acceptedBy.add(authUser.username);
          } else {
            session.acceptedBy.delete(authUser.username);
          }

          const payload = toSessionPayload(session);
          sendToUser(session.requester, WS_EVENTS.MEMORY_TRADE_SESSION_UPDATED, payload);
          sendToUser(session.recipient, WS_EVENTS.MEMORY_TRADE_SESSION_UPDATED, payload);

          if (
            session.acceptedBy.has(session.requester) &&
            session.acceptedBy.has(session.recipient)
          ) {
            await executeMemoryTrade(session);
          }
          return;
        }

        if (type === WS_EVENTS.MEMORY_TRADE_SESSION_CANCEL) {
          const parsed = tradeSessionCancelSchema.safeParse(msg.payload);
          if (!parsed.success) {
            sendTradeErrorToSocket(ws, "Invalid trade cancellation payload.");
            return;
          }

          const session = activeTradeSessions.get(parsed.data.sessionId);
          if (!session) {
            sendTradeErrorToSocket(ws, "Trade session no longer exists.");
            sendTradeStateToUser(authUser.username);
            return;
          }
          if (session.requester !== authUser.username && session.recipient !== authUser.username) {
            sendTradeErrorToSocket(ws, "You are not a participant in this trade session.");
            return;
          }

          closeTradeSession(session, "cancelled", `${authUser.username} cancelled the memory trade.`);
        }
      } catch (error) {
        console.error("WebSocket message handling error", error);
      }
    });

    ws.on("close", () => {
      if (authUser) {
        if (hasOtherOpenSocketForUser(authUser.username, ws)) {
          console.log("Client disconnected");
          return;
        }
        const sessionId = activeTradeSessionByUser.get(authUser.username);
        if (sessionId) {
          const session = activeTradeSessions.get(sessionId);
          if (session) {
            const reason = session.requester === authUser.username
              ? "requester-disconnected"
              : "recipient-disconnected";
            closeTradeSession(
              session,
              reason,
              `${authUser.username} disconnected. Trade session cancelled.`,
            );
          }
        }
        cleanupPendingRequestsForUser(authUser.username);
      }
      console.log("Client disconnected");
    });
  });

  app.get(api.campaign.state.path, (_req, res) => {
    res.status(200).json({ dayCount: campaignDay });
  });

  app.post(api.campaign.updateDay.path, async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can update the campaign day" });

    try {
      const input = api.campaign.updateDay.input.parse(req.body);
      const payload = await applyCampaignDayDelta(input.delta, user.username);
      res.status(200).json(payload);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      return res.status(500).json({ message: "Failed to update campaign day" });
    }
  });

  app.post(api.campaign.setDay.path, async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can update the campaign day" });

    try {
      const input = api.campaign.setDay.input.parse(req.body);
      const delta = input.dayCount - campaignDay;
      const payload = await applyCampaignDayDelta(delta, user.username);
      return res.status(200).json(payload);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      return res.status(500).json({ message: "Failed to set campaign day" });
    }
  });

  app.post(api.campaign.passHour.path, async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can pass time" });

    const message = "An hour has passed. You have regained 1 essence. Your inactive memories and echoes have healed.";
    const updatedCharacterIds: number[] = [];
    const characterDeltas: UndoHourPassCharacterDelta[] = [];
    const characters = await storage.getCharacters();

    for (const character of characters) {
      const maxEssence = character.maxEssence ?? 10;
      const currentEssence = character.currentEssence ?? 0;
      const nextEssence = Math.min(maxEssence, currentEssence + 1);
      const essenceChanged = nextEssence !== currentEssence;
      const essenceDelta = nextEssence - currentEssence;

      const memoryDeltas: UndoMemoryDelta[] = [];
      const nextMemories = (character.memories || []).map((rawMemory, memoryIndex) => {
        const memory = normalizeMemory(rawMemory, getProficiencyBonus(character.totalSoulFragments ?? 0));
        if (memory.isSummoned) return memory;

        const healRate = Math.max(0, memory.healRate ?? 1);
        const nextDurability = Math.min(memory.maxDurability, memory.currentDurability + healRate);
        const delta = nextDurability - memory.currentDurability;
        if (delta > 0) {
          memoryDeltas.push({
            index: memoryIndex,
            delta,
            previousDurability: memory.currentDurability,
          });
        }
        return { ...memory, currentDurability: nextDurability };
      });
      const memoriesChanged = memoryDeltas.length > 0;

      const echoDeltas: UndoEchoDelta[] = [];
      const nextEchoes = normalizeEchoes(character.echoes).map((echo, echoIndex) => {
        if (echo.isSummoned) return echo;

        const healRate = Math.max(0, echo.healRate ?? 1);
        const nextHealth = Math.min(echo.maxHealth, echo.currentHealth + healRate);
        const delta = nextHealth - echo.currentHealth;
        if (delta > 0) {
          echoDeltas.push({
            index: echoIndex,
            delta,
            previousHealth: echo.currentHealth,
          });
        }
        return { ...echo, currentHealth: nextHealth };
      });
      const echoesChanged = echoDeltas.length > 0;

      if (!essenceChanged && !memoriesChanged && !echoesChanged) {
        continue;
      }

      const updates: any = {};
      if (essenceChanged) {
        updates.currentEssence = nextEssence;
      }
      if (memoriesChanged) {
        updates.memories = nextMemories;
      }
      if (echoesChanged) {
        updates.echoes = serializeEchoes(nextEchoes);
      }

      const updatedCharacter = await storage.updateCharacter(character.id, updates);
      updatedCharacterIds.push(updatedCharacter.id);
      broadcastUpdate(updatedCharacter);
      characterDeltas.push({
        id: character.id,
        previousEssence: currentEssence,
        essenceDelta,
        memoryDeltas,
        echoDeltas,
      });
    }

    pushUndoAction({
      actionType: "pass-hour",
      characterDeltas,
      performedBy: user.username,
      createdAt: Date.now(),
    });

    const systemMessagePayload: SystemMessagePayload = {
      title: "An Hour Has Passed",
      message,
    };
    broadcast(WS_EVENTS.SYSTEM_MESSAGE, systemMessagePayload);

    res.status(200).json({
      updatedCharacterIds,
      message,
    });
  });

  app.post(api.campaign.undo.path, async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can undo campaign actions" });

    const action = campaignUndoStack.pop();
    if (!action) {
      return res.status(404).json({ message: "No DM action available to undo" });
    }

    const updatedCharacterIds: number[] = [];
    let message = "Undo applied.";

    if (action.actionType === "update-day") {
      campaignDay = Math.max(1, campaignDay - action.dayDelta);
      broadcast(WS_EVENTS.CAMPAIGN_DAY_UPDATE, { dayCount: campaignDay });
      const essenceDeltas = action.essenceDeltas || [];
      for (const essenceDelta of essenceDeltas) {
        const character = await storage.getCharacter(essenceDelta.id);
        if (!character) continue;

        const currentEssence = character.currentEssence ?? 0;
        if (currentEssence === essenceDelta.previousEssence) continue;

        const updatedCharacter = await storage.updateCharacter(character.id, {
          currentEssence: essenceDelta.previousEssence,
        });
        updatedCharacterIds.push(updatedCharacter.id);
        broadcastUpdate(updatedCharacter);
      }

      message = essenceDeltas.length > 0
        ? "The DM undid the last day adjustment and restored pre-advance essence."
        : "The DM undid the last day adjustment.";
    } else if (action.actionType === "pass-hour") {
      for (const characterDelta of action.characterDeltas) {
        const character = await storage.getCharacter(characterDelta.id);
        if (!character) continue;

        const updates: any = {};
        let changed = false;

        if (characterDelta.essenceDelta > 0) {
          const currentEssence = character.currentEssence ?? 0;
          const nextEssence = Math.max(
            characterDelta.previousEssence,
            currentEssence - characterDelta.essenceDelta,
          );
          if (nextEssence !== currentEssence) {
            updates.currentEssence = nextEssence;
            changed = true;
          }
        }

        if (characterDelta.memoryDeltas.length > 0) {
          const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
          const memories = (character.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus));
          let memoriesChanged = false;

          for (const memoryDelta of characterDelta.memoryDeltas) {
            const memory = memories[memoryDelta.index];
            if (!memory) continue;

            const nextDurability = Math.max(
              memoryDelta.previousDurability,
              memory.currentDurability - memoryDelta.delta,
            );
            if (nextDurability !== memory.currentDurability) {
              memories[memoryDelta.index] = { ...memory, currentDurability: nextDurability };
              memoriesChanged = true;
            }
          }

          if (memoriesChanged) {
            updates.memories = memories;
            changed = true;
          }
        }

        if (characterDelta.echoDeltas.length > 0) {
          const echoes = normalizeEchoes(character.echoes);
          let echoesChanged = false;

          for (const echoDelta of characterDelta.echoDeltas) {
            const echo = echoes[echoDelta.index];
            if (!echo) continue;

            const nextHealth = Math.max(
              echoDelta.previousHealth,
              echo.currentHealth - echoDelta.delta,
            );
            if (nextHealth !== echo.currentHealth) {
              echoes[echoDelta.index] = { ...echo, currentHealth: nextHealth };
              echoesChanged = true;
            }
          }

          if (echoesChanged) {
            updates.echoes = serializeEchoes(echoes);
            changed = true;
          }
        }

        if (!changed) continue;

        const updatedCharacter = await storage.updateCharacter(character.id, updates);
        updatedCharacterIds.push(updatedCharacter.id);
        broadcastUpdate(updatedCharacter);
      }

      message = "The DM undid 'An Hour Has Passed'. Essence and inactive memory/echo healing were reverted.";
    }

    const systemMessagePayload: SystemMessagePayload = {
      title: "Undo Applied",
      message,
    };
    broadcast(WS_EVENTS.SYSTEM_MESSAGE, systemMessagePayload);

    return res.status(200).json({
      actionType: action.actionType,
      dayCount: campaignDay,
      updatedCharacterIds,
      message,
    });
  });

  app.get("/api/memory-bank", async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can access the memory bank" });

    const entries = await buildMemoryBankEntries();
    return res.status(200).json(entries);
  });

  app.post("/api/memory-bank", async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can create memory bank entries" });

    const parsed = memoryBankMemorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid memory payload" });
    }

    const memory = normalizeMemory(parsed.data);
    memory.isSummoned = false;
    const created = await storage.createMemoryBankMemory(memory);
    return res.status(201).json(created);
  });

  app.put("/api/memory-bank/character/:characterId/:memoryIndex", async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can edit character memories from the memory bank" });

    const characterId = Number(req.params.characterId);
    const memoryIndex = Number(req.params.memoryIndex);
    if (!Number.isFinite(characterId) || !Number.isFinite(memoryIndex) || memoryIndex < 0) {
      return res.status(400).json({ message: "Invalid character memory reference" });
    }

    const parsed = memoryBankMemorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid memory payload" });
    }

    const character = await storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });

    const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
    const memories = (character.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus));
    if (!memories[memoryIndex]) {
      return res.status(404).json({ message: "Memory not found on character" });
    }

    memories[memoryIndex] = normalizeMemory(parsed.data, proficiencyBonus);
    const updatedCharacter = await storage.updateCharacter(character.id, { memories });
    broadcastUpdate(updatedCharacter);
    return res.status(200).json(updatedCharacter);
  });

  app.post("/api/memory-bank/character/:characterId/:memoryIndex/deassign", async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can deassign memories" });

    const characterId = Number(req.params.characterId);
    const memoryIndex = Number(req.params.memoryIndex);
    if (!Number.isFinite(characterId) || !Number.isFinite(memoryIndex) || memoryIndex < 0) {
      return res.status(400).json({ message: "Invalid character memory reference" });
    }

    const character = await storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });

    const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
    const memories = (character.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus));
    const memory = memories[memoryIndex];
    if (!memory) {
      return res.status(404).json({ message: "Memory not found on character" });
    }

    const detachedMemory = { ...memory, isSummoned: false };
    const nextMemories = memories.filter((_item, index) => index !== memoryIndex);
    const updatedCharacter = await storage.updateCharacter(character.id, { memories: nextMemories });
    broadcastUpdate(updatedCharacter);

    const created = await storage.createMemoryBankMemory(detachedMemory);
    return res.status(200).json(created);
  });

  app.put("/api/memory-bank/bank/:id", async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can edit bank memories" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid memory bank id" });
    }

    const parsed = memoryBankMemorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid memory payload" });
    }

    const existing = await storage.getMemoryBankMemory(id);
    if (!existing) return res.status(404).json({ message: "Memory bank entry not found" });

    const memory = normalizeMemory(parsed.data);
    memory.isSummoned = false;
    const updated = await storage.updateMemoryBankMemory(id, memory);
    return res.status(200).json(updated);
  });

  app.post("/api/memory-bank/bank/:id/assign", async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!user.isDM) return res.status(403).json({ message: "Only the DM can assign bank memories" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid memory bank id" });
    }

    const parsed = memoryBankAssignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid assignment payload" });
    }

    const bankMemory = await storage.getMemoryBankMemory(id);
    if (!bankMemory) return res.status(404).json({ message: "Memory bank entry not found" });

    const character = await storage.getCharacter(parsed.data.characterId);
    if (!character) return res.status(404).json({ message: "Target character not found" });

    const memory = normalizeMemory(bankMemory.memory);
    memory.isSummoned = false;
    const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
    const characterMemories = (character.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus));
    characterMemories.push(memory);

    const updatedCharacter = await storage.updateCharacter(character.id, { memories: characterMemories });
    broadcastUpdate(updatedCharacter);
    await storage.deleteMemoryBankMemory(id);

    return res.status(200).json(updatedCharacter);
  });

  // API Routes
  app.get(api.characters.list.path, async (req, res) => {
    const characters = await storage.getCharacters();
    res.json(characters);
  });

  app.get(api.characters.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid character id" });
    }

    const character = await storage.getCharacter(id);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }
    res.json(character);
  });

  app.post(api.characters.create.path, async (req, res) => {
    try {
      const user = (req as SessionRequest).authUser;
      if (!user) return res.status(401).json({ message: "Authentication required" });

      const input = api.characters.create.input.parse(req.body);
      const payload = {
        ...input,
        owner: user.isDM ? input.owner || user.username : user.username,
      };
      const character = await storage.createCharacter(payload);
      broadcastUpdate(character);
      res.status(201).json(character);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.put(api.characters.update.path, async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid character id" });
    }

    const existing = await storage.getCharacter(id);
    if (!existing) {
      return res.status(404).json({ message: "Character not found" });
    }
    if (!canManageCharacter(user, existing.owner || "DM")) {
      return res.status(403).json({ message: "You do not have permission to edit this character" });
    }

    try {
      const input = api.characters.update.input.parse(req.body);
      if (!user.isDM && "owner" in input) {
        delete (input as Partial<typeof input>).owner;
      }

      const character = await storage.updateCharacter(id, input);
      broadcastUpdate(character);
      res.status(200).json(character);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      return res.status(500).json({ message: "Failed to update character" });
    }
  });

  app.delete(api.characters.delete.path, async (req, res) => {
    const user = (req as SessionRequest).authUser;
    if (!user) return res.status(401).json({ message: "Authentication required" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid character id" });
    }

    const existing = await storage.getCharacter(id);
    if (!existing) {
      return res.status(404).json({ message: "Character not found" });
    }
    if (!canManageCharacter(user, existing.owner || "DM")) {
      return res.status(403).json({ message: "You do not have permission to delete this character" });
    }

    await storage.deleteCharacter(id);
    res.status(204).send();
  });

  // Seed DB if empty
  const existing = await storage.getCharacters();
  if (existing.length === 0) {
    await storage.createCharacter({
      name: "Sunny",
      currentHealth: 8,
      maxHealth: 8,
      armorClass: 8,
      stats: {
        strength: 0,
        dexterity: 0,
        constitution: 0,
        intelligence: 0,
        wisdom: 0,
        charisma: 0,
      },
      trueName: "Lost from Light",
      rank: "Awakened",
      soulCore: "Dormant",
      soulFragments: 150,
      soulClass: "Beast",
      totalSoulFragments: 150,
      currentEssence: 10,
      maxEssence: 20,
      memories: [
        {
          name: "Weaver's Mask",
          description: "A mask that hides the wearer's face and fate.",
          effect: "Conceals True Name from divinations.",
          memoryType: "tool",
          core: "dormant",
          tier: 1,
          essenceCost: 0,
          isDamageDealing: false,
          currentDurability: 10,
          maxDurability: 10,
          healRate: 1,
          isSummoned: false,
        },
      ],
      echoes: serializeEchoes([
        {
          name: "Scavenger",
          armorClass: 8,
          description: "",
          damageMoves: [],
          core: "dormant",
          tier: 1,
          currentHealth: 8,
          maxHealth: 8,
          healRate: 1,
          summonCost: 0,
          isSummoned: false,
        },
      ]),
      inventoryNotes: "",
      attributes: [
        { name: "Fated", description: "Bound by a powerful destiny.", effect: "Increased luck but prone to dangerous encounters." }
      ],
      aspect: "Shadow Slave",
      aspectRank: "Divine",
      aspectAbilities: [
        { name: "Shadow Control", description: "Manipulate shadows to do your bidding.", effect: "Can step through shadows and manifest solid shadow objects." }
      ],
      aspectAbilityDescription: "Your shadows are your slaves. You can command them freely.",
      owner: "DM",
    });
  }

  return httpServer;
}
