import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const broadcastUpdate = (payload: any) => {
    const msg = JSON.stringify({ type: WS_EVENTS.UPDATE_CHARACTER, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  };

  wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  // API Routes
  app.get(api.characters.list.path, async (req, res) => {
    const characters = await storage.getCharacters();
    res.json(characters);
  });

  app.get(api.characters.get.path, async (req, res) => {
    const character = await storage.getCharacter(Number(req.params.id));
    if (!character) {
      return res.status(404).json({ message: 'Character not found' });
    }
    res.json(character);
  });

  app.post(api.characters.create.path, async (req, res) => {
    try {
      const input = api.characters.create.input.parse(req.body);
      const character = await storage.createCharacter(input);
      broadcastUpdate(character);
      res.status(201).json(character);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.characters.update.path, async (req, res) => {
    try {
      const input = api.characters.update.input.parse(req.body);
      const character = await storage.updateCharacter(Number(req.params.id), input);
      broadcastUpdate(character);
      res.status(200).json(character);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      return res.status(404).json({ message: 'Character not found' });
    }
  });

  app.delete(api.characters.delete.path, async (req, res) => {
    await storage.deleteCharacter(Number(req.params.id));
    res.status(204).send();
  });

  // Seed DB if empty
  const existing = await storage.getCharacters();
  if (existing.length === 0) {
    await storage.createCharacter({
      name: "Sunny",
      currentHealth: 8,
      maxHealth: 8,
      trueName: "Lost from Light",
      rank: "Awakened",
      soulCore: "Dormant",
      soulFragments: 150,
      soulClass: "Beast",
      totalSoulFragments: 150,
      currentEssence: 10,
      maxEssence: 20,
      memories: [
        { name: "Weaver's Mask", description: "A mask that hides the wearer's face and fate.", effect: "Conceals True Name from divinations." }
      ],
      echoes: "Scavenger",
      attributes: [
        { name: "Fated", description: "Bound by a powerful destiny.", effect: "Increased luck but prone to dangerous encounters." }
      ],
      aspect: "Shadow Slave",
      aspectRank: "Divine",
      aspectAbilities: [
        { name: "Shadow Control", description: "Manipulate shadows to do your bidding.", effect: "Can step through shadows and manifest solid shadow objects." }
      ],
      aspectAbilityDescription: "Your shadows are your slaves. You can command them freely."
    });
  }

  return httpServer;
}
