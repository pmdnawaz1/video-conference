import express from "express";
import {
  authenticate,
  authorize,
  authorizeClient,
} from "../middleware/authMiddleware";
import { adminMiddleware } from "../middleware/adminMiddleware";
import { prisma } from "../services/prismaService";
import { UserRole } from "@prisma/client";
import { AuthenticatedRequest } from "../types";

const router = express.Router();

/**
 * @route GET /api/groups
 * @desc Get all groups for the client
 * @access Private (Admin)
 */
router.get(
  "/",
  authenticate,
  adminMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const groups = await prisma.group.findMany({
        where: {
          clientId: req.user.clientId,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              members: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json({
        success: true,
        groups: groups.map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          isActive: group.isActive,
          settings: group.settings,
          memberCount: group._count.members,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to fetch groups",
      });
    }
  },
);

/**
 * @route POST /api/groups
 * @desc Create a new group
 * @access Private (Admin)
 */
router.post(
  "/",
  authenticate,
  adminMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { name, description, settings } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: "Group name is required" });
      }

      // Check if group name already exists for this client
      const existingGroup = await prisma.group.findFirst({
        where: {
          name: name.trim(),
          clientId: req.user.clientId,
          isActive: true,
        },
      });

      if (existingGroup) {
        return res.status(400).json({ error: "Group name already exists" });
      }

      const group = await prisma.group.create({
        data: {
          name: name.trim(),
          description: description?.trim(),
          settings: settings || {},
          clientId: req.user.clientId,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              members: true,
            },
          },
        },
      });

      console.log(`👥 Group created: ${group.name} by ${req.user.email}`);

      res.status(201).json({
        success: true,
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          isActive: group.isActive,
          settings: group.settings,
          memberCount: group._count.members,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error creating group:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to create group",
      });
    }
  },
);

/**
 * @route GET /api/groups/:id
 * @desc Get group details
 * @access Private (Admin or Group Member)
 */
router.get("/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { id } = req.params;

    const group = await prisma.group.findFirst({
      where: {
        id,
        clientId: req.user.clientId,
        isActive: true,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatar: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user has access (admin or group member)
    const hasAdminAccess =
      req.user.role === UserRole.ADMIN ||
      req.user.role === UserRole.SUPER_ADMIN;
    const isMember = group.members.some(
      (member) => member.userId === req.user!.id,
    );

    if (!hasAdminAccess && !isMember) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        isActive: group.isActive,
        settings: group.settings,
        members: group.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          user: member.user,
        })),
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching group:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch group",
    });
  }
});

/**
 * @route PUT /api/groups/:id
 * @desc Update group
 * @access Private (Admin or Group Admin)
 */
router.put("/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { id } = req.params;
    const { name, description, settings } = req.body;

    // Check if group exists and user has access
    const group = await prisma.group.findFirst({
      where: {
        id,
        clientId: req.user.clientId,
        isActive: true,
      },
      include: {
        members: {
          where: { userId: req.user.id },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check permissions
    const hasAdminAccess =
      req.user.role === UserRole.ADMIN ||
      req.user.role === UserRole.SUPER_ADMIN;
    const isGroupAdmin = group.members.some(
      (member) => member.userId === req.user!.id && member.role === "admin",
    );

    if (!hasAdminAccess && !isGroupAdmin) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const updatedGroup = await prisma.group.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(settings && { settings }),
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    res.json({
      success: true,
      group: {
        id: updatedGroup.id,
        name: updatedGroup.name,
        description: updatedGroup.description,
        isActive: updatedGroup.isActive,
        settings: updatedGroup.settings,
        memberCount: updatedGroup._count.members,
        createdAt: updatedGroup.createdAt,
        updatedAt: updatedGroup.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating group:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update group",
    });
  }
});

/**
 * @route DELETE /api/groups/:id
 * @desc Delete group (soft delete)
 * @access Private (Admin only)
 */
router.delete(
  "/:id",
  authenticate,
  adminMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id } = req.params;

      const group = await prisma.group.findFirst({
        where: {
          id,
          clientId: req.user.clientId,
          isActive: true,
        },
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Soft delete - mark as inactive
      await prisma.group.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      console.log(`👥 Group deleted: ${group.name} by ${req.user.email}`);

      res.json({
        success: true,
        message: "Group deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to delete group",
      });
    }
  },
);

/**
 * @route GET /api/groups/:id/members
 * @desc Get group members
 * @access Private (Admin or Group Member)
 */
router.get(
  "/:id/members",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id } = req.params;

      const group = await prisma.group.findFirst({
        where: {
          id,
          clientId: req.user.clientId,
          isActive: true,
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  avatar: true,
                  role: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Check access permissions
      const hasAdminAccess =
        req.user.role === UserRole.ADMIN ||
        req.user.role === UserRole.SUPER_ADMIN;
      const isMember = group.members.some(
        (member) => member.userId === req.user!.id,
      );

      if (!hasAdminAccess && !isMember) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json({
        success: true,
        members: group.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          user: member.user,
        })),
      });
    } catch (error) {
      console.error("Error fetching group members:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch group members",
      });
    }
  },
);

