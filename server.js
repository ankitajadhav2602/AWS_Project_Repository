const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

// AWS SDK v3 for SNS
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

const app = express();
const port = process.env.PORT || 3000;

// Log to file for CloudWatch
const logStream = fs.createWriteStream('/var/log/incident-app.log', { flags: 'a' });
console.log = function (msg) {
  const timestamped = `${new Date().toISOString()} - ${msg}`;
  logStream.write(timestamped + '\n');
  process.stdout.write(timestamped + '\n');
};

// Middleware
app.use(bodyParser.json());
app.use(express.static(__dirname));

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Routes
app.post('/report', async (req, res) => {
  const { name, description, severity } = req.body;

  if (!name || !description || !severity) {
    console.log('Invalid input received');
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Store in MySQL
    const sql = 'INSERT INTO incidents (name, description, severity) VALUES (?, ?, ?)';
    await pool.execute(sql, [name, description, severity]);
    console.log(`Incident stored: ${name} (${severity})`);

    // Send SNS notification
    const message = `New incident reported:\nName: ${name}\nSeverity: ${severity}\nDescription: ${description}`;
    const command = new PublishCommand({
      Message: message,
      TopicArn: process.env.SNS_TOPIC_ARN
    });
    await snsClient.send(command);
    console.log('SNS notification sent');

    res.json({ message: 'Incident submitted successfully' });
  } catch (error) {
    console.error('Error handling incident:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Incident Reporting app running on port ${port}`);
});
