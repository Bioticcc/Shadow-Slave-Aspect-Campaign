import { db } from "./db";
import {
  characters,
  memoryBank,
  type Character,
  type InsertCharacter,
  type Memory,
  type MemoryBankMemory,
  type UpdateCharacterRequest
} from "@shared/schema";
import { eq } from "drizzle-orm";

type CharacterInsert = typeof characters.$inferInsert;

export interface IStorage {
  getCharacters(): Promise<Character[]>;
  getCharacter(id: number): Promise<Character | undefined>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: number, updates: UpdateCharacterRequest): Promise<Character>;
  deleteCharacter(id: number): Promise<void>;
  getMemoryBankMemories(): Promise<MemoryBankMemory[]>;
  getMemoryBankMemory(id: number): Promise<MemoryBankMemory | undefined>;
  createMemoryBankMemory(memory: Memory): Promise<MemoryBankMemory>;
  updateMemoryBankMemory(id: number, memory: Memory): Promise<MemoryBankMemory>;
  deleteMemoryBankMemory(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCharacters(): Promise<Character[]> {
    return await db.select().from(characters);
  }

  async getCharacter(id: number): Promise<Character | undefined> {
    const [character] = await db.select().from(characters).where(eq(characters.id, id));
    return character;
  }

  async createCharacter(character: InsertCharacter): Promise<Character> {
    const [newCharacter] = await db.insert(characters).values(character as CharacterInsert).returning();
    return newCharacter;
  }

  async updateCharacter(id: number, updates: UpdateCharacterRequest): Promise<Character> {
    const [updated] = await db.update(characters)
      .set(updates as Partial<CharacterInsert>)
      .where(eq(characters.id, id))
      .returning();
    return updated;
  }

  async deleteCharacter(id: number): Promise<void> {
    await db.delete(characters).where(eq(characters.id, id));
  }

  async getMemoryBankMemories(): Promise<MemoryBankMemory[]> {
    return await db.select().from(memoryBank);
  }

  async getMemoryBankMemory(id: number): Promise<MemoryBankMemory | undefined> {
    const [entry] = await db.select().from(memoryBank).where(eq(memoryBank.id, id));
    return entry;
  }

  async createMemoryBankMemory(memory: Memory): Promise<MemoryBankMemory> {
    const [entry] = await db.insert(memoryBank).values({ memory }).returning();
    return entry;
  }

  async updateMemoryBankMemory(id: number, memory: Memory): Promise<MemoryBankMemory> {
    const [entry] = await db.update(memoryBank).set({ memory }).where(eq(memoryBank.id, id)).returning();
    return entry;
  }

  async deleteMemoryBankMemory(id: number): Promise<void> {
    await db.delete(memoryBank).where(eq(memoryBank.id, id));
  }
}

export const storage = new DatabaseStorage();
