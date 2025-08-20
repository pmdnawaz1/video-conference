import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { prisma } from "./prismaService";
import { AuthenticatedRequest } from "../types";

// File upload configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760"); // 10MB default
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "application/zip",
  "application/x-zip-compressed",
];

// Storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const clientId =
        (req as AuthenticatedRequest).user?.clientId || "default";
      const uploadPath = path.join(UPLOAD_DIR, clientId);
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      console.error("Error creating upload directory:", error);
      cb(error as Error, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    // Generate secure filename
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}_${randomString}${ext}`;
    cb(null, filename);
  },
});

// File filter for validation
const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`File type ${file.mimetype} not allowed`));
  }

  // Additional security: check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
    ".csv",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
    ".zip",
  ];

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`File extension ${ext} not allowed`));
  }

  cb(null, true);
};

// Multer configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

// File upload service class
export class FileUploadService {
  // Save file metadata to database
  static async saveFileMetadata(
    filePath: string,
    originalName: string,
    mimeType: string,
    size: number,
    uploadedBy: string,
    clientId: string,
    category: string = "general",
    meetingId?: string,
    messageId?: string,
  ) {
    try {
      const fileUrl = `/api/files/download/${path.basename(filePath)}`;

      const file = await prisma.file.create({
        data: {
          fileName: path.basename(filePath),
          originalName,
          mimeType,
          fileSize: BigInt(size),
          filePath,
          fileUrl,
          category,
          uploadedBy,
          clientId,
          meetingId,
          messageId,
        },
      });

      return file;
    } catch (error) {
      console.error("Error saving file metadata:", error);
      throw new Error("Failed to save file metadata");
    }
  }

  // Get file by ID with access validation
  static async getFile(fileId: string, userId: string, clientId: string) {
    try {
      const file = await prisma.file.findFirst({
        where: {
          id: fileId,
          clientId, // Ensure client isolation
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
      });

      if (!file) {
        throw new Error("File not found");
      }

      // Check access permissions
      const hasAccess = file.isPublic || file.uploadedBy === userId;
      if (!hasAccess) {
        throw new Error("Access denied");
      }

      return file;
    } catch (error) {
      console.error("Error getting file:", error);
      throw error;
    }
  }

  // Delete file and cleanup
  static async deleteFile(fileId: string, userId: string, clientId: string) {
    try {
      const file = await prisma.file.findFirst({
        where: {
          id: fileId,
          clientId,
        },
      });

      if (!file) {
        throw new Error("File not found");
      }

      // Check permissions (owner or admin)
      if (file.uploadedBy !== userId) {
        throw new Error("Access denied");
      }

      // Delete physical file
      if (file.filePath) {
        try {
          await fs.unlink(file.filePath);
        } catch (error) {
          console.error("Error deleting physical file:", error);
        }
      }

      // Delete from database
      await prisma.file.delete({
        where: { id: fileId },
      });

      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }

  // Get user's files with pagination
  static async getUserFiles(
    userId: string,
    clientId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      const offset = (page - 1) * limit;

      const [files, total] = await Promise.all([
        prisma.file.findMany({
          where: {
            uploadedBy: userId,
            clientId,
          },
          orderBy: {
            createdAt: "desc",
          },
          skip: offset,
          take: limit,
          select: {
            id: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            fileSize: true,
            fileUrl: true,
            category: true,
            downloadCount: true,
            createdAt: true,
          },
        }),
        prisma.file.count({
          where: {
            uploadedBy: userId,
            clientId,
          },
        }),
      ]);

      return {
        files,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error("Error getting user files:", error);
      throw error;
    }
  }

  // Update file download count
  static async incrementDownloadCount(fileId: string) {
    try {
      await prisma.file.update({
        where: { id: fileId },
        data: {
          downloadCount: {
            increment: 1,
          },
        },
      });
    } catch (error) {
      console.error("Error updating download count:", error);
    }
  }

  // Validate file before upload
  static validateFile(file: Express.Multer.File) {
    const errors: string[] = [];

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} not allowed`);
    }

    // Check filename
    if (!file.originalname || file.originalname.length > 255) {
      errors.push("Invalid filename");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Get file statistics for client
  static async getClientFileStats(clientId: string) {
    try {
      const stats = await prisma.file.groupBy({
        by: ["category"],
        where: {
          clientId,
        },
        _count: {
          id: true,
        },
        _sum: {
          fileSize: true,
        },
      });

      const totalFiles = await prisma.file.count({
        where: { clientId },
      });

      const totalSize = await prisma.file.aggregate({
        where: { clientId },
        _sum: {
          fileSize: true,
        },
      });

      return {
        totalFiles,
        totalSize: totalSize._sum.fileSize || BigInt(0),
        byCategory: stats,
      };
    } catch (error) {
      console.error("Error getting file stats:", error);
      throw error;
    }
  }
}

// File type utilities
export const getFileCategory = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("pdf")) return "document";
  if (mimeType.includes("word") || mimeType.includes("document"))
    return "document";
  if (mimeType.includes("text")) return "text";
  return "other";
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Byte";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};
