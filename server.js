require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const fs = require('fs');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ Create log stream
const logStream = fs.createWriteStream('/home/ec2-user/logs/incident-app.log', { flags: 'a' });
function log(message) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
}

// ✅ MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ✅ SNS client
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

// ✅ Incident report endpoint
app.post('/report', async (req, res) => {
  const { title, description } = req.body;

  // ✅ Validate input
  if (!title || !description) {
    log(`Validation failed: Missing title or description`);
    return res.status(400).json({ message: 'All fields are required' });
  }

  // ✅ Save to DB
  const query = 'INSERT INTO incidents (title, description) VALUES (?, ?)';
  db.execute(query, [title, description], async (err, results) => {
    if (err) {
      log(`DB Error: ${err.message}`);
      return res.status(500).json({ message: 'Database error' });
    }

    log(`Incident saved: ${title}`);

    // ✅ Send SNS notification
    try {
      await snsClient.send(new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: `New incident reported:\nTitle: ${title}\nDescription: ${description}`,
      }));
      log(`SNS notification sent for: ${title}`);
    } catch (snsErr) {
      log(`SNS Error: ${snsErr.message}`);
    }

    res.status(200).json({ message: 'Incident reported successfully' });
  });
});

// ✅ Start server
app.listen(process.env.PORT, () => {
  log(`Server started on port ${process.env.PORT}`);
  console.log(`Server running on port ${process.env.PORT}`);
});

