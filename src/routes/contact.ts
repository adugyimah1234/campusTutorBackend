import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { sendContactEmail } from "../utils/mailer";

const router = Router();

const contactSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(200),
    message: z.string().min(10).max(4000),
  }),
});

router.post("/", validate(contactSchema), async (req, res, next) => {
  try {
    const { name, email, message } = req.body;
    await sendContactEmail({ name, email, message });
    res.json({ ok: true });
  } catch (err) {
    next(err as Error);
  }
});

export default router;
