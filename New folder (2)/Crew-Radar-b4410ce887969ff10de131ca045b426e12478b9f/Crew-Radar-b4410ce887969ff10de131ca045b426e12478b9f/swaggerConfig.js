// swaggerConfig.js
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Crew Radar API',
    version: '1.0.0',
    description: 'API documentation for the Crew Radar application, built with Node.js, Express, and MongoDB.',
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 3000}`, 
      description: 'Development server',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./docs/**/*.yaml'], 
};

const swaggerSpec = swaggerJSDoc(options);

const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

module.exports = setupSwagger;