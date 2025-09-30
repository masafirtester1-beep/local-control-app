const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(helmet());

const PORT = process.env.PORT || 4000;
const SECRET_TOKEN = process.env.SECRET_TOKEN;

app.get('/', (req, res) => {
  res.send('Local Control App running');
});

// حماية بسيطة بمفتاح API
app.get('/api/secure', (req, res) => {
  const token = req.query.token;
  if (token !== SECRET_TOKEN) {
    return res.status(401).json({error: 'Unauthorized'});
  }
  res.json({message: 'Secure route accessed successfully'});
});

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
