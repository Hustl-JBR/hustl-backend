const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE;

// Allowed file types and sizes
const ALLOWED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
  'application/pdf': ['.pdf'],
  'video/mp4': ['.mp4'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB for videos
const MAX_VIDEO_DURATION = 30; // 30 seconds
const MAX_VIDEO_RESOLUTION = 720; // 720p

async function generatePresignedUploadUrl(filename, contentType, fileSize) {
  // Validate file type
  const allowed = Object.values(ALLOWED_TYPES).flat();
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  
  if (!allowed.includes(ext)) {
    throw new Error('File type not allowed');
  }

  // Validate file size
  const isVideo = contentType.startsWith('video/');
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
  
  if (fileSize > maxSize) {
    throw new Error(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
  }

  // Generate unique filename
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const key = `uploads/${timestamp}-${random}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    // Make public if needed, or use signed URLs for access
    // ACL: 'public-read', // Uncomment if you want public access
  });

  const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 hour

  return {
    uploadUrl: url,
    fileKey: key,
    publicUrl: `${PUBLIC_BASE}/${key}`, // If public, otherwise use signed URL
  };
}

async function getPresignedDownloadUrl(fileKey) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
  });

  const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 hour
  return url;
}

function getPublicUrl(fileKey) {
  return `${PUBLIC_BASE}/${fileKey}`;
}

module.exports = {
  generatePresignedUploadUrl,
  getPresignedDownloadUrl,
  getPublicUrl,
};
