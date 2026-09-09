import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const factSchema = z.object({
  label: z.string(),
  lines: z.array(z.string()).min(1),
  datetime: z.string().optional(),
});

const teachers = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/teachers" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      bio: z.string(),
      image: image(),
      imageAlt: z.string(),
      objectPosition: z.string().default("center"),
    }),
});

const courses = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/courses" }),
  schema: ({ image }) =>
    z.object({
      order: z.number().int().positive(),
      title: z.string(),
      type: z.string(),
      intro: z.string(),
      sectionLabel: z.string(),
      story: z.array(z.string()).min(1),
      heroImage: image(),
      heroAlt: z.string().default(""),
      cardImagePosition: z.string().default("center"),
      cardCaption: z.string(),
      facts: z.array(factSchema).min(1),
      spotsLeft: z.number().int().positive().optional(),
      offer: z.string().optional(),
      teachers: z.array(reference("teachers")).default([]),
      seoDescription: z.string(),
      kind: z.enum(["course", "service"]).default("course"),
    }),
});

export const collections = { courses, teachers };
