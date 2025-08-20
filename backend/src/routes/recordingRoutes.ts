import express from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authMiddleware";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../middleware/validationMiddleware";
import recordingService from "../services/recordingService";
import { Response } from "express";
import { AuthenticatedRequest } from "../types/interfaces";
import path from "path";
import fs from "fs";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const startRecordingSchema = z.object({
  title: z.string().optional(),
  options: z
    .object({
      quality: z.enum(["480p", "720p", "1080p"]).optional(),
      format: z.enum(["mp4", "webm"]).optional(),
      includeAudio: z.boolean().optional(),
      includeVideo: z.boolean().optional(),
      includeScreenShare: z.boolean().optional(),
    })
    .optional(),
});

const meetingIdSchema = z.string().uuid();
const recordingIdSchema = z.string().uuid();

const userRecordingsQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

const updateRecordingSettingsSchema = z.object({
  title: z.string().optional(),
  isPublic: z.boolean().optional(),
  password: z.string().optional(),
});

const cleanupRecordingsSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650).optional(),
});

/**
 * Start recording a meeting
 * POST /api/meetings/:meetingId/recordings/start
 */
router.post(
  "/meetings/:meetingId/recordings/start",
  validateParams("meetingId", meetingIdSchema),
  validateBody(startRecordingSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { meetingId } = req.params;
      const { title, options } = req.body;
      const userId = req.user!.id;

      const recording = await recordingService.startRecording({
        meetingId,
        userId,
        title,
        options,
      });

      res.status(201).json({
        success: true,
        data: recording,
        message: "Recording started successfully",
      });
    } catch (error: any) {
      console.error("Error starting recording:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to start recording",
      });
    }
  },
);

/**
 * Stop recording
 * POST /api/recordings/:recordingId/stop
 */
router.post(
  "/recordings/:recordingId/stop",
  validateParams("recordingId", recordingIdSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { recordingId } = req.params;
      const userId = req.user!.id;

      const recording = await recordingService.stopRecording(
        recordingId,
        userId,
      );

      res.json({
        success: true,
        data: recording,
        message: "Recording stopped successfully",
      });
    } catch (error: any) {
      console.error("Error stopping recording:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to stop recording",
      });
    }
  },
);

/**
 * Get recording details
 * GET /api/recordings/:recordingId
 */
router.get(
  "/recordings/:recordingId",
  validateParams("recordingId", recordingIdSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { recordingId } = req.params;
      const userId = req.user!.id;

      const recording = await recordingService.getRecording(
        recordingId,
        userId,
      );

      if (!recording) {
        return res.status(404).json({
          success: false,
          message: "Recording not found",
        });
      }

      res.json({
        success: true,
        data: recording,
      });
    } catch (error: any) {
      console.error("Error getting recording:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get recording",
      });
    }
  },
);

/**
 * Get recordings for a meeting
 * GET /api/meetings/:meetingId/recordings
 */
router.get(
  "/meetings/:meetingId/recordings",
  validateParams("meetingId", meetingIdSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { meetingId } = req.params;
      const userId = req.user!.id;

      const recordings = await recordingService.getMeetingRecordings(
        meetingId,
        userId,
      );

      res.json({
        success: true,
        data: recordings,
      });
    } catch (error: any) {
      console.error("Error getting meeting recordings:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get meeting recordings",
      });
    }
  },
);

/**
 * Get user's recordings
 * GET /api/users/recordings
 */
router.get(
  "/users/recordings",
  validateQuery(userRecordingsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const recordings = await recordingService.getUserRecordings(
        userId,
        limit,
        offset,
      );

      res.json({
        success: true,
        data: recordings,
        pagination: {
          limit,
          offset,
          total: recordings.length,
        },
      });
    } catch (error: any) {
      console.error("Error getting user recordings:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get recordings",
      });
    }
  },
);

/**
 * Download recording
 * GET /api/recordings/:recordingId/download
 */
router.get(
  "/recordings/:recordingId/download",
  validateParams("recordingId", recordingIdSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { recordingId } = req.params;
      const userId = req.user!.id;

      // Get recording and check permissions
      const recording = await recordingService.getRecording(
        recordingId,
        userId,
      );

      if (!recording) {
        return res.status(404).json({
          success: false,
          message: "Recording not found",
        });
      }

      if (recording.status !== "COMPLETED") {
        return res.status(400).json({
          success: false,
          message: "Recording is not ready for download",
        });
      }

      // Check if file exists
      if (!fs.existsSync(recording.filePath)) {
        return res.status(404).json({
          success: false,
          message: "Recording file not found",
        });
      }

      // Update download count
      await recordingService.getRecording(recordingId, userId); // This will increment view count

      // Set appropriate headers for download
      const fileName = recording.fileName;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.setHeader("Content-Type", "application/octet-stream");

      // Stream the file
      const fileStream = fs.createReadStream(recording.filePath);
      fileStream.pipe(res);

      fileStream.on("error", (error) => {
        console.error("Error streaming recording file:", error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "Error downloading file",
          });
        }
      });
    } catch (error: any) {
      console.error("Error downloading recording:", error);
      if (!res.headersSent) {
        res.status(400).json({
          success: false,
          message: error.message || "Failed to download recording",
        });
      }
    }
  },
);

