import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailProvider } from '../email/email.provider';
import { NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        // getMe touches neither of these, but UserService takes them as
        // constructor deps (ConfigService for FRONTEND_URL in the invite flow).
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key: string, fallback?: unknown) => fallback) },
        },
        {
          provide: EmailProvider,
          useValue: { send: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get(PrismaService);
  });

  describe('getMe', () => {
    it('should return user and use select to exclude sensitive fields', async () => {
      const dbUser = {
        id: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'OWNER',
        tenant: { settings: { timezone: 'Africa/Lagos' } },
      };

      prisma.user.findUnique.mockResolvedValue(dbUser);

      const result = await service.getMe('user-uuid-1');

      // getMe strips the joined tenant row and flattens its timezone onto the
      // response as tenantTimezone.
      expect(result).toEqual({
        id: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'OWNER',
        tenantTimezone: 'Africa/Lagos',
      });
      expect(result).not.toHaveProperty('tenant');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('refreshToken');

      // Verify strict select clause
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-1' },
          select: expect.objectContaining({
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            tenantId: true,
          }),
        })
      );
      
      // Verify sensitive fields are NOT in select
      const callArgs = prisma.user.findUnique.mock.calls[0][0];
      expect(callArgs.select).not.toHaveProperty('passwordHash');
      expect(callArgs.select).not.toHaveProperty('refreshToken');
    });

    it('should fall back to UTC when the tenant has no timezone set', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'OWNER',
        tenant: { settings: {} },
      });

      const result = await service.getMe('user-uuid-1');

      expect(result).toHaveProperty('tenantTimezone', 'UTC');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
