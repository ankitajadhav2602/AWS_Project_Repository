// server.js

const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');

const app = express();

// Parse JSON and serve static files
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));


// Connect to AWS RDS MySQL
const db = mysql.createConnection({
  host: 'incidentdb.c5m42cc6orrk.ap-south-1.rds.amazonaws.com',       // e.g. incidentdb.xxxxxx.rds.amazonaws.com
  user: 'admin',        // e.g. admin
  password: 'Ankita1234',    // e.g. yourpassword
  database: 'incidentdb'           // Must match your RDS database name
});

db.connect(err => {
  if (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to AWS RDS');
});

// Handle form submission
app.post('/submit', (req, res) => {
  const { name, description, severity } = req.body;

  const query = 'INSERT INTO incidents (name, description, severity) VALUES (?, ?, ?)';
  db.query(query, [name, description, severity], (err) => {
    if (err) {
      console.error('❌ Error inserting data:', err);
      return res.status(500).send('Error saving incident');
    }
    res.status(200).send('Incident saved');
  });
});

// Start server on port 80
app.listen(80, () => {
  console.log('🚀 Server running on port 80');
});
