import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserRole } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let winstonLogger: jest.Mocked<WinstonLogger>;

  const mockUser: User = {
    id: 'user_123',
    email: 'test@example.com',
    password: '$2b$10$hashedPassword1234567890123456789012345678901234567890123456789012',
    nombre: 'Test User',
    role: UserRole.STUDENT,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockUserUnverified: User = {
    ...mockUser,
    emailVerified: false,
    verificationCode: '123456',
    verificationCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas desde ahora
  } as User;

  const mockRegisterDto: RegisterDto = {
    email: 'newuser@example.com',
    password: 'Password123!',
    nombre: 'New User',
    role: UserRole.STUDENT,
  };

  const mockLoginDto: LoginDto = {
    email: 'test@example.com',
    password: 'Password123!',
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      setVerificationCode: jest.fn(),
      verifyEmail: jest.fn(),
      findOne: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockWinstonLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockWinstonLogger,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    winstonLogger = module.get(WINSTON_MODULE_PROVIDER);

    // Configurar valores por defecto para ConfigService
    configService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        'jwt.expiration': '1h',
        'jwt.refreshSecret': 'refresh-secret',
        'jwt.refreshExpiration': '7d',
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('debe registrar un usuario nuevo exitosamente', async () => {
      // Arrange
      const newUser: User = {
        ...mockUser,
        id: 'new_user_123',
        email: mockRegisterDto.email,
        nombre: mockRegisterDto.nombre,
        emailVerified: false,
      } as User;

      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(newUser);
      usersService.setVerificationCode.mockResolvedValue(undefined);

      // Act
      const result = await service.register(mockRegisterDto);

      // Assert
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('userId', newUser.id);
      expect(result.message).toContain('registrado exitosamente');
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockRegisterDto.email);
      expect(usersService.create).toHaveBeenCalledWith(mockRegisterDto);
      expect(usersService.setVerificationCode).toHaveBeenCalledWith(
        newUser.id,
        expect.any(String),
      );
      expect(usersService.setVerificationCode).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ConflictException cuando el email ya está registrado', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(mockRegisterDto)).rejects.toThrow(ConflictException);
      await expect(service.register(mockRegisterDto)).rejects.toThrow('El email ya está registrado');
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockRegisterDto.email);
      expect(usersService.create).not.toHaveBeenCalled();
      expect(usersService.setVerificationCode).not.toHaveBeenCalled();
    });

    it('debe generar un código de verificación de 6 dígitos', async () => {
      // Arrange
      const newUser: User = {
        ...mockUser,
        id: 'new_user_123',
        email: mockRegisterDto.email,
      } as User;

      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(newUser);
      usersService.setVerificationCode.mockImplementation((id, code) => {
        expect(code).toMatch(/^\d{6}$/);
        return Promise.resolve(undefined);
      });

      // Act
      await service.register(mockRegisterDto);

      // Assert
      expect(usersService.setVerificationCode).toHaveBeenCalledWith(
        newUser.id,
        expect.stringMatching(/^\d{6}$/),
      );
    });
  });

  describe('validateUser', () => {
    it('debe retornar el usuario cuando las credenciales son correctas', async () => {
      // Arrange
      const plainPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const userWithHashedPassword: User = {
        ...mockUser,
        password: hashedPassword,
      } as User;

      usersService.findByEmail.mockResolvedValue(userWithHashedPassword);

      // Act
      const result = await service.validateUser(mockLoginDto.email, plainPassword);

      // Assert
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('id', mockUser.id);
      expect(result).toHaveProperty('email', mockUser.email);
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockLoginDto.email);
    });

    it('debe retornar null cuando el email no existe', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act
      const result = await service.validateUser('nonexistent@example.com', 'Password123!');

      // Assert
      expect(result).toBeNull();
      expect(usersService.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
    });

    it('debe retornar null cuando la contraseña es incorrecta', async () => {
      // Arrange
      const correctPassword = 'Password123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await bcrypt.hash(correctPassword, 10);
      const userWithHashedPassword: User = {
        ...mockUser,
        password: hashedPassword,
      } as User;

      usersService.findByEmail.mockResolvedValue(userWithHashedPassword);

      // Act
      const result = await service.validateUser(mockLoginDto.email, wrongPassword);

      // Assert
      expect(result).toBeNull();
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockLoginDto.email);
    });
  });

  describe('login', () => {
    it('debe retornar tokens válidos cuando las credenciales son correctas y el email está verificado', async () => {
      // Arrange
      const plainPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const verifiedUser: User = {
        ...mockUser,
        password: hashedPassword,
        emailVerified: true,
      } as User;

      const mockAccessToken = 'access-token-123';
      const mockRefreshToken = 'refresh-token-123';

      usersService.findByEmail.mockResolvedValue(verifiedUser);
      jwtService.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      // Act
      const result = await service.login({
        email: verifiedUser.email,
        password: plainPassword,
      });

      // Assert
      expect(result).toHaveProperty('accessToken', mockAccessToken);
      expect(result).toHaveProperty('refreshToken', mockRefreshToken);
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id', verifiedUser.id);
      expect(result.user).toHaveProperty('email', verifiedUser.email);
      expect(result.user).toHaveProperty('nombre', verifiedUser.nombre);
      expect(result.user).toHaveProperty('role', verifiedUser.role);
      expect(result.user).toHaveProperty('emailVerified', true);
      expect(result).toHaveProperty('expiresIn');
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('debe lanzar UnauthorizedException cuando las credenciales son inválidas', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(mockLoginDto)).rejects.toThrow('Credenciales inválidas');
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockLoginDto.email);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('debe lanzar UnauthorizedException cuando el email no está verificado', async () => {
      // Arrange
      const plainPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const unverifiedUser: User = {
        ...mockUserUnverified,
        password: hashedPassword,
      } as User;

      usersService.findByEmail.mockResolvedValue(unverifiedUser);

      // Act & Assert
      await expect(
        service.login({
          email: unverifiedUser.email,
          password: plainPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login({
          email: unverifiedUser.email,
          password: plainPassword,
        }),
      ).rejects.toThrow('Debes verificar tu email antes de iniciar sesión');
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('debe generar tokens con el payload correcto', async () => {
      // Arrange
      const plainPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const verifiedUser: User = {
        ...mockUser,
        password: hashedPassword,
        emailVerified: true,
      } as User;

      usersService.findByEmail.mockResolvedValue(verifiedUser);
      jwtService.sign.mockReturnValue('token');

      // Act
      await service.login({
        email: verifiedUser.email,
        password: plainPassword,
      });

      // Assert
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: verifiedUser.id,
          email: verifiedUser.email,
          role: verifiedUser.role,
        },
        {
          expiresIn: '1h',
        },
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: verifiedUser.id,
          email: verifiedUser.email,
          role: verifiedUser.role,
        },
        {
          secret: 'refresh-secret',
          expiresIn: '7d',
        },
      );
    });
  });

  describe('comparePasswords', () => {
    it('debe comparar correctamente contraseñas usando bcrypt', async () => {
      // Arrange
      const plainPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // Act - Usamos validateUser que internamente usa comparePasswords
      const userWithHashedPassword: User = {
        ...mockUser,
        password: hashedPassword,
      } as User;

      usersService.findByEmail.mockResolvedValue(userWithHashedPassword);

      const result = await service.validateUser(mockUser.email, plainPassword);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockUser.id);
    });

    it('debe retornar false cuando la contraseña no coincide', async () => {
      // Arrange
      const correctPassword = 'Password123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await bcrypt.hash(correctPassword, 10);

      const userWithHashedPassword: User = {
        ...mockUser,
        password: hashedPassword,
      } as User;

      usersService.findByEmail.mockResolvedValue(userWithHashedPassword);

      // Act
      const result = await service.validateUser(mockUser.email, wrongPassword);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('confirmEmail', () => {
    it('debe confirmar el email con código válido', async () => {
      // Arrange
      const code = '123456';
      const userWithCode: User = {
        ...mockUserUnverified,
        verificationCode: code,
        verificationCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as User;

      usersService.findByEmail.mockResolvedValue(userWithCode);
      usersService.verifyEmail.mockResolvedValue(undefined);

      // Act
      const result = await service.confirmEmail({
        email: userWithCode.email,
        code,
      });

      // Assert
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Email verificado exitosamente');
      expect(usersService.findByEmail).toHaveBeenCalledWith(userWithCode.email);
      expect(usersService.verifyEmail).toHaveBeenCalledWith(userWithCode.id);
    });

    it('debe lanzar BadRequestException cuando el usuario no existe', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.confirmEmail({
          email: 'nonexistent@example.com',
          code: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmEmail({
          email: 'nonexistent@example.com',
          code: '123456',
        }),
      ).rejects.toThrow('Usuario no encontrado');
      expect(usersService.verifyEmail).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException cuando el código es incorrecto', async () => {
      // Arrange
      const correctCode = '123456';
      const wrongCode = '654321';
      const userWithCode: User = {
        ...mockUserUnverified,
        verificationCode: correctCode,
        verificationCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as User;

      usersService.findByEmail.mockResolvedValue(userWithCode);

      // Act & Assert
      await expect(
        service.confirmEmail({
          email: userWithCode.email,
          code: wrongCode,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmEmail({
          email: userWithCode.email,
          code: wrongCode,
        }),
      ).rejects.toThrow('Código de verificación inválido');
      expect(usersService.verifyEmail).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException cuando el código ha expirado', async () => {
      // Arrange
      const code = '123456';
      const expiredUser: User = {
        ...mockUserUnverified,
        verificationCode: code,
        verificationCodeExpiry: new Date(Date.now() - 1000), // Expirado
      } as User;

      usersService.findByEmail.mockResolvedValue(expiredUser);

      // Act & Assert
      await expect(
        service.confirmEmail({
          email: expiredUser.email,
          code,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmEmail({
          email: expiredUser.email,
          code,
        }),
      ).rejects.toThrow('El código de verificación ha expirado');
      expect(usersService.verifyEmail).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException cuando el email ya está verificado', async () => {
      // Arrange
      const code = '123456';
      const verifiedUser: User = {
        ...mockUser,
        emailVerified: true,
      } as User;

      usersService.findByEmail.mockResolvedValue(verifiedUser);

      // Act & Assert
      await expect(
        service.confirmEmail({
          email: verifiedUser.email,
          code,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmEmail({
          email: verifiedUser.email,
          code,
        }),
      ).rejects.toThrow('Este email ya ha sido verificado');
      expect(usersService.verifyEmail).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException cuando no hay código de verificación', async () => {
      // Arrange
      const code = '123456';
      const userWithoutCode: User = {
        ...mockUserUnverified,
        verificationCode: null,
      } as User;

      usersService.findByEmail.mockResolvedValue(userWithoutCode);

      // Act & Assert
      await expect(
        service.confirmEmail({
          email: userWithoutCode.email,
          code,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmEmail({
          email: userWithoutCode.email,
          code,
        }),
      ).rejects.toThrow('Código de verificación inválido');
      expect(usersService.verifyEmail).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException cuando los códigos tienen diferente longitud', async () => {
      // Arrange
      const shortCode = '12345'; // 5 dígitos
      const longCode = '123456'; // 6 dígitos
      const userWithCode: User = {
        ...mockUserUnverified,
        verificationCode: longCode,
        verificationCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as User;

      usersService.findByEmail.mockResolvedValue(userWithCode);

      // Act & Assert
      await expect(
        service.confirmEmail({
          email: userWithCode.email,
          code: shortCode,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmEmail({
          email: userWithCode.email,
          code: shortCode,
        }),
      ).rejects.toThrow('Código de verificación inválido');
      expect(usersService.verifyEmail).not.toHaveBeenCalled();
    });
  });

  describe('resendVerificationCode', () => {
    it('debe reenviar el código de verificación exitosamente', async () => {
      // Arrange
      const userToResend: User = {
        ...mockUserUnverified,
      } as User;

      usersService.findByEmail.mockResolvedValue(userToResend);
      usersService.setVerificationCode.mockResolvedValue(undefined);

      // Act
      const result = await service.resendVerificationCode(userToResend.email);

      // Assert
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Código de verificación reenviado exitosamente');
      expect(usersService.findByEmail).toHaveBeenCalledWith(userToResend.email);
      expect(usersService.setVerificationCode).toHaveBeenCalledWith(
        userToResend.id,
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('debe lanzar BadRequestException cuando el usuario no existe', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.resendVerificationCode('nonexistent@example.com')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resendVerificationCode('nonexistent@example.com')).rejects.toThrow(
        'Usuario no encontrado',
      );
      expect(usersService.setVerificationCode).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException cuando el email ya está verificado', async () => {
      // Arrange
      const verifiedUser: User = {
        ...mockUser,
        emailVerified: true,
      } as User;

      usersService.findByEmail.mockResolvedValue(verifiedUser);

      // Act & Assert
      await expect(service.resendVerificationCode(verifiedUser.email)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resendVerificationCode(verifiedUser.email)).rejects.toThrow(
        'Este email ya ha sido verificado',
      );
      expect(usersService.setVerificationCode).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('debe generar un nuevo access token con refresh token válido', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const newAccessToken = 'new-access-token';
      const mockPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      };

      jwtService.verify.mockReturnValue(mockPayload as any);
      usersService.findOne.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue(newAccessToken);

      // Act
      const result = await service.refreshToken(refreshToken);

      // Assert
      expect(result).toHaveProperty('accessToken', newAccessToken);
      expect(result).toHaveProperty('expiresIn');
      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'refresh-secret',
      });
      expect(usersService.findOne).toHaveBeenCalledWith(mockUser.id);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('debe lanzar UnauthorizedException cuando el refresh token es inválido', async () => {
      // Arrange
      const invalidToken = 'invalid-refresh-token';
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(service.refreshToken(invalidToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(invalidToken)).rejects.toThrow(
        'Refresh token inválido o expirado',
      );
      expect(usersService.findOne).not.toHaveBeenCalled();
    });

    it('debe lanzar UnauthorizedException cuando el usuario no existe', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const mockPayload = {
        sub: 'non-existent-user-id',
        email: 'test@example.com',
        role: UserRole.STUDENT,
      };

      jwtService.verify.mockReturnValue(mockPayload as any);
      usersService.findOne.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException cuando findOne retorna NotFoundException', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const mockPayload = {
        sub: 'non-existent-user-id',
        email: 'test@example.com',
        role: UserRole.STUDENT,
      };

      jwtService.verify.mockReturnValue(mockPayload as any);
      const { NotFoundException } = await import('@nestjs/common');
      usersService.findOne.mockRejectedValue(new NotFoundException('Usuario no encontrado'));

      // Act & Assert
      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });
});
