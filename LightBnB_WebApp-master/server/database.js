const propertiesJSON = require('./json/properties.json');
const usersJSON = require('./json/users.json');

/// Connect to the database using PostgreSQL

const { Pool } = require('pg');

const pool = new Pool({
  user: 'vagrant',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});


/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
// const getUserWithEmail = function(email) {
//   let user;
//   for (const userId in usersJSON) {
//     user = usersJSON[userId];
//     if (user.email.toLowerCase() === email.toLowerCase()) {
//       break;
//     } else {
//       user = null;
//     }
//   }
//   return Promise.resolve(user);
// }

const getUserWithEmail = function(email) {

  return pool
    .query(`SELECT * FROM users WHERE email = $1;`,[email])
    .then((result) => {
      const user = result.rows[0]
      if (!user) {
        return null;
      }
      console.log(user);
      return user;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
// const getUserWithId = function(id) {
//   return Promise.resolve(users[id]);
// }

const getUserWithId = function(id) {

  return pool
    .query(`SELECT * FROM users WHERE id = $1;`,[id])
    .then((result) => {
      const user = result.rows[0]
      if (!user) {
        return null;
      }
      console.log(user);
      return user;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

exports.getUserWithId = getUserWithId;


/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
// const addUser =  function(user) {
//   const userId = Object.keys(users).length + 1;
//   user.id = userId;
//   users[userId] = user;
//   return Promise.resolve(user);
// }

const addUser = function(user) {

  return pool
    .query(`
      INSERT INTO users (name, email, password)
      VALUES ($1, $2, $3)
      RETURNING *;`,
      [user.name, user.email, user.password])
    .then((result) => {
      const user = result.rows[0];
      console.log(user);
      return user;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
// const getAllReservations = function(guest_id, limit = 10) {
//   return getAllProperties(null, 2);
// }

const getAllReservations = function(guest_id, limit = 10) {

  return pool
    .query(`
      SELECT reservations.id, properties.*, start_date, end_date, AVG(rating) AS average_rating
      FROM reservations
      JOIN properties ON properties.id = reservations.property_id
      JOIN property_reviews ON properties.id = property_reviews.property_id
      WHERE reservations.guest_id = $1
      GROUP BY reservations.id, properties.id, properties.title, cost_per_night
      ORDER BY start_date DESC
      LIMIT $2;`,
      [guest_id, limit])
    .then((result) => {
      console.log(result.rows[0]);
      return result.rows;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
// const getAllProperties = function(options, limit = 10) {
//   const limitedProperties = {};
//   for (let i = 1; i <= limit; i++) {
//     limitedProperties[i] = propertiesJSON[i];
//   }
//   return Promise.resolve(limitedProperties);
// }

const getAllProperties = (options, limit = 10) => {

  // Setup an array to hold any parameters that may be available for the query.
  const queryParams = [];

  // Start the query with all information that comes before the WHERE clause.
  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_id
  `;

  // Check if a city has been passed in as an option.
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    if (queryParams.length === 1) {
      queryString += `WHERE city LIKE $${queryParams.length} `;
    }
    if (queryParams.length > 1) {
      queryString += `AND city LIKE $${queryParams.length} `;
    }
  }

  // Check if an owner_id has been passed in as an option.
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    if (queryParams.length === 1) {
      queryString += `WHERE owner_id = $${queryParams.length}`;
    }
    if (queryParams.length > 1) {
      queryString += `AND owner_id = $${queryParams.length}`;
    }
  }

  // Check if a minimum_price_per_night has been passed in as an option.
  if (options.minimum_price_per_night) {
    queryParams.push(options.minimum_price_per_night*100);
    if (queryParams.length === 1) {
      queryString += `WHERE cost_per_night > $${queryParams.length}`;
    }
    if (queryParams.length > 1) {
      queryString += `AND cost_per_night > $${queryParams.length}`;
    }
  }

  // Check if a maximum_price_per_night has been passed in as an option.
  if (options.maximum_price_per_night) {
    queryParams.push(options.maximum_price_per_night*100);
    if (queryParams.length === 1) {
      queryString += `WHERE cost_per_night < $${queryParams.length}`;
    }
    if (queryParams.length > 1) {
      queryString += `AND cost_per_night < $${queryParams.length}`;
    }
  }

  // Check if a minimum_rating has been passed in as an option.
  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += ` 
    GROUP BY properties.id
    HAVING avg(property_reviews.rating) >= $${queryParams.length}`;
    queryParams.push(limit);
    queryString += `
    LIMIT $${queryParams.length};
    `;
  }

  // If no minimum_rating was passed in as an option, add query that comes after the WHERE clause.
  if (!options.minimum_rating) {
    queryParams.push(limit);
    queryString += `
    GROUP BY properties.id
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};
    `;
  }

  // Console log everything just to make sure we've done it right.
  console.log(queryString, queryParams);

  // Run the query
  return pool
    .query(queryString, queryParams)
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

exports.getAllProperties = getAllProperties;


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  const propertyId = Object.keys(propertiesJSON).length + 1;
  property.id = propertyId;
  propertiesJSON[propertyId] = property;
  return Promise.resolve(property);
}
exports.addProperty = addProperty;
