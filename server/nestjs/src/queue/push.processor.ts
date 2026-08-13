import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import PushNotifications from 'node-pushnotifications';

const settings: PushNotifications.Settings = {
  gcm: {
    id: process.env.FCM_SERVER_KEY || '',
  },
  apn: {
    token: {
      key:  process.env.APN_KEY_PATH || '',
      keyId: process.env.APN_KEY_ID || '',
      teamId: process.env.APN_TEAM_ID || '',
    },
    production: process.env.NODE_ENV === 'production',
  },
};

export interface PushPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string | number>;
  badge?: number;
}

@Processor('push')
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);
  private push: PushNotifications;

  constructor() {
    super();
    this.push = new PushNotifications(settings);
  }

  async process(job: Job<PushPayload>): Promise<void> {
    const { tokens, title, body, data, badge } = job.data;
    if (!tokens?.length) return;

    const msg: PushNotifications.Data = {
      title,
      body,
      badge: badge ?? 1,
      custom: data ?? {},
      sound: 'default',
      topic: process.env.APN_BUNDLE_ID || 'com.vxin.app',
    };

    try {
      const results = await this.push.send(tokens, msg);
      const failures = results.filter(r => r.failure > 0);
      if (failures.length) {
        this.logger.warn(`Push failures: ${JSON.stringify(failures)}`);
      } else {
        this.logger.log(`Push sent to ${tokens.length} device(s): ${title}`);
      }
    } catch (err) {
      this.logger.error('Push send error', err);
      throw err; // BullMQ will retry
    }
  }
}
