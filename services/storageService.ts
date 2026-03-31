import { Report, ReportStatus } from '../types';
import { supabase } from './supabaseClient';
import { decode } from 'base64-arraybuffer';

export const getReports = async (): Promise<Report[]> => {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching reports:', error);
    return [];
  }

  // Map DB columns to Report interface if necessary, assuming 1:1 mapping for now
  // based on standard Supabase usage, snake_case in DB vs camelCase in TS might be an issue.
  // Let's assume the DB columns match the JSON structure or we need to map them.
  // Given the previous view_file showed snake_case mapping, I will include that to be safe.

  return data.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    imageUrl: r.image_url,
    location: { latitude: r.latitude, longitude: r.longitude },
    status: r.status as ReportStatus,
    timestamp: r.timestamp,
    severity: r.severity,
    description: r.description,
    isAutoDetected: r.is_auto_detected
  }));
};

export const saveReport = async (report: Report): Promise<void> => {
  try {
    let imageUrl = report.imageUrl;

    // If image is base64, upload it
    if (imageUrl.startsWith('data:image')) {
      const base64Data = imageUrl.split(',')[1];
      const fileName = `${report.id}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(fileName, decode(base64Data), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('reports')
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
    }

    const { error: dbError } = await supabase
      .from('reports')
      .insert({
        id: report.id,
        user_id: report.userId,
        image_url: imageUrl,
        latitude: report.location.latitude,
        longitude: report.location.longitude,
        status: report.status,
        timestamp: report.timestamp,
        severity: report.severity,
        description: report.description,
        is_auto_detected: report.isAutoDetected
      });

    if (dbError) throw dbError;

  } catch (error) {
    console.error('Error saving report:', error);
    throw error;
  }
};



// Retrying with correct implementation
export const updateReportStatus = async (id: string, status: ReportStatus): Promise<void> => {
  const { error, count } = await supabase
    .from('reports')
    .update({ status }, { count: 'exact' })
    .eq('id', id);

  if (error) {
    console.error('Error updating report status:', error);
    throw error;
  }

  if (count === 0) {
    throw new Error(`Failed to update report ${id}. It may not exist or you may not have permission.`);
  }
};

export const deleteReport = async (id: string): Promise<void> => {
  console.log(`[Delete] Attempting to delete report: ${id}`);

  // First, try to delete the image from storage (if exists)
  try {
    const fileName = `${id}.jpg`;
    const { error: storageError } = await supabase.storage.from('reports').remove([fileName]);
    if (storageError) {
      console.warn('[Delete] Storage file removal failed:', storageError);
    } else {
      console.log(`[Delete] Removed storage file: ${fileName}`);
    }
  } catch (storageError) {
    console.warn('[Delete] Storage file removal exception:', storageError);
  }

  // Delete the database record
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Delete] Database error:', error);
    throw new Error(`Failed to delete: ${error.message}`);
  }

  console.log(`[Delete] Successfully deleted report ${id}`);
};

export const hasNearbyReport = async (lat: number, lng: number, radiusMeters: number = 10): Promise<boolean> => {
  // Simple box check for now
  // 0.0001 degrees is roughly 11 meters
  const threshold = 0.0001;

  // Only check for PENDING or IN_PROGRESS reports
  // COMPLETED and CANCELLED reports should NOT block new reports at the same location
  const { data, error } = await supabase
    .from('reports')
    .select('id, status')
    .gt('latitude', lat - threshold)
    .lt('latitude', lat + threshold)
    .gt('longitude', lng - threshold)
    .lt('longitude', lng + threshold)
    .in('status', ['pending', 'in_progress'])
    .limit(1);

  if (error) {
    console.error("Error checking nearby reports", error);
    return false;
  }

  return data && data.length > 0;
};

export const clearReports = async () => {
  console.warn("clearReports is disabled in cloud mode to prevent data loss.");
};