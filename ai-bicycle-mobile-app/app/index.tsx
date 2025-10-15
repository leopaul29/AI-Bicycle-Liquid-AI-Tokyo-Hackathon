import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

// API Configuration
const OPENAI_API_KEY = Constants.expoConfig?.extra?.OPENAI_API_KEY;
const WHISPER_API_URL = Constants.expoConfig?.extra?.WHISPER_API_URL;
const MODEL_SERVER_URL  = Constants.expoConfig?.extra?.MODEL_SERVER_URL

export default function App() {
  // Camera states
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // Audio states
  const [audioPermission, requestAudioPermission] = Audio.usePermissions();

  // App states
  const [status, setStatus] = useState('Ready');
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // Check camera permissions
  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission required</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  // Main capture function: Photo + Audio + Process
  const captureAndProcess = async (includePhoto = true) => {
      if (isProcessing) return;

      try {
        setIsProcessing(true);
        let photoBase64 = null;
        let photoUri = null;

        // 1. TAKE PHOTO (if needed)
        if (includePhoto) {
          setStatus('Taking photo...');

          if (!cameraRef.current) {
            throw new Error('Camera not ready');
          }

          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.7,
            base64: true,
          });

          setCapturedPhoto(photo);
          photoBase64 = photo.base64;
          photoUri = photo.uri
          setStatus('Photo captured! Starting audio recording...');
        } else {
          setStatus('Starting audio recording...');
        }

        // 2. RECORD AUDIO (5 seconds)
        const audioUri = await recordAudio();

        if (!audioUri) {
          throw new Error('Audio recording failed');
        }

        // 3. TRANSCRIBE WITH WHISPER
        setStatus('Transcribing audio...');
        const transcription = await transcribeAudio(audioUri);

        // 4. SEND TO LM STUDIO
        setStatus('Processing with AI...');
//         const aiResponse = await sendToModelServer(photoUri, transcription);
        const aiResponse = await sendToModelServer(photoBase64, transcription);

        // 5. SPEAK RESPONSE
        if (aiResponse) {
            console.log(aiResponse);
          Speech.speak(aiResponse, { language: 'ja' });
        }

        setStatus('Complete!');

      } catch (error) {
        console.error('Capture error:', error);
        setStatus(`Error: ${error.message}`);
        Alert.alert('Error', error.message);
      } finally {
        setIsProcessing(false);
      }
    };

  // Record audio for 5 seconds
  const recordAudio = async () => {
    try {
      // Check audio permissions
      if (!audioPermission?.granted) {
        const result = await requestAudioPermission();
        if (!result.granted) {
          throw new Error('Audio permission denied');
        }
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        allowsRecordingAndroid: true,
      });

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();

      setStatus('Recording audio (5 seconds)...');

      // Wait 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      console.log('Audio recorded:', uri);
      return uri;

    } catch (error) {
      console.error('Recording error:', error);
      throw error;
    }
  };

  // Transcribe audio with Whisper
  const transcribeAudio = async (audioUri) => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        name: 'recording.m4a',
        type: 'audio/m4a',
      } as any);
      formData.append('model', 'whisper-1');
      formData.append('language', 'ja');

      const response = await fetch(WHISPER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API error: ${errorText}`);
      }

      const result = await response.json();
      console.log('Transcription:', result.text);

      Alert.alert("Transcription:"+result.text);
      return result.text || 'No transcription available';

    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  };

  // Send to Model Server (with optional image)
//     const sendToModelServer = async (photoUri, transcriptionText) => {
    const sendToModelServer = async (imageBase64, transcriptionText) => {
        console.log("sendToModelServer");
      try {
        let response;

        if (imageBase64) {
        console.log("with image"+transcriptionText);
          // WITH IMAGE - Use /vqa endpoint
          // Convert base64 to blob
//           const byteCharacters = atob(imageBase64);
//           const byteNumbers = new Array(byteCharacters.length);
//           for (let i = 0; i < byteCharacters.length; i++) {
//             byteNumbers[i] = byteCharacters.charCodeAt(i);
//           }
//           const byteArray = new Uint8Array(byteNumbers);
//           const blob = new Blob([byteArray], { type: 'image/jpeg' });

          // Create FormData for image upload
          const formData = new FormData();
          formData.append('file', {
            uri: `data:image/jpeg;base64,${imageBase64}`,  // Use the URI directly
//             uri: photoUri,  // Use the URI directly
            type: 'image/jpeg',
            name: 'photo.jpg',
          } as any)

//           formData.append('file', imageBase64, 'photo.jpg');
          formData.append('question', transcriptionText || 'この画像を説明してください');
          formData.append('max_new_tokens', '200');

          response = await fetch(`${MODEL_SERVER_URL}/vqa`, {
            method: 'POST',
            body: formData,
          });

        } else {
        console.log("text only: "+transcriptionText);
        Alert.alert("text:"+transcriptionText);
          // TEXT ONLY - Use /generate endpoint
          response = await fetch(`${MODEL_SERVER_URL}/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: transcriptionText || 'おはよう',
              max_new_tokens: 200,
              temperature: 0.7,
            }),
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Model server error: ${errorText}`);
        }

        const result = await response.json();
        console.log("response:"+result);
        const aiResponse = imageBase64 ? result.answer : result.generated_text;

        console.log('AI Response:', aiResponse);
        setStatus(`AI: ${aiResponse.substring(0, 100)}...`);

        return aiResponse;

      } catch (error) {
        console.error('Model server error:', error);
        throw error;
      }
    };

    // Toggle camera facing
    const toggleCameraFacing = () => {
      setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    // Handler for photo + voice
    const handlePhotoAndVoice = () => {
      captureAndProcess(true);
    };

    // Handler for voice only
    const handleVoiceOnly = () => {
      captureAndProcess(false);
    };

  return (
    <View style={styles.container}>
          <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>{status}</Text>
            {isProcessing && <ActivityIndicator color="white" />}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={toggleCameraFacing}
              disabled={isProcessing}
            >
              <Text style={styles.buttonText}>Flip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureButton, isProcessing && styles.buttonDisabled]}
              onPress={handlePhotoAndVoice}
              disabled={isProcessing}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.voiceButton, isProcessing && styles.buttonDisabled]}
              onPress={handleVoiceOnly}
              disabled={isProcessing}
            >
              <Text style={styles.buttonText}>🎤</Text>
            </TouchableOpacity>
          </View>
        </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
  },
  camera: {
    flex: 1,
  },
  statusContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
    marginHorizontal: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'red',
  },
  voiceButton: {
    backgroundColor: 'rgba(255,100,100,0.5)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});