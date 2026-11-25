import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';

/** A single-use link sent to someone's inbox: to accept an invitation or to choose a new password. Only a hash of the token is stored, so the table is useless to anyone who reads it. */
@Entity('oss_staff_token')
export class OssStaffToken {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column({ type: 'varchar', length: 60 }) channelId!: string;
  @Column({ type: 'varchar', length: 60 }) administratorId!: string;
  @Column({ type: 'varchar', length: 10 }) purpose!: 'invite' | 'reset';
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) tokenHash!: string;
  /** Minutes since 1970. Whole minutes are plenty for links that last an hour or a week, and the column type works on every database we run. */
  @Column({ type: 'int' }) expiresMin!: number;
}
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const INVITE_MINUTES = 7 * 24 * 60; export const RESET_MINUTES = 60;
