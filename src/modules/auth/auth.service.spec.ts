import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { EmailProvider } from '../email/email.provider';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any; // Using any to allow easy mocking of deep properties

  const mockUser = {
    id: 'user-uuid-1',
    tenantId: 'tenant-uuid-1',
    email: 'test@example.com',
    refreshToken: null as string | null,
    role: 'OWNER',
    passwordHash: 'some-hash',
  };

  beforeEach(async () => {
    const hashedToken = await bcrypt.hash('valid-refresh-token', 10);
    mockUser.refreshToken = hashedToken;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue(mockUser),
              findFirst: jest.fn().mockResolvedValue(mockUser),
              update: jest.fn().mockResolvedValue(mockUser),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('new-access-token'),
            verifyAsync: jest.fn().mockResolvedValue({
              sub: mockUser.id,
              tenantId: mockUser.tenantId,
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
            getOrThrow: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: EmailProvider,
          useValue: {
            sendWelcome: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
  });

  describe('refreshTokens', () => {
    it('should issue new tokens when refresh token is valid', async () => {
      const result = await service.refreshTokens(
        mockUser.id,
        'valid-refresh-token'
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
        })
      );
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      await expect(
        service.refreshTokens(mockUser.id, 'wrong-token')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no stored token', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        refreshToken: null,
      });
      await expect(
        service.refreshTokens(mockUser.id, 'any-token')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.refreshTokens(mockUser.id, 'any-token')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const hashedPw = await bcrypt.hash('ValidPass1!', 12);
      prisma.user.findFirst.mockResolvedValueOnce({
        ...mockUser,
        passwordHash: hashedPw,
      });
      const result = await service.login({
        email: 'test@example.com',
        password: 'ValidPass1!',
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw for wrong password', async () => {
      const hashedPw = await bcrypt.hash('ValidPass1!', 12);
      prisma.user.findFirst.mockResolvedValueOnce({
        ...mockUser,
        passwordHash: hashedPw,
      });
      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPass1!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for non-existent email', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.login({
          email: 'nobody@example.com',
          password: 'ValidPass1!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should not reveal whether email or password was wrong', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      let errorMessage = '';
      try {
        await service.login({
          email: 'nobody@example.com',
          password: 'ValidPass1!',
        });
      } catch (err: any) {
        errorMessage = err.message;
      }
      // Depending on implementation, it might say "Invalid credentials"
      expect(errorMessage.toLowerCase()).toContain('invalid credentials');
    });
  });

  describe('logout', () => {
    it('should clear refresh token', async () => {
      await service.logout(mockUser.id);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshToken: null },
      });
    });
  });
});
