require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const fs = require('fs');
const {
  SNSClient,
  PublishCommand,
} = require('@aws-sdk/client-sns');
const {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} = require('@aws-sdk/client-cloudwatch-logs');

const app = express();
app.use(express.json());

// ✅ Local log file setup
const logPath = './logs/incident-app.log';
fs.mkdirSync('./logs', { recursive: true });
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

// ✅ CloudWatch setup
const logGroupName = 'incident-reporting-app';
const logStreamName = 'incident-app-stream';
const cwClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION });
let sequenceToken = null;

// ✅ Create log group and stream if needed
(async () => {
  try {
    await cwClient.send(new CreateLogGroupCommand({ logGroupName }));
  } catch (err) {
    if (err.name !== 'ResourceAlreadyExistsException') console.error('Log group error:', err);
  }

  try {
    await cwClient.send(new CreateLogStreamCommand({ logGroupName, logStreamName }));
  } catch (err) {
    if (err.name !== 'ResourceAlreadyExistsException') console.error('Log stream error:', err);
  }
})();

// ✅ Logging function
async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  // Write to local file
  logStream.write(`${logMessage}\n`);

  // Send to CloudWatch
  try {
    const params = {
      logGroupName,
      logStreamName,
      logEvents: [{ message: logMessage, timestamp: Date.now() }],
      sequenceToken,
    };
    const response = await cwClient.send(new PutLogEventsCommand(params));
    sequenceToken = response.nextSequenceToken;
  } catch (err) {
    console.error('CloudWatch log error:', err);
  }
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
  log(`Incoming request body: ${JSON.stringify(req.body)}`);
  const { title, description } = req.body;

  if (!req.body || !title || !description) {
    log(`Invalid input received`);
    return res.status(400).json({ message: 'All fields are required' });
  }

  const query = 'INSERT INTO incidents (title, description) VALUES (?, ?)';
  db.execute(query, [title, description], async (err, results) => {
    if (err) {
      log(`DB Error: ${err.message}`);
      return res.status(500).json({ message: 'Database error' });
    }

    log(`Incident saved: ${title}`);

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

// ✅ Catch-all for unexpected POST routes
app.post('*', (req, res) => {
  log(`Unhandled POST route: ${req.originalUrl} - Body: ${JSON.stringify(req.body)}`);
  res.status(404).json({ message: 'Route not found' });
});

// ✅ Start server
app.listen(process.env.PORT, () => {
  log(`Server started on port ${process.env.PORT}`);
  console.log(`Server running on port ${process.env.PORT}`);
});
