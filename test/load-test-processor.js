/**
 * Processor para Artillery Load Testing
 * 
 * Este archivo contiene funciones helper para los escenarios de prueba
 */

// IDs de prueba (deben existir en la base de datos)
// En producción, estos deberían obtenerse dinámicamente
const TEST_IDS = {
  universityId: process.env.TEST_UNIVERSITY_ID || 'test-university-id',
  restaurantId: process.env.TEST_RESTAURANT_ID || 'test-restaurant-id',
  dishId: process.env.TEST_DISH_ID || 'test-dish-id',
  testUserEmail: process.env.TEST_USER_EMAIL || 'test@example.com',
  testUserPassword: process.env.TEST_USER_PASSWORD || 'testpassword123',
};

module.exports = {
  /**
   * Establecer ID de universidad para las pruebas
   */
  setUniversityId: (context, events, done) => {
    context.vars.universityId = TEST_IDS.universityId;
    return done();
  },

  /**
   * Establecer ID de restaurante para las pruebas
   */
  setRestaurantId: (context, events, done) => {
    context.vars.restaurantId = TEST_IDS.restaurantId;
    return done();
  },

  /**
   * Establecer ID de plato para las pruebas
   */
  setDishId: (context, events, done) => {
    context.vars.dishId = TEST_IDS.dishId;
    return done();
  },

  /**
   * Login y obtener token (para pruebas autenticadas)
   * Nota: Requiere que exista un usuario de prueba
   */
  login: async (context, events, done) => {
    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: TEST_IDS.testUserEmail,
          password: TEST_IDS.testUserPassword,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        context.vars.token = data.data?.accessToken || data.accessToken;
      }
    } catch (error) {
      // Si falla el login, continuar sin token (algunos tests seguirán funcionando)
      console.error('Error en login:', error.message);
    }

    return done();
  },
};

