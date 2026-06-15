const express = require('express');
const ticketRouter = require('./routes/tickets');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/tickets', ticketRouter);

app.use(errorHandler);

module.exports = app;
