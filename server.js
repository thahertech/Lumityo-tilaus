/*
*
* NOT NEEDED FILE FOR PROJECT ; SERVER HANDLED IN ORDERSCREEN:JS
*
*/

const express = require('express');
const bodyParser = require('body-parser');
const emailjs = require('emailjs');


const app = express();
const port = process.env.PORT || 3000;

require('dotenv').config();

const serviceID = process.env.EMAILJS_SERVICE_ID;
const templateID = process.env.EMAILJS_TEMPLATE_ID;
const userID = process.env.EMAILJS_USER_ID;

emailjs.send(serviceID, templateID, templateParams, userID)
  .then((response) => {
    console.log('SUCCESS!', response.status, response.text);
  }, (err) => {
    console.error('FAILED...', err);
  });


app.use(bodyParser.json());

app.post('/send-email', (req, res) => {
  const { firstName, phoneNumber, address, selectedService } = req.body;

//   const message = {
//     text: `Order details:\
//          Name: ${firstName}
//          \nPhone: ${phoneNumber}
//          \nAddress: ${address}
//          \nService: ${selectedService}`,
//              from: '',
//              to: '',
//              subject: 'Lumityö palvelupyyntö'
//   };

  server.send(message, (error, message) => {
    if (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ success: false, error: error.message });
    } else {
      console.log('Email sent successfully:', message);
      res.status(200).json({ success: true });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
