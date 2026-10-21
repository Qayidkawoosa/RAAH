import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { UserRole } from '@prisma/client';
import { fleetBuses } from './tripController';

/**
 * POST /api/auth/register
 * Registers a new user account into PostgreSQL & returns JWT token
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, role = 'PARENT', phone, schoolId, assignedBusNo, vehicleNo } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'email, password, and name are required fields',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid email address format',
      });
      return;
    }

    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Password must be at least 6 characters long',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check for existing user in PostgreSQL
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      res.status(409).json({
        error: 'Conflict',
        message: `An account with email '${email}' already exists`,
      });
      return;
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Map string role to Prisma enum safely
    const roleUpper = typeof role === 'string' ? role.toUpperCase() : 'PARENT';
    const upperRole: UserRole =
      roleUpper === 'SCHOOL' || roleUpper === 'ADMIN'
        ? UserRole.SCHOOL_ADMIN
        : (roleUpper as UserRole);

    const busNum = (vehicleNo || assignedBusNo || '').trim().toUpperCase();

    // 4. Ensure a school exists in database for bus tenancy
    let targetSchoolId = schoolId ? String(schoolId).trim() : null;
    if (!targetSchoolId) {
      let defaultSchool = await prisma.school.findFirst();
      if (!defaultSchool) {
        defaultSchool = await prisma.school.create({
          data: {
            name: 'Kashmir Valley School',
            address: 'Srinagar, Kashmir',
            contactEmail: 'contact@kashmirvalley.edu',
            contactPhone: '+91-194-2450000',
          },
        });
      }
      targetSchoolId = defaultSchool.id;
    }

    // 5. If this is a driver registering a bus, register the bus in PostgreSQL
    if (busNum) {
      await prisma.bus.upsert({
        where: { busNo: busNum },
        update: { schoolId: targetSchoolId },
        create: {
          busNo: busNum,
          capacity: 32,
          registrationStatus: 'Compliant',
          schoolId: targetSchoolId,
        },
      });

      // Register in memory fleet store so live trips can start immediately
      fleetBuses.set(busNum, {
        busNo: busNum,
        plateNumber: busNum,
        capacity: 32,
        schoolId: targetSchoolId,
        schoolName: 'Kashmir Valley School',
        status: 'idle',
        driverName: name.trim(),
      });
    }

    // 6. Create user record in PostgreSQL
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        role: upperRole,
        phone: phone?.trim(),
        schoolId: targetSchoolId,
        assignedBusNo: busNum || null,
      },
    });

    // 7. Generate JWT token
    const token = generateToken({
      userId: newUser.id,
      role: newUser.role.toLowerCase(),
      email: newUser.email,
    });

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully in PostgreSQL',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role.toLowerCase(),
        phone: newUser.phone,
        schoolId: newUser.schoolId,
        assignedBus: newUser.assignedBusNo,
        vehicleNo: newUser.assignedBusNo,
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
 * Validates credentials against PostgreSQL & returns JWT token
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

    // 1. Query REAL PostgreSQL Database
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { school: true, assignedBus: true },
    });

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
      return;
    }

    // 2. Verify hashed password
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
      return;
    }

    // 3. Generate JWT token
    const token = generateToken({
      userId: user.id,
      role: user.role.toLowerCase(),
      email: user.email,
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged in successfully via PostgreSQL!',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.toLowerCase(),
        phone: user.phone,
        school: user.school?.name,
        assignedBus: user.assignedBusNo,
        vehicleNo: user.assignedBusNo,
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
 * Protected profile route returning authenticated user from PostgreSQL
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

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { school: true, assignedBus: true },
    });

    if (!user) {
      res.status(404).json({
        error: 'NotFound',
        message: 'User profile not found in database',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.toLowerCase(),
        phone: user.phone,
        school: user.school?.name,
        assignedBus: user.assignedBusNo,
        vehicleNo: user.assignedBusNo,
        createdAt: user.createdAt,
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
