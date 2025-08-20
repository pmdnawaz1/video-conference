import { PrismaClient, Recording, RecordingStatus } from "@prisma/client";
import { spawn, ChildProcess } from "child_process";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { EventEmitter } from "events";

const prisma = new PrismaClient();

export interface RecordingOptions {
  quality?: "720p" | "1080p" | "480p";
  format?: "mp4" | "webm";
  includeAudio?: boolean;
  includeVideo?: boolean;
  includeScreenShare?: boolean;
}

export interface RecordingProgress {
  recordingId: string;
  status: RecordingStatus;
  duration: number;
  fileSize?: number;
  error?: string;
}

export interface StartRecordingRequest {
  meetingId: string;
  userId: string;
  title?: string;
  options?: RecordingOptions;
}

export interface RecordingProcessInfo {
  recordingId: string;
  process: ChildProcess;
  startTime: Date;
  outputPath: string;
  status: RecordingStatus;
}

class RecordingService extends EventEmitter {
  private activeRecordings = new Map<string, RecordingProcessInfo>();
  private recordingsDir: string;
  private tempDir: string;

  constructor() {
    super();
    this.recordingsDir =
      process.env.RECORDINGS_DIR || path.join(process.cwd(), "recordings");
    this.tempDir = path.join(this.recordingsDir, "temp");
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create recording directories:", error);
      throw error;
    }
  }

  /**
   * Start recording a meeting
   */
  async startRecording(request: StartRecordingRequest): Promise<Recording> {
    const { meetingId, userId, title, options = {} } = request;

    // Validate meeting exists and user has permission
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        creator: true,
        participants: {
          include: { user: true },
        },
      },
    });

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    // Check if user is meeting creator or has admin role
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const isCreator = meeting.createdBy === userId;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const isParticipant = meeting.participants.some((p) => p.userId === userId);

    if (!isCreator && !isAdmin && !isParticipant) {
      throw new Error("Insufficient permissions to start recording");
    }

    // Check if meeting is already being recorded
    const existingRecording = await prisma.recording.findFirst({
      where: {
        meetingId,
        status: { in: ["RECORDING", "PROCESSING"] },
      },
    });

    if (existingRecording) {
      throw new Error("Meeting is already being recorded");
    }

    // Create recording record
    const recordingTitle = title || `Recording - ${meeting.title}`;
    const fileName = this.generateFileName(
      recordingTitle,
      options.format || "mp4",
    );
    const filePath = path.join(this.tempDir, fileName);

    const recording = await prisma.recording.create({
      data: {
        title: recordingTitle,
        fileName,
        filePath,
        format: options.format || "mp4",
        quality: options.quality || "720p",
        status: "RECORDING",
        startedAt: new Date(),
        meetingId,
        ownerId: userId,
        clientId: user.clientId,
      },
    });

    try {
      // Start FFmpeg recording process
      await this.startFFmpegRecording(recording.id, filePath, options);

      // Emit recording started event
      this.emit("recordingStarted", {
        recordingId: recording.id,
        meetingId,
        status: "RECORDING",
      });

      return recording;
    } catch (error) {
      // Clean up failed recording
      await prisma.recording.update({
        where: { id: recording.id },
        data: {
          status: "FAILED",
          endedAt: new Date(),
        },
      });
      throw error;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(recordingId: string, userId: string): Promise<Recording> {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        owner: true,
        meeting: true,
      },
    });

    if (!recording) {
      throw new Error("Recording not found");
    }

    if (recording.status !== "RECORDING") {
      throw new Error("Recording is not active");
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const canStop =
      recording.ownerId === userId ||
      recording.meeting.createdBy === userId ||
      user.role === "ADMIN" ||
      user.role === "SUPER_ADMIN";

    if (!canStop) {
      throw new Error("Insufficient permissions to stop recording");
    }

    // Stop FFmpeg process
    const recordingProcess = this.activeRecordings.get(recordingId);
    if (recordingProcess) {
      recordingProcess.process.kill("SIGTERM");
      this.activeRecordings.delete(recordingId);
    }

    // Update recording status
    const updatedRecording = await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: "PROCESSING",
        endedAt: new Date(),
      },
    });

    // Start post-processing
    this.processRecording(recordingId);

    this.emit("recordingStopped", {
      recordingId,
      meetingId: recording.meetingId,
      status: "PROCESSING",
    });

    return updatedRecording;
  }

  /**
   * Get recording status and metadata
   */
  async getRecording(
    recordingId: string,
    userId: string,
  ): Promise<Recording | null> {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        owner: true,
        meeting: {
          include: {
            participants: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!recording) {
      return null;
    }

    // Check access permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const hasAccess =
      recording.ownerId === userId ||
      recording.meeting.createdBy === userId ||
      recording.meeting.participants.some((p) => p.userId === userId) ||
      user.role === "ADMIN" ||
      user.role === "SUPER_ADMIN" ||
      (recording.isPublic && user.clientId === recording.clientId);

    if (!hasAccess) {
      throw new Error("Insufficient permissions to access recording");
    }

    return recording;
  }

  /**
   * Get recordings for a meeting
   */
  async getMeetingRecordings(
    meetingId: string,
    userId: string,
  ): Promise<Recording[]> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          include: { user: true },
        },
        recordings: {
          include: { owner: true },
        },
      },
    });

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user has access to meeting recordings
    const hasAccess =
      meeting.createdBy === userId ||
      meeting.participants.some((p) => p.userId === userId) ||
      user.role === "ADMIN" ||
      user.role === "SUPER_ADMIN";

    if (!hasAccess) {
      throw new Error("Insufficient permissions to access meeting recordings");
    }

    // Filter recordings based on permissions
    return meeting.recordings.filter(
      (recording) =>
        recording.ownerId === userId ||
        meeting.createdBy === userId ||
        user.role === "ADMIN" ||
        user.role === "SUPER_ADMIN" ||
        recording.isPublic,
    );
  }

  /**
   * Get user's recordings
   */
  async getUserRecordings(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Recording[]> {
    return prisma.recording.findMany({
      where: { ownerId: userId },
      include: {
        meeting: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Delete recording
   */
  async deleteRecording(recordingId: string, userId: string): Promise<void> {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: { owner: true },
    });

    if (!recording) {
      throw new Error("Recording not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check permissions
    const canDelete =
      recording.ownerId === userId ||
      user.role === "ADMIN" ||
      user.role === "SUPER_ADMIN";

    if (!canDelete) {
      throw new Error("Insufficient permissions to delete recording");
    }

    // Stop active recording if running
    if (recording.status === "RECORDING") {
      await this.stopRecording(recordingId, userId);
    }

    // Delete files
    try {
      if (recording.filePath) {
        await fs.unlink(recording.filePath);
      }
      if (recording.thumbnailUrl) {
        const thumbnailPath = recording.thumbnailUrl.replace(
          "/recordings/",
          this.recordingsDir + "/",
        );
        await fs.unlink(thumbnailPath).catch(() => {}); // Ignore errors for thumbnail
      }
    } catch (error) {
      console.warn("Failed to delete recording files:", error);
    }

    // Delete from database
    await prisma.recording.delete({
      where: { id: recordingId },
    });

    this.emit("recordingDeleted", { recordingId });
  }

  /**
   * Start FFmpeg recording process
   */
  private async startFFmpegRecording(
    recordingId: string,
    outputPath: string,
    options: RecordingOptions,
  ): Promise<void> {
    const ffmpegArgs = this.buildFFmpegArgs(outputPath, options);

    // For now, we'll use a placeholder recording (in production, this would capture actual WebRTC streams)
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    const recordingInfo: RecordingProcessInfo = {
      recordingId,
      process: ffmpeg,
      startTime: new Date(),
      outputPath,
      status: "RECORDING",
    };

    this.activeRecordings.set(recordingId, recordingInfo);

    ffmpeg.on("error", (error) => {
      console.error(`FFmpeg error for recording ${recordingId}:`, error);
      this.handleRecordingError(recordingId, error);
    });

    ffmpeg.on("exit", (code) => {
      console.log(
        `FFmpeg exited for recording ${recordingId} with code ${code}`,
      );
      this.activeRecordings.delete(recordingId);
    });

    // Emit progress updates periodically
    const progressInterval = setInterval(() => {
      if (this.activeRecordings.has(recordingId)) {
        const info = this.activeRecordings.get(recordingId)!;
        const duration = Math.floor(
          (Date.now() - info.startTime.getTime()) / 1000,
        );

        this.emit("recordingProgress", {
          recordingId,
          status: info.status,
          duration,
        } as RecordingProgress);
      } else {
        clearInterval(progressInterval);
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Build FFmpeg arguments based on recording options
   */
  private buildFFmpegArgs(
    outputPath: string,
    options: RecordingOptions,
  ): string[] {
    const args: string[] = [];

    // For demo purposes, create a test pattern video
    // In production, this would capture actual WebRTC streams
    args.push(
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=3600:size=1280x720:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=3600",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-pix_fmt",
      "yuv420p",
      "-y", // Overwrite output file
      outputPath,
    );

    return args;
  }

  /**
   * Handle recording errors
   */
  private async handleRecordingError(
    recordingId: string,
    error: Error,
  ): Promise<void> {
    try {
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          status: "FAILED",
          endedAt: new Date(),
        },
      });

      this.emit("recordingFailed", {
        recordingId,
        error: error.message,
      });
    } catch (updateError) {
      console.error("Failed to update recording status:", updateError);
    }
  }

  /**
   * Process recording after capture is complete
   */
  private async processRecording(recordingId: string): Promise<void> {
    try {
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        throw new Error("Recording not found");
      }

      // Get file stats
      const stats = await fs.stat(recording.filePath);
      const fileSize = stats.size;

      // Generate thumbnail (simplified - in production use ffmpeg)
      const thumbnailPath = await this.generateThumbnail(recording.filePath);

      // Move file from temp to permanent location
      const permanentPath = path.join(this.recordingsDir, recording.fileName);
      await fs.rename(recording.filePath, permanentPath);

      // Update recording with processed information
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          fileSize,
          filePath: permanentPath,
          fileUrl: `/recordings/${recording.fileName}`,
          thumbnailUrl: thumbnailPath
            ? `/recordings/thumbnails/${path.basename(thumbnailPath)}`
            : null,
          duration: 10, // Placeholder - would be calculated from actual video
        },
      });

      this.emit("recordingReady", {
        recordingId,
        status: "COMPLETED",
      });
    } catch (error) {
      console.error(`Failed to process recording ${recordingId}:`, error);
      await this.handleRecordingError(recordingId, error as Error);
    }
  }

  /**
   * Generate thumbnail for video
   */
  private async generateThumbnail(videoPath: string): Promise<string | null> {
    const thumbnailDir = path.join(this.recordingsDir, "thumbnails");
    await fs.mkdir(thumbnailDir, { recursive: true });

    const thumbnailFileName = `${path.parse(videoPath).name}_thumbnail.jpg`;
    const thumbnailPath = path.join(thumbnailDir, thumbnailFileName);

    return new Promise((resolve) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        videoPath,
        "-ss",
        "00:00:05", // Take screenshot at 5 seconds
        "-vframes",
        "1",
        "-vf",
        "scale=320:240",
        "-y",
        thumbnailPath,
      ]);

      ffmpeg.on("exit", (code) => {
        if (code === 0) {
          resolve(thumbnailPath);
        } else {
          console.warn("Failed to generate thumbnail");
          resolve(null);
        }
      });

      ffmpeg.on("error", (error) => {
        console.warn("Thumbnail generation error:", error);
        resolve(null);
      });
    });
  }

  /**
   * Generate unique filename for recording
   */
  private generateFileName(title: string, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const randomId = crypto.randomBytes(4).toString("hex");
    const sanitizedTitle = title
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .substring(0, 50);
    return `${sanitizedTitle}_${timestamp}_${randomId}.${format}`;
  }

  /**
   * Get recording statistics for admin dashboard
   */
  async getRecordingStats(clientId: string): Promise<any> {
    const [total, byStatus, recentActivity, storageUsage] = await Promise.all([
      // Total recordings
      prisma.recording.count({ where: { clientId } }),

      // Recordings by status
      prisma.recording.groupBy({
        by: ["status"],
        where: { clientId },
        _count: { status: true },
      }),

      // Recent recording activity (last 30 days)
      prisma.recording.count({
        where: {
          clientId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),

      // Storage usage
      prisma.recording.aggregate({
        where: { clientId, fileSize: { not: null } },
        _sum: { fileSize: true },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count.status }),
        {},
      ),
      recentActivity,
      storageUsage: storageUsage._sum.fileSize || 0,
    };
  }

  /**
   * Cleanup old recordings based on retention policy
   */
  async cleanupOldRecordings(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );

    const oldRecordings = await prisma.recording.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: "COMPLETED",
      },
    });

    let deletedCount = 0;
    for (const recording of oldRecordings) {
      try {
        await this.deleteRecording(recording.id, recording.ownerId);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete old recording ${recording.id}:`, error);
      }
    }

    return deletedCount;
  }
}

export const recordingService = new RecordingService();
export default recordingService;
