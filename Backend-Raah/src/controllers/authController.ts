import { Request, Response } from 'express';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'driver' | 'parent' | 'school' | 'admin' | 'rto';
  phone?: string;
  schoolId?: string;
  createdAt: Date;
}

// In-memory user store (acts as data store until Person 1's Prisma migrations land)
// Seeded with Kashmir Valley demo accounts for instant testing
export const userDatabase: Map<string, UserRecord> = new Map();

// Helper to pre-populate mock demo accounts
export async function seedInitialAuthUsers(): Promise<void> {
  if (userDatabase.size > 0) return;

  const defaultPasswordHash = await hashPassword('KashmirSafe2026!');

  const initialUsers: UserRecord[] = [
    {
      id: 'usr_driver_srinagar_01',
      email: 'driver1@kashmirschool.edu',
      passwordHash: defaultPasswordHash,
      name: 'Bashir Ahmad (Bus 04 Driver)',
      role: 'driver',
      phone: '+91-9419012345',
      schoolId: 'sch_dps_srinagar',
      createdAt: new Date(),
    },
    {
      id: 'usr_parent_rajbagh_02',
      email: 'parent1@kashmirschool.edu',
      passwordHash: defaultPasswordHash,
      name: 'Zahoor Wani (Parent)',
      role: 'parent',
      phone: '+91-9419054321',
      schoolId: 'sch_dps_srinagar',
      createdAt: new Date(),
    },
    {
      id: 'usr_admin_dps_03',
      email: 'admin@dpskashmir.edu',
      passwordHash: defaultPasswordHash,
      name: 'DPS Srinagar Transport Manager',
      role: 'school',
      phone: '+91-9419099999',
      schoolId: 'sch_dps_srinagar',
      createdAt: new Date(),
    },
  ];

  for (const user of initialUsers) {
    userDatabase.set(user.email.toLowerCase(), user);
  }
}

// Seed on module initialization
seedInitialAuthUsers().catch(console.error);

/**
 * POST /api/auth/register
 * Registers a new user with hashed password & returns JWT token
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, role = 'parent', phone, schoolId } = req.body;

    // 1. Validation: required fields
    if (!email || !password || !name) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'email, password, and name are required fields',
      });
      return;
    }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid email address format',
      });
      return;
    }

    // 3. Password strength (minimum 6 characters)
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Password must be at least 6 characters long',
      });
      return;
    }

    // 4. Role validation
    const validRoles = ['driver', 'parent', 'school', 'admin', 'rto'];
    if (!validRoles.includes(role.toLowerCase())) {
      res.status(400).json({
        error: 'BadRequest',
        message: `Invalid role. Allowed roles are: ${validRoles.join(', ')}`,
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 5. Duplicate email check
    if (userDatabase.has(normalizedEmail)) {
      res.status(409).json({
        error: 'Conflict',
        message: `An account with email '${email}' already exists`,
      });
      return;
    }

    // 6. Hash password via Task 2.2 helper
    const passwordHash = await hashPassword(password);

    // 7. Create user record
    const newUser: UserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      role: role.toLowerCase() as UserRecord['role'],
      phone: phone?.trim(),
      schoolId: schoolId?.trim(),
      createdAt: new Date(),
    };

    userDatabase.set(normalizedEmail, newUser);

    // 8. Generate JWT token via Task 2.2 helper
    const token = generateToken({
      userId: newUser.id,
      role: newUser.role,
      email: newUser.email,
    });

    // 9. Respond with user info (excluding password hash)
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        phone: newUser.phone,
        schoolId: newUser.schoolId,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to register user',
    });
  }
}

/**
 * POST /api/auth/login
 * Validates credentials & returns JWT token with user profile
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'email and password are required',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = userDatabase.get(normalizedEmail);

    // Prevent timing enumeration by rejecting unknown users
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
      return;
    }

    // Verify password hash
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
      return;
    }

    // Issue JWT token
    const token = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        schoolId: user.schoolId,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to process login',
    });
  }
}

/**
 * GET /api/auth/me
 * Protected profile route returning the authenticated user
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Find profile in database by email or userId
    let userProfile = req.user.email ? userDatabase.get(req.user.email.toLowerCase()) : undefined;

    if (!userProfile) {
      for (const u of userDatabase.values()) {
        if (u.id === req.user.userId) {
          userProfile = u;
          break;
        }
      }
    }

    res.status(200).json({
      status: 'success',
      user: userProfile
        ? {
            id: userProfile.id,
            email: userProfile.email,
            name: userProfile.name,
            role: userProfile.role,
            phone: userProfile.phone,
            schoolId: userProfile.schoolId,
            createdAt: userProfile.createdAt,
          }
        : {
            id: req.user.userId,
            role: req.user.role,
            email: req.user.email,
          },
    });
  } catch (error: any) {
    console.error('GetMe error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve profile',
    });
  }
}
