import express from "express";
import path from "path";
import fs from "fs/promises";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { AuthenticatedRequest } from "../types";
import {
  FileUploadService,
  upload,
  getFileCategory,
  formatFileSize,
} from "../services/fileUploadService";
import { prisma } from "../services/prismaService";

const router = express.Router();

// Chat file upload endpoint
router.post(
  "/chat/upload",
  authenticate,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const { roomId, meetingId } = req.body;

      // Validate file
      const validation = FileUploadService.validateFile(req.file);
      if (!validation.isValid) {
        return res.status(400).json({
          error: "File validation failed",
          details: validation.errors,
        });
      }

      // Save file metadata to database
      const category = getFileCategory(req.file.mimetype);
      const file = await FileUploadService.saveFileMetadata(
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.user.id,
        req.user.clientId,
        "chat",
        meetingId,
        undefined, // messageId will be set when chat message is created
      );

      console.log(
        `📁 File uploaded: ${req.file.originalname} by ${req.user.email}`,
      );

      res.json({
        success: true,
        fileId: file.id,
        fileUrl: file.fileUrl,
        fileName: file.originalName,
        fileSize: Number(file.fileSize),
        category,
        mimeType: file.mimeType,
      });
    } catch (error) {
      console.error("Chat file upload error:", error);
      res.status(500).json({
        error: "File upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// General file upload endpoint
router.post(
  "/upload",
  authenticate,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const { category = "general", meetingId, isPublic = false } = req.body;

      // Validate file
      const validation = FileUploadService.validateFile(req.file);
      if (!validation.isValid) {
        return res.status(400).json({
          error: "File validation failed",
          details: validation.errors,
        });
      }

      // Save file metadata to database
      const fileCategory = category || getFileCategory(req.file.mimetype);
      const file = await FileUploadService.saveFileMetadata(
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.user.id,
        req.user.clientId,
        fileCategory,
        meetingId,
      );

      // Update public status if specified
      if (isPublic === "true" || isPublic === true) {
        await prisma.file.update({
          where: { id: file.id },
          data: { isPublic: true },
        });
      }

      console.log(
        `📁 File uploaded: ${req.file.originalname} by ${req.user.email} (${fileCategory})`,
      );

      res.json({
        success: true,
        fileId: file.id,
        fileUrl: file.fileUrl,
        fileName: file.originalName,
        fileSize: Number(file.fileSize),
        category: fileCategory,
        mimeType: file.mimeType,
        isPublic: file.isPublic,
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({
        error: "File upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// File download endpoint
router.get("/download/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Find file by filename
    const file = await prisma.file.findFirst({
      where: {
        fileName: filename,
      },
    });

    if (!file || !file.filePath) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if file exists on disk
    try {
      await fs.access(file.filePath);
    } catch (error) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    // Increment download count
    FileUploadService.incrementDownloadCount(file.id);

    // Set appropriate headers
    res.set({
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.originalName}"`,
      "Cache-Control": "public, max-age=31536000", // Cache for 1 year
    });

    // Stream file
    res.sendFile(path.resolve(file.filePath));
  } catch (error) {
    console.error("File download error:", error);
    res.status(500).json({
      error: "File download failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get file information
router.get(
  "/:id/info",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id } = req.params;

      const file = await FileUploadService.getFile(
        id,
        req.user.id,
        req.user.clientId,
      );

      res.json({
        success: true,
        file: {
          id: file.id,
          fileName: file.originalName,
          mimeType: file.mimeType,
          fileSize: Number(file.fileSize),
          fileSizeFormatted: formatFileSize(Number(file.fileSize)),
          category: file.category,
          downloadCount: file.downloadCount,
          viewCount: file.viewCount,
          isPublic: file.isPublic,
          uploadedBy: file.uploader,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        },
      });
    } catch (error) {
      console.error("Get file info error:", error);
      res.status(500).json({
        error: "Failed to get file info",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Get user's files
router.get(
  "/user/files",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const result = await FileUploadService.getUserFiles(
        req.user.id,
        req.user.clientId,
        page,
        limit,
      );

      // Format file sizes for display
      const filesWithFormattedSizes = result.files.map((file) => ({
        ...file,
        fileSize: Number(file.fileSize),
        fileSizeFormatted: formatFileSize(Number(file.fileSize)),
      }));

      res.json({
        success: true,
        files: filesWithFormattedSizes,
        pagination: {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      console.error("Get user files error:", error);
      res.status(500).json({
        error: "Failed to get user files",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Delete file
router.delete("/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { id } = req.params;

    await FileUploadService.deleteFile(id, req.user.id, req.user.clientId);

    console.log(`🗑️ File deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(400).json({
      error: "Failed to delete file",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get meeting files
router.get(
  "/meeting/:meetingId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { meetingId } = req.params;

      // Verify user has access to the meeting
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: meetingId,
          clientId: req.user.clientId,
        },
        include: {
          participants: {
            where: { userId: req.user.id },
          },
        },
      });

      if (!meeting || meeting.participants.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied to meeting files" });
      }

      const files = await prisma.file.findMany({
        where: {
          meetingId,
          clientId: req.user.clientId,
        },
        include: {
          uploader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const formattedFiles = files.map((file) => ({
        ...file,
        fileSize: Number(file.fileSize),
        fileSizeFormatted: formatFileSize(Number(file.fileSize)),
      }));

      res.json({
        success: true,
        files: formattedFiles,
      });
    } catch (error) {
      console.error("Get meeting files error:", error);
      res.status(500).json({
        error: "Failed to get meeting files",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Get client file statistics (admin only)
router.get(
  "/stats/client",
  authenticate,
  authorize("ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const stats = await FileUploadService.getClientFileStats(
        req.user.clientId,
      );

      res.json({
        success: true,
        stats: {
          totalFiles: stats.totalFiles,
          totalSize: Number(stats.totalSize),
          totalSizeFormatted: formatFileSize(Number(stats.totalSize)),
          byCategory: stats.byCategory.map((cat) => ({
            category: cat.category,
            count: cat._count.id,
            size: Number(cat._sum.fileSize || 0),
            sizeFormatted: formatFileSize(Number(cat._sum.fileSize || 0)),
          })),
        },
      });
    } catch (error) {
      console.error("Get file stats error:", error);
      res.status(500).json({
        error: "Failed to get file statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
