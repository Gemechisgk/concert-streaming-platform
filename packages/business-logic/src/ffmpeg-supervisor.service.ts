type ChildProcess = any;

function getSpawn() {
  if (typeof window !== 'undefined') {
    throw new Error('FfmpegSupervisorService cannot be run in the browser');
  }
  return eval('require')('node:child_process').spawn;
}

function getFs() {
  return eval('require')('node:fs');
}

function getPath() {
  return eval('require')('node:path');
}

export interface CameraJobConfig {
  cameraId: string;
  cameraName: string;
  videoInputUrl: string;
  masterAudioInputUrl: string;
  outputDirectory: string;
  targetFps?: number;
  useTestPattern?: boolean;
  durationSeconds?: number;
}

export interface CameraJobStatus {
  cameraId: string;
  running: boolean;
  pid?: number;
  restarts: number;
  startTime?: string;
  lastExitCode?: number | null;
  lastError?: string;
  targetFps: number;
  gopSize: number;
  hlsMasterPlaylistUrl: string;
}

interface SupervisedProcess {
  process: ChildProcess;
  config: CameraJobConfig;
  restarts: number;
  startTime: string;
  lastError?: string;
  lastExitCode?: number | null;
  autoRestart: boolean;
}

const activeJobs = new Map<string, SupervisedProcess>();

/**
 * FFmpeg Multi-Camera Transcoding Process Supervisor.
 *
 * Spawns, monitors, and supervises real FFmpeg ABR transcoding processes
 * generating 1080p, 720p, 480p, and 360p HLS output streams with
 * synchronized 2.0-second GOP boundaries across all camera feeds.
 */
export class FfmpegSupervisorService {
  /**
   * Starts an ABR transcoding job for a specific camera feed.
   */
  static async startCameraTranscode(config: CameraJobConfig): Promise<CameraJobStatus> {
    const existing = activeJobs.get(config.cameraId);
    if (existing && !existing.process.killed && existing.process.exitCode === null) {
      return this.getJobStatus(config.cameraId)!;
    }

    const targetFps = config.targetFps || 60;
    const gopSize = targetFps * 2; // Strict 2.0-second keyframe interval rule

    // Ensure output directories exist
    getFs().mkdirSync(config.outputDirectory, { recursive: true });

    const args: string[] = ['-y'];

    if (config.useTestPattern) {
      args.push(
        '-f', 'lavfi', '-i', `testsrc=size=1920x1080:rate=${targetFps}`,
        '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000'
      );
    } else {
      args.push(
        '-fflags', '+genpts',
        '-use_wallclock_as_timestamps', '1',
        '-i', config.videoInputUrl,
        '-i', config.masterAudioInputUrl
      );
    }

    if (config.durationSeconds && config.durationSeconds > 0) {
      args.push('-t', config.durationSeconds.toString());
    }

    // 4-Tier Multi-bitrate ABR filter graph
    args.push(
      '-filter_complex',
      `[0:v]fps=fps=${targetFps},split=4[v1][v2][v3][v4]; ` +
      `[v1]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1out]; ` +
      `[v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v2out]; ` +
      `[v3]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v3out]; ` +
      `[v4]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v4out]`,
      
      // 1080p
      '-map', '[v1out]', '-c:v:0', 'libx264', '-preset', 'veryfast',
      '-b:v:0', '4500k', '-maxrate:v:0', '4800k', '-bufsize:v:0', '9000k',
      '-r', targetFps.toString(), '-g', gopSize.toString(), '-keyint_min', gopSize.toString(),
      '-sc_threshold', '0', '-force_key_frames:v:0', 'expr:gte(t,n_forced*2)',

      // 720p
      '-map', '[v2out]', '-c:v:1', 'libx264', '-preset', 'veryfast',
      '-b:v:1', '2500k', '-maxrate:v:1', '2700k', '-bufsize:v:1', '5000k',
      '-r', targetFps.toString(), '-g', gopSize.toString(), '-keyint_min', gopSize.toString(),
      '-sc_threshold', '0', '-force_key_frames:v:1', 'expr:gte(t,n_forced*2)',

      // 480p
      '-map', '[v3out]', '-c:v:2', 'libx264', '-preset', 'veryfast',
      '-b:v:2', '1000k', '-maxrate:v:2', '1100k', '-bufsize:v:2', '2000k',
      '-r', targetFps.toString(), '-g', gopSize.toString(), '-keyint_min', gopSize.toString(),
      '-sc_threshold', '0', '-force_key_frames:v:2', 'expr:gte(t,n_forced*2)',

      // 360p
      '-map', '[v4out]', '-c:v:3', 'libx264', '-preset', 'veryfast',
      '-b:v:3', '600k', '-maxrate:v:3', '700k', '-bufsize:v:3', '1200k',
      '-r', targetFps.toString(), '-g', gopSize.toString(), '-keyint_min', gopSize.toString(),
      '-sc_threshold', '0', '-force_key_frames:v:3', 'expr:gte(t,n_forced*2)',

      // Master Audio tracks
      '-map', '1:a:0', '-c:a:0', 'aac', '-b:a:0', '192k', '-ar', '48000',
      '-map', '1:a:0', '-c:a:1', 'aac', '-b:a:1', '128k', '-ar', '48000',
      '-map', '1:a:0', '-c:a:2', 'aac', '-b:a:2', '96k', '-ar', '48000',
      '-map', '1:a:0', '-c:a:3', 'aac', '-b:a:3', '64k', '-ar', '48000',

      // HLS packaging with 2.0s target duration and program date time
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+independent_segments+program_date_time',
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', 'v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p',
      getPath().join(config.outputDirectory, 'stream_%v.m3u8')
    );

    const child = getSpawn()('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const supervised: SupervisedProcess = {
      process: child,
      config,
      restarts: existing ? existing.restarts + 1 : 0,
      startTime: new Date().toISOString(),
      autoRestart: !config.durationSeconds || config.durationSeconds === 0
    };

    child.stderr?.on('data', (chunk: any) => {
      const errStr = chunk.toString();
      if (errStr.includes('Error') || errStr.includes('fatal')) {
        supervised.lastError = errStr.trim();
      }
    });

    child.on('exit', (code: any) => {
      supervised.lastExitCode = code;
      if (code !== 0 && supervised.autoRestart && supervised.restarts < 3) {
        console.warn(`[FFmpeg Supervisor] Camera ${config.cameraId} exited with code ${code}. Restarting...`);
        setTimeout(() => {
          this.startCameraTranscode(config).catch(err => {
            console.error(`[FFmpeg Supervisor] Failed to restart camera ${config.cameraId}:`, err);
          });
        }, 1000);
      }
    });

    activeJobs.set(config.cameraId, supervised);

    return {
      cameraId: config.cameraId,
      running: true,
      pid: child.pid,
      restarts: supervised.restarts,
      startTime: supervised.startTime,
      targetFps,
      gopSize,
      hlsMasterPlaylistUrl: getPath().join(config.outputDirectory, 'master.m3u8')
    };
  }

