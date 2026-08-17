import { z } from "zod";

const passwordRule = z
  .string({ error: "Password is required." })
  .min(8, { error: "Password must be at least 8 characters long." })
  .regex(/[^A-Za-z0-9]/, {
    error: "Password must contain a special symbol.",
  });

const emailRule = z
  .email({ error: "Please enter a valid email." })
  .trim()
  .toLowerCase();

export const passwordConfirmationSchema = z
  .object({
    password: passwordRule,
    confirmPassword: z.string({
      error: "Please confirm your password.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const signUpSchema = passwordConfirmationSchema.extend({
  email: emailRule,
});

export const signInSchema = z.object({
  email: emailRule,
  password: z.string({ error: "Password is required." }),
});

export const forgotPasswordSchema = z.object({
  email: emailRule,
});

export const resetPasswordSchema = passwordConfirmationSchema;

export const noteSchema = z.object({
  title: z
    .string({ error: "Title is required." })
    .trim()
    .max(200, { error: "Title must be at most 200 characters." })
    .default(""),
  content: z
    .string({ error: "Content is required." })
    .max(100_000, { error: "Content is too long." })
    .default(""),
});

export const createNoteSchema = noteSchema.extend({
  id: z.uuid({ error: "Invalid note id." }).optional(),
});

export const updateNoteSchema = noteSchema.extend({
  id: z.uuid({ error: "Invalid note." }),
});
