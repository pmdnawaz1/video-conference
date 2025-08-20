import express from "express";
import multer from "multer";
import { authenticate } from "../middleware/authMiddleware";
import { getChatService } from "../services/chatService";
import { AuthenticatedRequest } from "../types";
import path from "path";
import fs from "fs";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"));
    }
  },
});

/**
 * @route POST /api/chat/messages
 * @desc Send a text message
 * @access Private
 */
router.post(
  "/messages",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { content, meetingId, roomId, replyToId } = req.body;

      if (!content || !meetingId) {
        return res
          .status(400)
          .json({ error: "Content and meetingId are required" });
      }

      if (content.length > 2000) {
        return res
          .status(400)
          .json({ error: "Message content too long (max 2000 characters)" });
      }

      const chatService = getChatService();
      const message = await chatService.sendMessage({
        content,
        userId: req.user.id,
        meetingId,
        roomId,
        replyToId,
      });

      res.status(201).json({
        success: true,
        message,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Failed to send message",
      });
    }
  },
);

/**
 * @route POST /api/chat/files
 * @desc Upload and send a file message
 * @access Private
 */
router.post(
  "/files",
  authenticate,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { meetingId, roomId, replyToId } = req.body;

      if (!meetingId) {
        return res.status(400).json({ error: "meetingId is required" });
      }

      const fileData = {
        originalName: req.file.originalname,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        size: req.file.size,
      };

      const chatService = getChatService();
      const message = await chatService.sendFileMessage(
        fileData,
        req.user.id,
        meetingId,
        roomId,
        replyToId,
      );

      res.status(201).json({
        success: true,
        message,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to upload file",
      });
    }
  },
);

/**
 * @route GET /api/chat/files/:fileName
 * @desc Serve uploaded files
 * @access Private
 */
router.get(
  "/files/:fileName",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { fileName } = req.params;

      // Security: Validate fileName to prevent directory traversal
      if (
        fileName.includes("..") ||
        fileName.includes("/") ||
        fileName.includes("\\")
      ) {
        return res.status(400).json({ error: "Invalid file name" });
      }

      const chatService = getChatService();
      const { filePath, exists } = await chatService.getFile(fileName);

      if (!exists) {
        return res.status(404).json({ error: "File not found" });
      }

      // Get file stats for proper headers
      const stats = fs.statSync(filePath);
      const ext = path.extname(fileName).toLowerCase();

      // Set appropriate content type
      let contentType = "application/octet-stream";
      const contentTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".csv": "text/csv",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".zip": "application/zip",
      };

      if (contentTypes[ext]) {
        contentType = contentTypes[ext];
      }

      // Set headers
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", stats.size);
      res.setHeader("Cache-Control", "private, max-age=3600"); // 1 hour cache

      // For images, allow inline display
      if (contentType.startsWith("image/")) {
        res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      } else {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`,
        );
      }

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({
        error: "Failed to serve file",
      });
    }
  },
);

/**
 * @route GET /api/chat/messages/:meetingId
 * @desc Get chat history for a meeting
 * @access Private
 */
router.get(
  "/messages/:meetingId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { meetingId } = req.params;
      const { page, limit, before, after } = req.query;

      const options = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        before: before as string,
        after: after as string,
      };

      const chatService = getChatService();
      const result = await chatService.getChatHistory(
        meetingId,
        req.user.id,
        options,
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Error getting chat history:", error);
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Failed to get chat history",
      });
    }
  },
);

/**
 * @route POST /api/chat/messages/:messageId/reactions
 * @desc Add or remove emoji reaction
 * @access Private
 */
router.post(
  "/messages/:messageId/reactions",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { messageId } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }

      // Validate emoji format (basic validation)
      if (emoji.length > 10) {
        return res.status(400).json({ error: "Invalid emoji" });
      }

      const chatService = getChatService();
      const message = await chatService.toggleReaction(
        messageId,
        req.user.id,
        emoji,
      );

      res.json({
        success: true,
        message,
      });
    } catch (error) {
      console.error("Error toggling reaction:", error);
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Failed to toggle reaction",
      });
    }
  },
);

/**
 * @route PUT /api/chat/messages/:messageId
 * @desc Edit a message
 * @access Private
 */
router.put(
  "/messages/:messageId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { messageId } = req.params;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      if (content.length > 2000) {
        return res
          .status(400)
          .json({ error: "Message content too long (max 2000 characters)" });
      }

      const chatService = getChatService();
      const message = await chatService.editMessage(
        messageId,
        req.user.id,
        content,
      );

      res.json({
        success: true,
        message,
      });
    } catch (error) {
      console.error("Error editing message:", error);
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Failed to edit message",
      });
    }
  },
);

/**
 * @route DELETE /api/chat/messages/:messageId
 * @desc Delete a message
 * @access Private
 */
router.delete(
  "/messages/:messageId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { messageId } = req.params;
      const { moderation } = req.query;

      const chatService = getChatService();
      await chatService.deleteMessage(
        messageId,
        req.user.id,
        moderation === "true",
      );

      res.json({
        success: true,
        message: "Message deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Failed to delete message",
      });
    }
  },
);

/**
 * @route POST /api/chat/cleanup
 * @desc Clean up old files and messages (admin only)
 * @access Private (Admin)
 */
router.post(
  "/cleanup",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user is admin
      if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { olderThanDays = 30 } = req.body;

      const chatService = getChatService();
      const result = await chatService.cleanup(olderThanDays);

      res.json({
        success: true,
        message: "Cleanup completed successfully",
        result,
      });
    } catch (error) {
      console.error("Error during cleanup:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to cleanup",
      });
    }
  },
);

export default router;
