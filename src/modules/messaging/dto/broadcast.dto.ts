import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';

export type AudienceType =
  | 'contact'
  | 'contacts'
  | 'tag'
  | 'group'
  | 'appointment_participants'
  | 'campaign'
  | 'campaign_response';

export type BroadcastChannel = 'SMS' | 'WHATSAPP' | 'VOICE' | 'EMAIL';

export class BroadcastDto {
  @IsEnum(['SMS', 'WHATSAPP', 'VOICE', 'EMAIL'])
  channel: BroadcastChannel;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  template: string;

  @IsEnum([
    'contact',
    'contacts',
    'tag',
    'group',
    'appointment_participants',
    'campaign',
    'campaign_response',
  ])
  audienceType: AudienceType;

  /**
   * Single target ID: contactId | tagId | groupId | appointmentId | campaignSegmentId
   * Required for contact | tag | group | appointment_participants | campaign
   */
  @IsOptional()
  @IsUUID()
  audienceId?: string;

  /**
   * Multiple contact IDs — used when audienceType === 'contacts'
   */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  audienceIds?: string[];

  /**
   * Auto-creates a Campaign record for tracking.
   * Defaults to "Broadcast [ISO timestamp]" if omitted.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  campaignName?: string;

  /**
   * Used with audienceType 'campaign_response'.
   * audienceId = source campaignId.
   *
   * responseStatus — semantic status filter (preferred):
   *   'confirmed' | 'cancelled' | 'pending'
   *   Maps to: SELECT contact_id FROM message_responses
   *            WHERE broadcast_id = ? AND response_status = ?
   *
   * responseFilter — raw text match (legacy / FollowUpModal):
   *   Exact match against CampaignRecipient.responseText (e.g. "YES").
   *   Used only when responseStatus is not provided.
   *
   * If both are omitted, ALL contacts who responded are targeted.
   */
  @IsOptional()
  @IsEnum(['confirmed', 'cancelled', 'pending'])
  responseStatus?: 'confirmed' | 'cancelled' | 'pending';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  responseFilter?: string;
}
