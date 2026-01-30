import { Repository } from 'typeorm';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { University } from '../../src/universities/entities/university.entity';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { Restaurant } from '../../src/restaurants/entities/restaurant.entity';
import { Dish, DishType } from '../../src/dishes/entities/dish.entity';
import { DishAvailability } from '../../src/dishes/entities/dish-availability.entity';
import { Topping } from '../../src/dishes/entities/topping.entity';

export interface SeededUniversities {
  universities: University[];
}

export interface SeededUsers {
  students: User[];
  restaurantOwners: User[];
  admins: User[];
}

export interface SeededRestaurants {
  restaurants: Restaurant[];
}

export interface SeededDishes {
  dishes: Dish[];
}

export interface SeededAvailability {
  availabilities: DishAvailability[];
}

/**
 * Crea universidades de prueba
 */
export async function seedUniversities(
  module: TestingModule,
  count: number = 3,
): Promise<SeededUniversities> {
  const universityRepository = module.get<Repository<University>>(getRepositoryToken(University));
  const timestamp = Date.now();

  const universities = [];
  const cities = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena'];

  for (let i = 0; i < count; i++) {
    const university = universityRepository.create({
      nombre: `Universidad de Prueba ${timestamp}-${i}`,
      ciudad: cities[i % cities.length],
    });
    universities.push(await universityRepository.save(university));
  }

  return { universities };
}

/**
 * Crea usuarios de prueba
 */
export async function seedUsers(
  module: TestingModule,
  options: {
    studentsCount?: number;
    restaurantOwnersCount?: number;
    adminsCount?: number;
  } = {},
): Promise<SeededUsers> {
  const userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  const timestamp = Date.now();

  const students = [];
  const restaurantOwners = [];
  const admins = [];

  const studentsCount = options.studentsCount || 5;
  const restaurantOwnersCount = options.restaurantOwnersCount || 3;
  const adminsCount = options.adminsCount || 1;

  // Crear estudiantes
  for (let i = 0; i < studentsCount; i++) {
    const user = userRepository.create({
      email: `student-${timestamp}-${i}@test.com`,
      password: '$2b$10$TestPasswordHash12345678901234567890', // Hash de 'Test123456!'
      nombre: `Estudiante ${i + 1}`,
      role: UserRole.STUDENT,
      emailVerified: true,
    });
    students.push(await userRepository.save(user));
  }

  // Crear restaurante owners
  for (let i = 0; i < restaurantOwnersCount; i++) {
    const user = userRepository.create({
      email: `owner-${timestamp}-${i}@test.com`,
      password: '$2b$10$TestPasswordHash12345678901234567890',
      nombre: `Restaurante Owner ${i + 1}`,
      role: UserRole.RESTAURANT_OWNER,
      emailVerified: true,
    });
    restaurantOwners.push(await userRepository.save(user));
  }

  // Crear admins
  for (let i = 0; i < adminsCount; i++) {
    const user = userRepository.create({
      email: `admin-${timestamp}-${i}@test.com`,
      password: '$2b$10$TestPasswordHash12345678901234567890',
      nombre: `Admin ${i + 1}`,
      role: UserRole.ADMIN,
      emailVerified: true,
    });
    admins.push(await userRepository.save(user));
  }

  return { students, restaurantOwners, admins };
}

/**
 * Crea restaurantes de prueba
 */
export async function seedRestaurants(
  module: TestingModule,
  universityIds: string[],
  ownerIds: string[],
  countPerUniversity: number = 2,
): Promise<SeededRestaurants> {
  const restaurantRepository = module.get<Repository<Restaurant>>(getRepositoryToken(Restaurant));
  const timestamp = Date.now();

  const restaurants = [];
  const restaurantNames = [
    'Pizza Express',
    'Burger House',
    'Sushi Master',
    'Taco Loco',
    'Pasta Paradise',
    'Chicken King',
    'Salad Bar',
    'Coffee Shop',
  ];
  const categories = [
    ['Pizza', 'Italiana'],
    ['Hamburguesas', 'Americana'],
    ['Sushi', 'Japonesa'],
    ['Mexicana', 'Tacos'],
    ['Pasta', 'Italiana'],
    ['Pollo', 'Rápida'],
    ['Ensaladas', 'Saludable'],
    ['Café', 'Bebidas'],
  ];

  let ownerIndex = 0;

  for (const universityId of universityIds) {
    for (let i = 0; i < countPerUniversity && ownerIndex < ownerIds.length; i++) {
      const nameIndex = (restaurants.length + timestamp) % restaurantNames.length;
      const restaurant = restaurantRepository.create({
        nombre: `${restaurantNames[nameIndex]} ${timestamp}-${restaurants.length}`,
        universityId,
        ownerId: ownerIds[ownerIndex],
        categorias: categories[nameIndex],
        calificacion: 4.0 + Math.random() * 1.0, // Entre 4.0 y 5.0
        tiempoEntrega: 15 + Math.floor(Math.random() * 20), // Entre 15 y 35 minutos
        activo: true,
      });
      restaurants.push(await restaurantRepository.save(restaurant));
      ownerIndex++;
    }
  }

  return { restaurants };
}

