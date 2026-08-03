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
