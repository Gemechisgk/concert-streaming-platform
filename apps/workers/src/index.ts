// BullMQ Worker Pipeline Definition
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Safe Redis connection initializer (with reconnect backoff)
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 1000, 5000)
});

export const notificationQueue = new Queue('notifications', { connection });
export const paymentReconciliationQueue = new Queue('payment_reconciliation', { connection });
export const mediaProcessingQueue = new Queue('media_processing', { connection });

// Processors
async function processNotificationJob(job: Job) {
  const { type, recipient, data } = job.data;
  console.log(`[Worker - Notifications] Processing ${type} for recipient: ${recipient}`);

  if (type === 'EMAIL_TICKET_CONFIRMATION') {
    // Simulate sending transactional ticket delivery email with QR attachment
    console.log(`[Worker] Sent Ticket ${data.ticketCode} to ${recipient} with download link.`);
  } else if (type === 'SMS_REMINDER') {
    console.log(`[Worker] Sent SMS concert broadcast starting reminder to ${recipient}`);
  }

  return { delivered: true, timestamp: new Date().toISOString() };
}

async function processMediaJob(job: Job) {
  const { eventId, action } = job.data;
  console.log(`[Worker - MediaProcessing] Event ${eventId}: Executing ${action}...`);

  if (action === 'PACKAGE_REPLAY_VOD') {
    console.log(`[Worker] Slicing recorded stream chunks and building HLS VOD playlist for event ${eventId}...`);
    console.log(`[Worker] Replay asset published successfully for event ${eventId}.`);
  }

  return { status: 'COMPLETED', eventId };
}

async function main() {
  console.log('[Worker Service] Initializing BullMQ Background Job Processors...');

  try {
    await connection.connect();
    console.log('[Worker Service] Connected to Redis.');
  } catch (err: any) {
    console.warn(`[Worker Service] Redis not reachable on ${REDIS_URL}. Operating in standalone / mock pipeline mode:`, err.message);
  }

  // Define workers
  const notificationWorker = new Worker('notifications', processNotificationJob, { connection });
  const mediaWorker = new Worker('media_processing', processMediaJob, { connection });

  notificationWorker.on('completed', (job) => {
    console.log(`[Notification Worker] Job ${job.id} completed successfully.`);
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`[Notification Worker] Job ${job?.id} failed:`, err.message);
  });

  mediaWorker.on('completed', (job) => {
    console.log(`[Media Worker] Job ${job.id} completed.`);
  });

  console.log('[Worker Service] All background workers initialized and listening for jobs.');
}

if (require.main === module) {
  main().catch(console.error);
}
