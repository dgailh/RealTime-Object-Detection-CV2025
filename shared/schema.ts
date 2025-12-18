import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Detection types for license plate detection
export interface Detection {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] in pixels
  conf: number; // Confidence score 0-1
}

export interface DetectionResponse {
  detections: Detection[];
  image_annotated_base64: string; // data:image/jpeg;base64,...
  image_width?: number;
  image_height?: number;
}

export interface DetectionError {
  detail: string;
}
