import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registra un nuevo usuario en el sistema
   */
  async register(registerDto: RegisterDto): Promise<{ message: string; userId: string }> {
    // Verificar si el email ya existe
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Crear el usuario
    const user = await this.usersService.create(registerDto);

    // Generar código de verificación
    const verificationCode = this.generateVerificationCode();
    await this.usersService.setVerificationCode(user.id, verificationCode);

    // TODO: Enviar email con código de verificación
    // Por ahora, lo mostramos en consola para desarrollo
    console.log(`\n========================================`);
    console.log(`CÓDIGO DE VERIFICACIÓN PARA: ${user.email}`);
    console.log(`CÓDIGO: ${verificationCode}`);
    console.log(`Este código expira en 24 horas`);
    console.log(`========================================\n`);

    return {
      message: 'Usuario registrado exitosamente. Por favor verifica tu email.',
      userId: user.id,
    };
  }

  /**
   * Autentica un usuario y retorna tokens JWT
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Validar credenciales
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar que el email esté verificado
    if (!user.emailVerified) {
      throw new UnauthorizedException('Debes verificar tu email antes de iniciar sesión');
    }

    // Generar tokens
    return this.generateTokens(user);
  }

  /**
   * Valida las credenciales de un usuario
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await this.comparePasswords(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Confirma el email del usuario con el código de verificación
   */
  async confirmEmail(confirmEmailDto: ConfirmEmailDto): Promise<{ message: string }> {
    const { email, code } = confirmEmailDto;

    // Buscar usuario
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Verificar si ya está verificado
    if (user.emailVerified) {
      throw new BadRequestException('Este email ya ha sido verificado');
    }

    // Verificar código
    if (!user.verificationCode || user.verificationCode !== code) {
      throw new BadRequestException('Código de verificación inválido');
    }

    // Verificar expiración
    if (!user.verificationCodeExpiry || new Date() > user.verificationCodeExpiry) {
      throw new BadRequestException('El código de verificación ha expirado');
    }

    // Marcar email como verificado
    await this.usersService.verifyEmail(user.id);

    return {
      message: 'Email verificado exitosamente. Ya puedes iniciar sesión.',
    };
  }

  /**
   * Reenvía el código de verificación
   */
  async resendVerificationCode(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Este email ya ha sido verificado');
    }

    // Generar nuevo código
    const verificationCode = this.generateVerificationCode();
    await this.usersService.setVerificationCode(user.id, verificationCode);

    // TODO: Enviar email con código de verificación
    console.log(`\n========================================`);
    console.log(`NUEVO CÓDIGO DE VERIFICACIÓN PARA: ${user.email}`);
    console.log(`CÓDIGO: ${verificationCode}`);
    console.log(`Este código expira en 24 horas`);
    console.log(`========================================\n`);

    return {
      message: 'Código de verificación reenviado exitosamente',
    };
  }

  /**
   * Refresca el access token usando el refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      // Verificar el refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      // Buscar usuario
      const user = await this.usersService.findOne(payload.sub);

      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      // Generar nuevo access token
      const jwtPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(jwtPayload);
      const expiresIn = Date.now() + 3600 * 1000; // 1 hora

      return {
        accessToken,
        expiresIn,
      };
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  /**
   * Genera tokens JWT (access y refresh)
   */
  private generateTokens(user: User): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiration'),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      expiresIn: Date.now() + 3600 * 1000, // 1 hora
    };
  }

  /**
   * Compara una contraseña en texto plano con su hash
   */
  private async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Genera un código de verificación de 6 dígitos
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}





