const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

//MySQL RDS Connection
const db = mysql.createConnection({
  host: "incidentdb.c5m42cc6orrk.ap-south-1.rds.amazonaws.com",
  user: "admin",
  password: "Anku-0912",
  database: "incidentdb"
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Connected to AWS RDS");
  }
});

//AWS Clients
const region = "ap-south-1";
const s3 = new S3Client({ region });
const cloudwatch = new CloudWatchClient({ region });
const sns = new SNSClient({ region });

// S3 Upload Setup
const upload = multer({
  storage: multerS3({
    s3,
    bucket: "incident-reporting-s3-bucket",
    acl: "public-read",
    key: (req, file, cb) => {
      const filename = Date.now() + "-" + file.originalname;
      cb(null, filename);
    }
  })
});

//CloudWatch Metric Function
async function logIncidentMetric(severity) {
  const params = {
    Namespace: "IncidentApp",
    MetricData: [{
      MetricName: "IncidentsReported",
      Dimensions: [{ Name: "Severity", Value: severity }],
      Unit: "Count",
      Value: 1
    }]
  };
  await cloudwatch.send(new PutMetricDataCommand(params));
}

//SNS Notification Function
async function notifyIncident(name, severity) {
  const params = {
    TopicArn: "aarn:aws:sns:ap-south-1:108782067493:Incident-reporting-topic:e8ee53e6-9273-4bac-ac48-1be343150d16",
    Message: `New incident reported: ${name} with severity ${severity}`,
    Subject: "Incident Alert"
  };
  await sns.send(new PublishCommand(params));
}

// Incident Submission Route
app.post("/submit", async (req, res) => {
  const { name, description, severity } = req.body;

  db.query(
    "INSERT INTO incidents (name, description, severity) VALUES (?, ?, ?)",
    [name, description, severity],
    async (err, result) => {
      if (err) {
        console.error("DB insert error:", err);
        return res.status(500).send("Database error");
      }

      await logIncidentMetric(severity);
      await notifyIncident(name, severity);

      res.send("Incident submitted successfully");
    }
  );
});

//File Upload Route
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({
    message: "File uploaded successfully",
    fileUrl: req.file.location
  });
});

//Start Server
app.listen(80, () => {
  console.log("🚀 Server running on port 80");
});