/**
 * @route POST /api/groups/:id/members
 * @desc Add user to group
 * @access Private (Admin or Group Admin)
 */
router.post(
  "/:id/members",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id } = req.params;
      const { userId, role = "member" } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Validate role
      const validRoles = ["member", "admin", "moderator"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Check if group exists and user has permission
      const group = await prisma.group.findFirst({
        where: {
          id,
          clientId: req.user.clientId,
          isActive: true,
        },
        include: {
          members: {
            where: { userId: req.user.id },
          },
        },
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Check permissions
      const hasAdminAccess =
        req.user.role === UserRole.ADMIN ||
        req.user.role === UserRole.SUPER_ADMIN;
      const isGroupAdmin = group.members.some(
        (member) => member.userId === req.user!.id && member.role === "admin",
      );

      if (!hasAdminAccess && !isGroupAdmin) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Check if user exists and belongs to same client
      const targetUser = await prisma.user.findFirst({
        where: {
          id: userId,
          clientId: req.user.clientId,
          isActive: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user is already a member
      const existingMember = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId: id,
        },
      });

      if (existingMember) {
        return res
          .status(400)
          .json({ error: "User is already a member of this group" });
      }

      // Add user to group
      const member = await prisma.groupMember.create({
        data: {
          userId,
          groupId: id,
          role,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              role: true,
            },
          },
        },
      });

      console.log(
        `👥 User ${targetUser.email} added to group ${group.name} as ${role}`,
      );

      res.status(201).json({
        success: true,
        member: {
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          user: member.user,
        },
      });
    } catch (error) {
      console.error("Error adding user to group:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to add user to group",
      });
    }
  },
);

/**
 * @route DELETE /api/groups/:id/members/:userId
 * @desc Remove user from group
 * @access Private (Admin, Group Admin, or Self)
 */
router.delete(
  "/:id/members/:userId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id, userId } = req.params;

      // Check if group exists
      const group = await prisma.group.findFirst({
        where: {
          id,
          clientId: req.user.clientId,
          isActive: true,
        },
        include: {
          members: true,
        },
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Find the member to remove
      const memberToRemove = group.members.find((m) => m.userId === userId);
      if (!memberToRemove) {
        return res
          .status(404)
          .json({ error: "User is not a member of this group" });
      }

      // Check permissions
      const hasAdminAccess =
        req.user.role === UserRole.ADMIN ||
        req.user.role === UserRole.SUPER_ADMIN;
      const isGroupAdmin = group.members.some(
        (member) => member.userId === req.user!.id && member.role === "admin",
      );
      const isSelf = req.user.id === userId;

      if (!hasAdminAccess && !isGroupAdmin && !isSelf) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Remove user from group
      await prisma.groupMember.delete({
        where: {
          id: memberToRemove.id,
        },
      });

      console.log(`👥 User ${userId} removed from group ${group.name}`);

      res.json({
        success: true,
        message: "User removed from group successfully",
      });
    } catch (error) {
      console.error("Error removing user from group:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove user from group",
      });
    }
  },
);

export default router;