  /**
   * Stops an active camera transcoding process cleanly.
   */
  static async stopCameraTranscode(cameraId: string): Promise<boolean> {
    const job = activeJobs.get(cameraId);
    if (!job) return false;

    job.autoRestart = false; // Prevent supervisor from restarting on intentional stop

    if (!job.process.killed && job.process.exitCode === null) {
      job.process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!job.process.killed && job.process.exitCode === null) {
        job.process.kill('SIGKILL');
      }
    }

    activeJobs.delete(cameraId);
    return true;
  }

  /**
   * Stops all active camera transcoding processes cleanly.
   */
  static async stopAll(): Promise<void> {
    for (const [id] of activeJobs.entries()) {
      await this.stopCameraTranscode(id);
    }
  }

  static getJobStatus(cameraId: string): CameraJobStatus | null {
    const job = activeJobs.get(cameraId);
    if (!job) return null;

    const isRunning = !job.process.killed && job.process.exitCode === null;
    const targetFps = job.config.targetFps || 60;

    return {
      cameraId,
      running: isRunning,
      pid: job.process.pid,
      restarts: job.restarts,
      startTime: job.startTime,
      lastExitCode: job.lastExitCode,
      lastError: job.lastError,
      targetFps,
      gopSize: targetFps * 2,
      hlsMasterPlaylistUrl: getPath().join(job.config.outputDirectory, 'master.m3u8')
    };
  }

  static getAllJobs(): CameraJobStatus[] {
    const result: CameraJobStatus[] = [];
    for (const [id] of activeJobs.entries()) {
      const status = this.getJobStatus(id);
      if (status) result.push(status);
    }
    return result;
  }
}
