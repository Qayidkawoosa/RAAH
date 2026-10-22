import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { UserRole } from '@prisma/client';
import { fleetBuses } from './tripController';

// ── Validation constants ──────────────────────────────────────────────────────
const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX    = /^[6-9]\d{9}$/;               // 10-digit Indian mobile
const JK_PLATE_REGEX = /^JK[- ]?[0-9]{2}[- ]?[A-Z]{1,2}[- ]?[0-9]{4}$/i;
/** min 8 · 1 upper · 1 lower · 1 digit · 1 special */
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const ORG_SECRET      = 'RAASTA_ADMIN_SECRET_2026';
const PRIVILEGED_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.RTO];

/**
 * POST /api/auth/register
 * Registers a new user account into PostgreSQL & returns JWT token
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const {
      email,
      password,
      name,
      role = 'PARENT',
      phone,
      schoolId,
      assignedBusNo,
      vehicleNo,
      orgSecretKey,
    } = req.body;

    // ── Required fields ──────────────────────────────────────────────
    if (!email || !password || !name) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'email, password, and name are required fields.',
      });
      return;
    }

    // ── Name: min 3 chars, letters & spaces only ─────────────────────
    const nameClean = String(name).trim();
    if (nameClean.length < 3 || !/^[A-Za-z\s]+$/.test(nameClean)) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Name must be at least 3 characters and contain only letters.',
      });
      return;
    }

    // ── Strict email format ───────────────────────────────────────────
    if (!EMAIL_REGEX.test(String(email))) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid email address format.',
      });
      return;
    }

    // ── Password policy ───────────────────────────────────────────────
    if (typeof password !== 'string' || !PASSWORD_POLICY.test(password)) {
      res.status(400).json({
        error: 'BadRequest',
        message:
          'Password must be at least 8 characters and include at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character.',
      });
      return;
    }

    // ── Phone format (optional, but validated when provided) ──────────
    const phoneClean = String(phone || '').trim();
    if (phoneClean && !PHONE_REGEX.test(phoneClean)) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Phone number must be a valid 10-digit Indian mobile number (starting with 6–9).',
      });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // ── Duplicate: email ──────────────────────────────────────────────
    const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingByEmail) {
      res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists.' });
      return;
    }

    // ── Duplicate: phone ──────────────────────────────────────────────
    if (phoneClean) {
      const existingByPhone = await prisma.user.findFirst({ where: { phone: phoneClean } });
      if (existingByPhone) {
        res.status(409).json({ error: 'Conflict', message: 'This phone number is already registered.' });
        return;
      }
    }

    // ── Role mapping ───────────────────────────────────────────────
    const roleUpper = typeof role === 'string' ? role.toUpperCase() : 'PARENT';
    const upperRole: UserRole =
      roleUpper === 'SCHOOL' || roleUpper === 'ADMIN'
        ? UserRole.SCHOOL_ADMIN
        : (roleUpper as UserRole);

    // ── Role protection: SCHOOL_ADMIN / RTO require org secret ────────
    if (PRIVILEGED_ROLES.includes(upperRole)) {
      if (!orgSecretKey || orgSecretKey !== ORG_SECRET) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Unauthorized role registration. A valid Organization Secret Key is required.',
        });
        return;
      }
    }

    const busNum = (vehicleNo || assignedBusNo || '').trim().toUpperCase();

    // ── Driver: J&K plate format + active-driver bus conflict check ───
    if (upperRole === 'DRIVER' && busNum) {
      if (!JK_PLATE_REGEX.test(busNum)) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Vehicle registration must be a valid J&K plate (e.g. JK-01-A-1234).',
        });
        return;
      }
      const vehicleConflict = await prisma.user.findFirst({
        where: { assignedBusNo: busNum, role: UserRole.DRIVER },
      });
      if (vehicleConflict) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Vehicle already assigned to another active driver.',
        });
        return;
      }
    }

    // ── Hash password ─────────────────────────────────────────────────
    const passwordHash = await hashPassword(password);

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
    const rawIdentifier = String(req.body.email || req.body.phone || req.body.identifier || '').trim();
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Phone number/email and password are required',
      });
      return;
    }

    const normalizedEmail = rawIdentifier.toLowerCase();
    const cleanPhone = rawIdentifier.replace(/[^0-9]/g, '');

    // 1. Query REAL PostgreSQL Database: search by phone number OR email
    let user = null;

    if (cleanPhone.length >= 7) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: rawIdentifier },
            { phone: cleanPhone },
            { phone: `+91${cleanPhone.slice(-10)}` },
            { phone: cleanPhone.slice(-10) },
          ],
        },
        include: { school: true, assignedBus: true },
      });
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
        include: { school: true, assignedBus: true },
      });
    }

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid phone/email or password',
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