/**
 * Stream recording for playback
 * GET /api/recordings/:recordingId/stream
 */
router.get(
  "/recordings/:recordingId/stream",
  validateParams("recordingId", recordingIdSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { recordingId } = req.params;
      const userId = req.user!.id;

      // Get recording and check permissions
      const recording = await recordingService.getRecording(
        recordingId,
        userId,
      );

      if (!recording) {
        return res.status(404).json({
          success: false,
          message: "Recording not found",
        });
      }

      if (recording.status !== "COMPLETED") {
        return res.status(400).json({
          success: false,
          message: "Recording is not ready for streaming",
        });
      }

      // Check if file exists
      if (!fs.existsSync(recording.filePath)) {
        return res.status(404).json({
          success: false,
          message: "Recording file not found",
        });
      }

      const stat = fs.statSync(recording.filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        // Handle range requests for video streaming
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Length", chunksize);
        res.setHeader("Content-Type", `video/${recording.format}`);

        const fileStream = fs.createReadStream(recording.filePath, {
          start,
          end,
        });
        fileStream.pipe(res);
      } else {
        // Full file streaming
        res.setHeader("Content-Length", fileSize);
        res.setHeader("Content-Type", `video/${recording.format}`);

        const fileStream = fs.createReadStream(recording.filePath);
        fileStream.pipe(res);
      }
    } catch (error: any) {
      console.error("Error streaming recording:", error);
      if (!res.headersSent) {
        res.status(400).json({
          success: false,
          message: error.message || "Failed to stream recording",
        });
      }
    }
  },
);

/**
 * Delete recording
 * DELETE /api/recordings/:recordingId
 */
router.delete(
  "/recordings/:recordingId",
  validateParams("recordingId", recordingIdSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { recordingId } = req.params;
      const userId = req.user!.id;

      await recordingService.deleteRecording(recordingId, userId);

      res.json({
        success: true,
        message: "Recording deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting recording:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete recording",
      });
    }
  },
);

/**
 * Update recording settings
 * PUT /api/recordings/:recordingId/settings
 */
router.put(
  "/recordings/:recordingId/settings",
  validateParams("recordingId", recordingIdSchema),
  validateBody(updateRecordingSettingsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { recordingId } = req.params;
      const { title, isPublic, password } = req.body;
      const userId = req.user!.id;

      // Check if user has permission to update recording
      const recording = await recordingService.getRecording(
        recordingId,
        userId,
      );

      if (!recording) {
        return res.status(404).json({
          success: false,
          message: "Recording not found",
        });
      }

      // Only owner or admin can update settings
      const user = req.user!;
      const canUpdate =
        recording.ownerId === userId ||
        user.role === "ADMIN" ||
        user.role === "SUPER_ADMIN";

      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions to update recording",
        });
      }

      // Update recording (implement this in the service)
      // For now, we'll use a simple Prisma update
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();

      const updatedRecording = await prisma.recording.update({
        where: { id: recordingId },
        data: {
          ...(title && { title }),
          ...(typeof isPublic !== "undefined" && { isPublic }),
          ...(password && { password }), // In production, hash this password
        },
      });

      res.json({
        success: true,
        data: updatedRecording,
        message: "Recording settings updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating recording settings:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update recording settings",
      });
    }
  },
);

/**
 * Get recording statistics (admin only)
 * GET /api/admin/recordings/stats
 */
router.get(
  "/admin/recordings/stats",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;

      // Check admin permissions
      if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const stats = await recordingService.getRecordingStats(user.clientId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error("Error getting recording stats:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get recording statistics",
      });
    }
  },
);

/**
 * Cleanup old recordings (admin only)
 * POST /api/admin/recordings/cleanup
 */
router.post(
  "/admin/recordings/cleanup",
  validateBody(cleanupRecordingsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;

      // Check admin permissions
      if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const retentionDays = req.body.retentionDays || 90;
      const deletedCount =
        await recordingService.cleanupOldRecordings(retentionDays);

      res.json({
        success: true,
        data: { deletedCount },
        message: `Cleaned up ${deletedCount} old recordings`,
      });
    } catch (error: any) {
      console.error("Error cleaning up recordings:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to cleanup recordings",
      });
    }
  },
);

export default router;
