import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { z } from "zod";
import { listNotifications, markNotificationsRead } from "../services/notification-service";

const router = Router();

const markReadSchema = z.object({
  body: z.object({
    ids: z.array(z.string().uuid()).min(1),
  }),
});

const listSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    since: z.string().datetime({ offset: true }).optional(),
    before: z.string().datetime({ offset: true }).optional(),
  }),
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const parse = listSchema.safeParse({ query: req.query });
    const query = parse.success ? parse.data.query : {};
    const notifications = await listNotifications(req.user!.id, {
      limit: query.limit,
      since: query.since,
      before: query.before,
    });
    const nextBefore = notifications.length ? notifications[notifications.length - 1].created_at : null;
    res.json({ data: notifications, page: { nextBefore } });
  } catch (err) {
    next(err as Error);
  }
});

router.post("/mark-read", requireAuth, validate(markReadSchema), async (req, res, next) => {
  try {
    await markNotificationsRead(req.user!.id, req.body.ids);
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

export default router;
