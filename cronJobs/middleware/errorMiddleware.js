const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Handles Mongoose errors that happen INSIDE the controller
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join('. ');
  }
  
  if (err.code === 11000) {
    statusCode = 400;
    message = `An account already exists with that ${Object.keys(err.keyValue)}.`;
  }
  
  res.status(statusCode).json({
    message,
    // Only show the error stack in development for debugging
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };