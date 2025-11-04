import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // Registrar la entidad User en el módulo
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Exportar para que AuthModule pueda usarlo
})
export class UsersModule {}

