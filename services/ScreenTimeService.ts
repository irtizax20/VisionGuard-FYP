// Utility functions for screen time display

export class ScreenTimeService {
  static formatTime(ms: number): string {
    if (!ms || ms <= 0) return '0m';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  static getAppName(pkg: string): string {
    const map: Record<string, string> = {
      'com.instagram.android': 'Instagram',
      'com.google.android.youtube': 'YouTube',
      'com.facebook.katana': 'Facebook',
      'com.facebook.orca': 'Messenger',
      'com.whatsapp': 'WhatsApp',
      'com.twitter.android': 'Twitter',
      'com.snapchat.android': 'Snapchat',
      'com.zhiliaoapp.musically': 'TikTok',
      'com.tiktok.musically': 'TikTok',
      'com.spotify.music': 'Spotify',
      'com.netflix.mediaclient': 'Netflix',
      'com.google.android.gm': 'Gmail',
      'com.google.android.apps.maps': 'Google Maps',
    };
    if (map[pkg]) return map[pkg];
    const last = pkg.split('.').pop() || pkg;
    // Capitalize simple fallback
    return last.replace(/([a-z])([A-Z])/g, '$1 $2')
               .split(/[_\-\s]+/)
               .map(w => w.charAt(0).toUpperCase() + w.slice(1))
               .join(' ');
  }
}

export default ScreenTimeService;
