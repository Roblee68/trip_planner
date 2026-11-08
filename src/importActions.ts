import * as Calendar from 'expo-calendar';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { parseLocalDateTime, parseLocalDate, type ImportedFind } from './importedFinds';

export async function prepareImageForScan(uri: string): Promise<{ imageBase64: string; imageMime: 'image/jpeg' }> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const longestSide = Math.max(original.width, original.height);
  for (const { quality, maxSide } of [
    { quality: 0.82, maxSide: 0 },
    { quality: 0.68, maxSide: 3200 },
    { quality: 0.55, maxSide: 2400 },
  ]) {
    const image = maxSide && longestSide > maxSide
      ? await ImageManipulator.manipulate(original).resize({ width: Math.max(1, Math.round(original.width * maxSide / longestSide)) }).renderAsync()
      : original;
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
    try {
      if (result.base64 && result.base64.length < 3_800_000) return { imageBase64: result.base64, imageMime: 'image/jpeg' };
    } finally {
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
    }
  }
  throw new Error('This image is unusually large. Crop it to the event details and try again.');
}

export async function keepImportedScreenshot(uri: string, id: string, mimeType?: string): Promise<string> {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('Phone storage is unavailable.');
  const directory = `${root}imported-finds/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${id}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function removeImportedScreenshot(uri: string | null): Promise<void> {
  if (!uri || !uri.includes('/imported-finds/')) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function addImportedFindToCalendar(find: ImportedFind): Promise<void> {
  const day = parseLocalDate(find.eventDate);
  if (!day) throw new Error('Enter and confirm an event date first.');
  const start = find.eventTime ? parseLocalDateTime(find.eventDate, find.eventTime) : new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (!start) throw new Error('Enter the event time as HH:MM.');
  const end = new Date(start);
  if (find.eventTime) end.setHours(end.getHours() + 2);
  else end.setDate(end.getDate() + 1);
  const permission = await Calendar.requestCalendarPermissions(true);
  if (!permission.granted) throw new Error('Allow calendar access to add this find.');
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const calendar = calendars.find(item => item.isPrimary && item.allowsModifications) ?? calendars.find(item => item.allowsModifications) ?? calendars[0];
  if (!calendar) throw new Error('No calendar is available on this phone.');
  await calendar.addEventWithForm({
    title: find.title,
    startDate: start,
    endDate: end,
    allDay: !find.eventTime,
    location: find.venue || find.place,
    notes: `Unverified find saved in Detours & Escapades. Confirm the date, time, price and availability with the organizer before leaving.${find.sourceUrl ? `\nSource: ${find.sourceUrl}` : ''}`,
    ...(find.sourceUrl ? { url: find.sourceUrl } : {}),
  });
}
