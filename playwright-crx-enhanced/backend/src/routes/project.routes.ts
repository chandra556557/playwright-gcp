import { Router } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import pool from '../db';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Get all projects for authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let result;
    try {
      result = await pool.query(
        'SELECT id, name, description, "createdAt", "updatedAt" FROM "Project" WHERE "userId" = $1 ORDER BY "createdAt" DESC',
        [userId]
      );
    } catch (_err) {
      // Fallback if case-sensitive table name differs
      result = await pool.query(
        'SELECT id, name, description, createdAt, updatedAt FROM project WHERE userId = $1 ORDER BY createdAt DESC',
        [userId]
      );
    }

    const projects = result.rows;
    logger.info(`Retrieved ${projects.length} projects for user ${userId}`);
    res.json({ data: projects });
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create a new project
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    const id = randomUUID();

    let result;
    try {
      result = await pool.query(
        'INSERT INTO "Project"(id, name, description, "userId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,now(),now()) RETURNING id, name, description, "createdAt", "updatedAt"',
        [id, name.trim(), description || null, userId]
      );
    } catch (_err) {
      result = await pool.query(
        'INSERT INTO project(id, name, description, userId, createdAt, updatedAt) VALUES ($1,$2,$3,$4,now(),now()) RETURNING id, name, description, createdAt, updatedAt',
        [id, name.trim(), description || null, userId]
      );
    }

    const project = result.rows[0];
    logger.info(`Created project ${project.id} for user ${userId}`);
    res.status(201).json({ data: project });
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get a specific project
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    let result;
    try {
      result = await pool.query(
        'SELECT id, name, description, "createdAt", "updatedAt" FROM "Project" WHERE id = $1 AND "userId" = $2',
        [id, userId]
      );
    } catch (_err) {
      result = await pool.query(
        'SELECT id, name, description, createdAt, updatedAt FROM project WHERE id = $1 AND userId = $2',
        [id, userId]
      );
    }

    const project = result.rows[0];
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    logger.info(`Retrieved project: ${project.id}`);
    res.json({ data: project });
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Update a project
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { name, description } = req.body;

    let result;
    try {
      result = await pool.query(
        'UPDATE "Project" SET name = $1, description = $2, "updatedAt" = now() WHERE id = $3 AND "userId" = $4 RETURNING id, name, description, "createdAt", "updatedAt"',
        [name, description || null, id, userId]
      );
    } catch (_err) {
      result = await pool.query(
        'UPDATE project SET name = $1, description = $2, updatedAt = now() WHERE id = $3 AND userId = $4 RETURNING id, name, description, createdAt, updatedAt',
        [name, description || null, id, userId]
      );
    }

    const project = result.rows[0];
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    logger.info(`Updated project: ${project.id}`);
    res.json({ data: project });
  } catch (error) {
    logger.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete a project
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    let result;
    try {
      result = await pool.query(
        'DELETE FROM "Project" WHERE id = $1 AND "userId" = $2 RETURNING id',
        [id, userId]
      );
    } catch (_err) {
      result = await pool.query(
        'DELETE FROM project WHERE id = $1 AND userId = $2 RETURNING id',
        [id, userId]
      );
    }

    if (!result.rowCount) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    logger.info(`Deleted project with id: ${id}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
