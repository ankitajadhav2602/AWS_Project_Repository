require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const AWS = require('aws-sdk');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// 🔐 AWS Configuration
AWS.config.update({ region: process.env.AWS_REGION });
const sns = new AWS.SNS();
const cloudwatchlogs = new AWS.CloudWatchLogs();

// 📦 MySQL RDS Configuration
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// 🔗 Connect to MySQL
db.connect(err => {
  if (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL RDS');
});

// 🌐 Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// 🏠 Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📥 Incident Report Endpoint
app.post('/report', async (req, res) => {
  const { name, description, severity } = req.body;

  // 1️⃣ Save to RDS
  const query = 'INSERT INTO incidents (name, description, severity) VALUES (?, ?, ?)';
  db.query(query, [name, description, severity], async (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Failed to save incident' });
    }

    // 2️⃣ Send SMS via SNS
    const snsParams = {
      Message: `New Incident: ${name} (${severity})`,
      TopicArn: process.env.SNS_TOPIC_ARN
    };

    try {
      await sns.publish(snsParams).promise();
      console.log('SNS notification sent');
    } catch (snsErr) {
      console.error('SNS error:', snsErr);
    }

    // 3️⃣ Log to CloudWatch
    const logGroupName = process.env.LOG_GROUP_NAME;
    const logStreamName = process.env.LOG_STREAM_NAME;

    try {
      await cloudwatchlogs.createLogStream({ logGroupName, logStreamName }).promise();
    } catch (e) {
      if (e.code !== 'ResourceAlreadyExistsException') {
        console.error('Log stream creation error:', e);
      }
    }

    const logParams = {
      logGroupName,
      logStreamName,
      logEvents: [{
        message: `Incident logged: ${name} - ${description} - ${severity}`,
        timestamp: Date.now()
      }]
    };

    try {
      await cloudwatchlogs.putLogEvents(logParams).promise();
      console.log('Log event sent to CloudWatch');
    } catch (logErr) {
      console.error('CloudWatch error:', logErr);
    }

    res.json({ message: 'Incident reported successfully!' });
  });
});

// 🚀 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