/**
 * Crea platos de prueba
 */
export async function seedDishes(
  module: TestingModule,
  restaurantIds: string[],
  dishesPerRestaurant: number = 5,
): Promise<SeededDishes> {
  const dishRepository = module.get<Repository<Dish>>(getRepositoryToken(Dish));
  const toppingRepository = module.get<Repository<Topping>>(getRepositoryToken(Topping));
  const timestamp = Date.now();

  const dishes = [];
  const dishTemplates = [
    {
      nombre: 'Pizza Margarita',
      descripcion: 'Pizza con queso mozzarella y tomate',
      precio: 15000,
      categoria: 'Pizza',
      tipoPlato: DishType.SIMPLE,
      toppings: [],
    },
    {
      nombre: 'Pizza Personalizable',
      descripcion: 'Pizza que puedes personalizar',
      precio: 18000,
      categoria: 'Pizza',
      tipoPlato: DishType.PERSONALIZABLE,
      toppings: [
        { nombre: 'Queso extra', precio: 2000, removible: false, categoria: 'Quesos' },
        { nombre: 'Pepperoni', precio: 3000, removible: true, categoria: 'Carnes' },
        { nombre: 'Champiñones', precio: 1500, removible: true, categoria: 'Vegetales' },
      ],
    },
    {
      nombre: 'Hamburguesa Clásica',
      descripcion: 'Hamburguesa con carne, lechuga, tomate y queso',
      precio: 12000,
      categoria: 'Hamburguesas',
      tipoPlato: DishType.FIJO,
      toppings: [],
    },
    {
      nombre: 'Hamburguesa Mixta',
      descripcion: 'Hamburguesa con opciones de ingredientes',
      precio: 15000,
      categoria: 'Hamburguesas',
      tipoPlato: DishType.MIXTO,
      toppings: [
        { nombre: 'Queso cheddar', precio: 2000, removible: true, categoria: 'Quesos' },
        { nombre: 'Bacon', precio: 3000, removible: true, categoria: 'Carnes' },
        { nombre: 'Cebolla caramelizada', precio: 1500, removible: true, categoria: 'Vegetales' },
      ],
    },
    {
      nombre: 'Combo Personalizable',
      descripcion: 'Combo que puedes personalizar completamente',
      precio: 20000,
      categoria: 'Combos',
      tipoPlato: DishType.PERSONALIZABLE,
      toppings: [
        { nombre: 'Bebida grande', precio: 3000, removible: true, categoria: 'Bebidas' },
        { nombre: 'Papas grandes', precio: 4000, removible: true, categoria: 'Acompañamientos' },
      ],
    },
  ];

  for (const restaurantId of restaurantIds) {
    for (let i = 0; i < dishesPerRestaurant; i++) {
      const template = dishTemplates[i % dishTemplates.length];
      const dish = dishRepository.create({
        nombre: `${template.nombre} ${timestamp}-${dishes.length}`,
        descripcion: template.descripcion,
        precio: template.precio,
        categoria: template.categoria,
        tipoPlato: template.tipoPlato,
        restaurantId,
        activo: true,
      });

      const savedDish = await dishRepository.save(dish);

      // Crear toppings si el plato los requiere
      if (template.toppings && template.toppings.length > 0) {
        const toppings = template.toppings.map((topping) =>
          toppingRepository.create({
            nombre: topping.nombre,
            precio: topping.precio,
            removible: topping.removible,
            categoria: topping.categoria,
            dishId: savedDish.id,
          }),
        );
        await toppingRepository.save(toppings);
      }

      dishes.push(savedDish);
    }
  }

  return { dishes };
}

/**
 * Crea disponibilidad para platos
 */
export async function seedAvailability(
  module: TestingModule,
  dishIds: string[],
  restaurantIds: string[],
  availablePercentage: number = 0.8, // 80% disponible por defecto
): Promise<SeededAvailability> {
  const availabilityRepository = module.get<Repository<DishAvailability>>(
    getRepositoryToken(DishAvailability),
  );

  const availabilities = [];

  // Asociar cada plato con su restaurante y crear disponibilidad
  const dishRepository = module.get<Repository<Dish>>(getRepositoryToken(Dish));
  for (const dishId of dishIds) {
    const dish = await dishRepository.findOne({ where: { id: dishId } });
    if (!dish) continue;

    const restaurantId = dish.restaurantId;
    const disponible = Math.random() < availablePercentage;

    const availability = availabilityRepository.create({
      dishId,
      restaurantId,
      disponible,
    });

    availabilities.push(await availabilityRepository.save(availability));
  }

  return { availabilities };
}
