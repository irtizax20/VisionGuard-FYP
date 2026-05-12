import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { BlinkDetectionResult } from './BlinkDetectionService';

/**
 * Service to track blink count and screen distance data
 * Stores data in blinks/{userId} collection with weekly structure:
 * - Week 4: Current week (full daily data)
 * - Week 3, 2, 1: Previous weeks (averages only)
 */
class BlinkTrackingService {
  /**
   * Check if week rotation is needed and perform it automatically
   * Called during initialization to handle 12 AM transitions
   */
  async checkAndRotateWeeks(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('[BlinkTrackingService] No user logged in, skipping rotation check');
        return;
      }

      const today = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      // Calculate current week start date (Monday)
      const dayNum = today.getDay(); // 0 = Sunday, 1 = Monday, ...
      const diff = dayNum === 0 ? -6 : 1 - dayNum;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + diff);
      const weekStartDate = weekStart.toISOString().slice(0, 10);

      const blinksRef = doc(db, 'blinks', user.uid);
      
      let currentDoc;
      try {
        currentDoc = await getDoc(blinksRef);
      } catch (firestoreError) {
        console.error('[BlinkTrackingService] ❌ Firestore access failed (permission error):', firestoreError);
        return; // Exit gracefully without crashing
      }
      
      if (!currentDoc.exists()) {
        return;
      }

      const currentData = currentDoc.data();
      
      // Check if week rotation is needed (weekStartDate changed)
      if (currentData.week4?.weekStartDate && currentData.week4.weekStartDate !== weekStartDate) {
        console.log(`[BlinkTrackingService] 🔄 Auto-rotation triggered - New week detected!`);
        console.log(`[BlinkTrackingService] Old week: ${currentData.week4.weekStartDate}, New week: ${weekStartDate}`);
        
        // Calculate week 4 averages before rotating
        const week4Data = currentData.week4 || {};
        let totalBlinks = 0;
        let totalDistance = 0;
        let totalMeasurements = 0;
        let daysWithData = 0;
        
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
          if (week4Data[day]?.blinks > 0 || week4Data[day]?.measurements > 0) {
            totalBlinks += week4Data[day].blinks || 0;
            totalDistance += week4Data[day].distance || 0;
            totalMeasurements += week4Data[day].measurements || 0;
            daysWithData++;
          }
        });
        
        const avgBlinks = daysWithData > 0 ? Math.round(totalBlinks / daysWithData) : 0;
        const avgDistance = daysWithData > 0 ? Math.round(totalDistance / daysWithData) : 0;
        const avgMeasurements = daysWithData > 0 ? Math.round(totalMeasurements / daysWithData) : 0;
        
        // Rotate weeks: week3 → week2, week2 → week1, week4 average → week3
        const rotatedData: any = {
          week3: {
            averageBlinks: avgBlinks,
            averageDistance: avgDistance,
            averageMeasurements: avgMeasurements,
            weekStartDate: week4Data.weekStartDate || '',
            calculatedOn: new Date().toISOString(),
          },
          week2: currentData.week3 || {
            averageBlinks: 0,
            averageDistance: 0,
            averageMeasurements: 0,
            weekStartDate: '',
          },
          week1: currentData.week2 || {
            averageBlinks: 0,
            averageDistance: 0,
            averageMeasurements: 0,
            weekStartDate: '',
          },
          // Reset week4 completely with zeros
          week4: {
            monday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            tuesday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            wednesday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            thursday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            friday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            saturday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            sunday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            weekStartDate: weekStartDate,
          },
        };
        
        try {
          await setDoc(blinksRef, rotatedData, { merge: true });
          console.log(`[BlinkTrackingService] ✅ Auto-rotation complete - Week 4 reset, avg stored in week 3: ${avgBlinks} blinks`);
        } catch (saveError) {
          console.error('[BlinkTrackingService] ❌ Failed to save rotation data (Firestore permission):', saveError);
          return; // Exit without crashing
        }
      } else {
        console.log(`[BlinkTrackingService] ✓ No rotation needed - current week: ${weekStartDate}`);
      }
    } catch (error) {
      console.error('[BlinkTrackingService] ❌ Auto-rotation failed:', error);
      // Don't throw - allow app to continue without rotation
    }
  }

  /**
   * Save blink detection results to Firestore
   * Updates daily data in week4 and rotates weeks automatically
   * 
   * @param result - Blink detection result from BlinkDetectionService
   */
  async saveBlinkData(result: BlinkDetectionResult): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Get current date info
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[today.getDay()];

      // Get week start date (Monday)
      const dayNum = today.getDay(); // 0 = Sunday, 1 = Monday, ...
      const diff = dayNum === 0 ? -6 : 1 - dayNum;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + diff);
      const weekStartDate = weekStart.toISOString().slice(0, 10);

      // Normalize blinks: 30-second session → multiply by 2 to get per-minute rate
      // Example: 20 blinks in 30 seconds → 20 × 2 = 40 normalized blinks
      const BLINK_SESSION_DURATION_SECONDS = 30;
      const normalizedBlinks = result.durationSeconds === BLINK_SESSION_DURATION_SECONDS
        ? result.blinkCount * 2
        : result.blinkCount * (60 / result.durationSeconds); // Normalize to per-minute if different duration
      
      console.log(`[BlinkTrackingService] 📊 Normalizing blinks: ${result.blinkCount} blinks in ${result.durationSeconds}s → ${normalizedBlinks} normalized blinks`);
      
      await this.writeWeeklyBlinkData(
        user.uid,
        dateStr,
        dayOfWeek,
        weekStartDate,
        normalizedBlinks,
        result.averageScreenDistance,
        1  // Increment by 1 for each detection session
      );

      console.log('✅ Blink data saved:', {
        rawBlinks: result.blinkCount,
        normalizedBlinks: normalizedBlinks,
        distance: result.averageScreenDistance,
        sessionCount: 1  // Each save = 1 detection session
      });
    } catch (error) {
      console.error('❌ Failed to save blink data:', error);
      throw error;
    }
  }

  /**
   * Write weekly structured blink data to Firestore
   * Week 4 = Current week (full day-wise data)
   * Week 3, 2, 1 = Previous weeks (average only)
   */
  private async writeWeeklyBlinkData(
    userId: string,
    date: string,
    dayOfWeek: string,
    weekStartDate: string,
    blinkCount: number,
    averageDistance: number,
    measurements: number
  ): Promise<void> {
    try {
      const blinksRef = doc(db, 'blinks', userId);
      
      // Get current document to check if we need to rotate weeks
      const currentDoc = await getDoc(blinksRef);
      const currentData = currentDoc.exists() ? currentDoc.data() : {};
      
      // Check if today is Sunday - calculate and store week average in week3
      if (dayOfWeek === 'sunday') {
        console.log(`[BlinkTrackingService] 📊 Sunday detected - calculating week 4 average...`);
        
        // Calculate averages for entire week 4 (all 7 days)
        const week4Data = currentData.week4 || {};
        let totalBlinks = 0;
        let totalDistance = 0;
        let totalMeasurements = 0;
        let daysWithData = 0;
        
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
          if (week4Data[day]?.blinks > 0 || week4Data[day]?.measurements > 0) {
            totalBlinks += week4Data[day].blinks || 0;
            totalDistance += week4Data[day].distance || 0;
            totalMeasurements += week4Data[day].measurements || 0;
            daysWithData++;
          }
        });
        
        const avgBlinks = daysWithData > 0 ? Math.round(totalBlinks / daysWithData) : 0;
        const avgDistance = daysWithData > 0 ? Math.round(totalDistance / daysWithData) : 0;
        const avgMeasurements = daysWithData > 0 ? Math.round(totalMeasurements / daysWithData) : 0;
        
        // Store week 4 average in week 3
        const week3Data = {
          week3: {
            averageBlinks: avgBlinks,
            averageDistance: avgDistance,
            averageMeasurements: avgMeasurements,
            weekStartDate: week4Data.weekStartDate || weekStartDate,
            calculatedOn: new Date().toISOString(),
          },
        };
        
        await setDoc(blinksRef, week3Data, { merge: true });
        console.log(`[BlinkTrackingService] ✅ Week 4 average stored in week 3: ${avgBlinks} blinks (${daysWithData} days)`);
      }
      
      // Check if we're starting a new week (Monday after Sunday - transition detected)
      if (currentData.week4?.weekStartDate && currentData.week4.weekStartDate !== weekStartDate) {
        console.log(`[BlinkTrackingService] 🔄 New week detected (Monday)! Rotating weeks and resetting week 4...`);
        
        // Rotate weeks: week3 → week2, week2 → week1
        const rotatedData: any = {
          week2: currentData.week3 || {
            averageBlinks: 0,
            averageDistance: 0,
            averageMeasurements: 0,
            weekStartDate: '',
          },
          week1: currentData.week2 || {
            averageBlinks: 0,
            averageDistance: 0,
            averageMeasurements: 0,
            weekStartDate: '',
          },
          // Reset week4 (current week) with empty days for new week
          week4: {
            monday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            tuesday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            wednesday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            thursday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            friday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            saturday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            sunday: { blinks: 0, distance: 0, measurements: 0, date: '' },
            weekStartDate: weekStartDate,
          },
        };
        
        await setDoc(blinksRef, rotatedData, { merge: true });
        console.log(`[BlinkTrackingService] ✅ Week 4 reset for new week starting ${weekStartDate}`);
      }
      
      // Get existing day data to accumulate (not replace)
      const existingDayData = currentData.week4?.[dayOfWeek] || {
        blinks: 0,
        distance: 0,
        measurements: 0,
        date: date,
      };
      
      // Accumulate data for the same day:
      // - Total blinks: add normalized blinks
      // - Average distance: calculate new average from all measurements
      // - Measurements: increment count
      const accumulatedBlinks = existingDayData.blinks + blinkCount;
      const accumulatedMeasurements = existingDayData.measurements + measurements;
      
      // Calculate new average distance: (old_avg × old_count + new_avg × new_count) / total_count
      // Or simpler: sum all distances and divide by total measurements
      // Since we store average per session, we need to recalculate:
      const totalDistanceSum = (existingDayData.distance * existingDayData.measurements) + (averageDistance * measurements);
      const newAverageDistance = accumulatedMeasurements > 0 
        ? totalDistanceSum / accumulatedMeasurements 
        : averageDistance;
      
      // Update current day's data in week4 (accumulated)
      // Use nested structure to match the schema (not dot notation)
      const currentWeek4Data = currentData.week4 || {
        monday: { blinks: 0, distance: 0, measurements: 0, date: '' },
        tuesday: { blinks: 0, distance: 0, measurements: 0, date: '' },
        wednesday: { blinks: 0, distance: 0, measurements: 0, date: '' },
        thursday: { blinks: 0, distance: 0, measurements: 0, date: '' },
        friday: { blinks: 0, distance: 0, measurements: 0, date: '' },
        saturday: { blinks: 0, distance: 0, measurements: 0, date: '' },
        sunday: { blinks: 0, distance: 0, measurements: 0, date: '' },
        weekStartDate: weekStartDate,
      };
      
      // Update the specific day in the nested structure
      currentWeek4Data[dayOfWeek] = {
        blinks: accumulatedBlinks,
        distance: newAverageDistance,
        measurements: accumulatedMeasurements,
        date: date,
      };
      currentWeek4Data.weekStartDate = weekStartDate;
      
      const updateData = {
        userId: userId, // Store userId for reference
        week4: currentWeek4Data,
        lastUpdated: new Date(),
      };

      await setDoc(blinksRef, updateData, { merge: true });

      console.log(`[BlinkTrackingService] ✅ Updated week4.${dayOfWeek} - Blinks: ${blinkCount}, Distance: ${averageDistance}`);
    } catch (error) {
      console.warn('[BlinkTrackingService] ⚠️ Weekly blink data write failed:', error);
    }
  }

  /**
   * Get user's blink statistics from current week (week4)
   * 
   * @returns Object with current week's blink data and averages
   */
  async getBlinkStats(): Promise<{
    currentWeekBlinks: number;
    currentWeekDistance: number;
    currentWeekMeasurements: number;
    averageBlinksPerDay: number;
  }> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Read from blinks/{userId} document
      const statsRef = doc(db, 'blinks', user.uid);
      const statsDoc = await getDoc(statsRef);

      console.log('[BlinkTrackingService] 📊 Document exists:', statsDoc.exists());
      
      if (!statsDoc.exists()) {
        console.log('[BlinkTrackingService] ⚠️ No blinks document found');
        return {
          currentWeekBlinks: 0,
          currentWeekDistance: 0,
          currentWeekMeasurements: 0,
          averageBlinksPerDay: 0
        };
      }

      const data = statsDoc.data();
      console.log('[BlinkTrackingService] 📊 Document data:', JSON.stringify(data, null, 2));
      
      // Firestore stores nested fields with dot notation as flat keys
      // So "week4.saturday" is stored as a flat key, not data.week4.saturday
      // We need to parse both nested structure and flat keys
      let week4Data: any = data.week4 || {};
      
      // If week4 is not nested, check for flat keys like "week4.saturday"
      if (!week4Data || Object.keys(week4Data).length === 0) {
        console.log('[BlinkTrackingService] 📊 Checking for flat keys (week4.*)...');
        week4Data = {};
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        dayNames.forEach(day => {
          const flatKey = `week4.${day}`;
          if (data[flatKey]) {
            week4Data[day] = data[flatKey];
            console.log(`[BlinkTrackingService] 📊 Found flat key ${flatKey}:`, data[flatKey]);
          }
        });
        
        // Also check for weekStartDate
        if (data['week4.weekStartDate']) {
          week4Data.weekStartDate = data['week4.weekStartDate'];
        }
      }
      
      if (!week4Data || Object.keys(week4Data).length === 0) {
        console.log('[BlinkTrackingService] ⚠️ No week4 data found');
        return {
          currentWeekBlinks: 0,
          currentWeekDistance: 0,
          currentWeekMeasurements: 0,
          averageBlinksPerDay: 0
        };
      }

      console.log('[BlinkTrackingService] 📊 Week4 data (parsed):', JSON.stringify(week4Data, null, 2));

      // Calculate totals from week4
      let totalBlinks = 0;
      let totalDistanceSum = 0; // Sum of all distances for weighted average
      let totalMeasurements = 0;
      let daysWithData = 0;
      let totalDistanceForAvg = 0; // Sum of daily averages for simple average
      
      // For Avg Blinks/Day: Calculate per-day average, then average those daily averages
      const dailyAverages: number[] = [];

      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
        const dayData = week4Data[day];
        if (dayData && (dayData.blinks > 0 || dayData.distance > 0 || dayData.measurements > 0)) {
          const blinks = dayData.blinks || 0;
          const distance = dayData.distance || 0;
          const measurements = dayData.measurements || 0;
          
          console.log(`[BlinkTrackingService] 📊 ${day}: blinks=${blinks}, distance=${distance}, measurements=${measurements}`);
          totalBlinks += blinks;
          // For weighted average: multiply distance by measurements (since distance is average per day)
          totalDistanceSum += (distance * measurements);
          totalDistanceForAvg += distance; // For simple average of daily averages
          totalMeasurements += measurements;
          
          // Calculate per-day average: total blinks of that day / times measured that day
          // This gives average normalized blinks per session for that day
          if (measurements > 0) {
            const dayAverage = blinks / measurements;
            dailyAverages.push(dayAverage);
            console.log(`[BlinkTrackingService] 📊 ${day} average: ${blinks} / ${measurements} = ${dayAverage.toFixed(2)} normalized blinks per session`);
          }
          
          if (blinks > 0 || measurements > 0) {
            daysWithData++;
          }
        }
      });

      // Avg Blinks/Day = Average of daily averages (blinks per session per day)
      const averageBlinksPerDay = dailyAverages.length > 0
        ? dailyAverages.reduce((sum, avg) => sum + avg, 0) / dailyAverages.length
        : 0;
      
      // Calculate average distance: simple average of all distance measurements
      // Sum of all distances / total measurements
      const averageDistance = totalMeasurements > 0 
        ? totalDistanceSum / totalMeasurements 
        : (daysWithData > 0 ? totalDistanceForAvg / daysWithData : 0);
      
      console.log(`[BlinkTrackingService] 📊 Final totals - Blinks: ${totalBlinks}, Avg Distance: ${averageDistance}, Measurements: ${totalMeasurements}, Days: ${daysWithData}`);
      console.log(`[BlinkTrackingService] 📊 Daily averages: [${dailyAverages.map(a => a.toFixed(2)).join(', ')}], Avg Blinks/Day: ${averageBlinksPerDay.toFixed(2)}`);

      return {
        currentWeekBlinks: totalBlinks,
        currentWeekDistance: averageDistance, // Return average, not sum
        currentWeekMeasurements: totalMeasurements,
        averageBlinksPerDay
      };
    } catch (error) {
      console.error('❌ Failed to get blink stats:', error);
      return {
        currentWeekBlinks: 0,
        currentWeekDistance: 0,
        currentWeekMeasurements: 0,
        averageBlinksPerDay: 0
      };
    }
  }

  /**
   * Reset user's blink statistics (useful for testing or manual reset)
   */
  async resetBlinkStats(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Reset in blinks/{userId} document
      const statsRef = doc(db, 'blinks', user.uid);
      await setDoc(statsRef, {
        totalBlinks: 0,
        blinkMeasurementCount: 0,
        totalScreenDistance: 0,
        lastUpdated: new Date()
      });

      console.log('✅ Blink stats reset');
    } catch (error) {
      console.error('❌ Failed to reset blink stats:', error);
      throw error;
    }
  }
}

export default new BlinkTrackingService();

