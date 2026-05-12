import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import EyeImageCaptureService, { EyeImageData } from '@/services/EyeImageCaptureService';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

export default function EyeImagesGalleryScreen() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.darkHighContrast : Colors.lightHighContrast;
  
  const [eyeImages, setEyeImages] = useState<EyeImageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEyeImages();
  }, []);

  const loadEyeImages = async () => {
    try {
      setIsLoading(true);
      const images = await EyeImageCaptureService.getAllEyeImages();
      setEyeImages(images);
    } catch (error) {
      console.error('Failed to load eye images:', error);
      Alert.alert('Error', 'Failed to load eye images');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEyeImages();
    setRefreshing(false);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Images',
      'Are you sure you want to delete all captured eye images? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await EyeImageCaptureService.clearAllEyeImages();
              await loadEyeImages();
              Alert.alert('Success', 'All eye images have been deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete images');
            }
          }
        }
      ]
    );
  };

  const handleSaveToGallery = async (item: EyeImageData) => {
    try {
      const result = await EyeImageCaptureService.saveToGallery(item, false);
      if (result.success) {
        Alert.alert('Success', `Images saved to gallery album: ${result.albumName}`);
      } else {
        Alert.alert('Error', 'Failed to save to gallery. Please check permissions.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save images to gallery');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderImageItem = ({ item }: { item: EyeImageData }) => (
    <View style={[styles.imageCard, { backgroundColor: theme.card }]}>
      <View style={styles.imageHeader}>
        <View style={styles.timestampContainer}>
          <Ionicons name="time-outline" size={16} color={theme.text} />
          <Text style={[styles.timestamp, { color: theme.text }]}>
            {formatDate(item.timestamp)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => handleSaveToGallery(item)}
        >
          <Ionicons name="download-outline" size={20} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <View style={styles.imagesRow}>
        {/* Left Eye */}
        <View style={styles.eyeImageContainer}>
          <Text style={[styles.eyeLabel, { color: theme.text }]}>Left Eye</Text>
          <Image
            source={{ uri: item.leftEyeUri }}
            style={styles.eyeImage}
            resizeMode="cover"
          />
        </View>

        {/* Right Eye */}
        <View style={styles.eyeImageContainer}>
          <Text style={[styles.eyeLabel, { color: theme.text }]}>Right Eye</Text>
          <Image
            source={{ uri: item.rightEyeUri }}
            style={styles.eyeImage}
            resizeMode="cover"
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Eye Images Gallery</Text>
        {eyeImages.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={20} color="#D32F2F" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.text} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading images...</Text>
        </View>
      ) : eyeImages.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="eye-off-outline" size={80} color={theme.text} style={{ opacity: 0.3 }} />
          <Text style={[styles.emptyText, { color: theme.text }]}>No eye images captured yet</Text>
          <Text style={[styles.emptySubtext, { color: theme.text }]}>
            Start a blink detection test with "Capture Eye Images" enabled
          </Text>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.primary || '#2B383D' }]}
            onPress={() => router.push('/blink-test')}
          >
            <Ionicons name="camera-outline" size={20} color="#FAFAFA" />
            <Text style={styles.testButtonText}>Start Blink Test</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="images-outline" size={24} color="#2196F3" />
              <Text style={[styles.statNumber, { color: theme.text }]}>{eyeImages.length}</Text>
              <Text style={[styles.statLabel, { color: theme.text }]}>Total Captures</Text>
            </View>
          </View>

          <FlatList
            data={eyeImages}
            renderItem={renderImageItem}
            keyExtractor={(item) => item.timestamp.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.text}
              />
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  clearButton: {
    padding: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 8,
    textAlign: 'center',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
  },
  testButtonText: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'center',
  },
  statCard: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  imageCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestamp: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    padding: 8,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  eyeImageContainer: {
    flex: 1,
    alignItems: 'center',
  },
  eyeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.7,
  },
  eyeImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
});
