require("dotenv").config();
const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const multer = require("multer");
const multerS3 = require("multer-s3");
const {
  S3Client
} = require("@aws-sdk/client-s3");
const {
  CloudWatchClient,
  PutMetricDataCommand
} = require("@aws-sdk/client-cloudwatch");
const {
  SNSClient,
  PublishCommand
} = require("@aws-sdk/client-sns");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// MySQL RDS Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to AWS RDS");
  }
});

// AWS Clients
const region = process.env.AWS_REGION;
const s3 = new S3Client({ region });
const cloudwatch = new CloudWatchClient({ region });
const sns = new SNSClient({ region });

// File Upload Route (moved multer setup inside)
app.post("/upload", (req, res) => {
  console.log("DEBUG: S3_BUCKET =", process.env.S3_BUCKET);  // ← Debug line

  const upload = multer({
    storage: multerS3({
      s3,
      bucket: process.env.S3_BUCKET,
      acl: "public-read",
      key: (req, file, cb) => {
        const filename = Date.now() + "-" + file.originalname;
        cb(null, filename);
      }
    })
  });

  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("❌ Upload error:", err);
      return res.status(500).send("Upload failed");
    }

    res.json({
      message: "✅ File uploaded successfully",
      fileUrl: req.file.location
    });
  });
});


// CloudWatch Metric Function
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

// SNS Notification Function
async function notifyIncident(name, severity) {
  const params = {
    TopicArn: process.env.SNS_TOPIC_ARN,
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
        console.error("❌ DB insert error:", err);
        return res.status(500).send("Database error");
      }

      await logIncidentMetric(severity);
      await notifyIncident(name, severity);

      res.send("✅ Incident submitted successfully");
    }
  );
});

// File Upload Route
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({
    message: "✅ File uploaded successfully",
    fileUrl: req.file.location
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
