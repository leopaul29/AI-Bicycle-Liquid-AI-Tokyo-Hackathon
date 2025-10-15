import {ConfigContext, ExpoConfig} from "expo/config";

export default ({config} : ConfigContext): ExpoConfig => ({
    ...config,
    "name": "mon-app-velo",
    "slug": "mon-app-velo",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "monappvelo",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true
    },
    "extra": {
        "MODEL_SERVER_URL": process.env.MODEL_SERVER_URL,
      "OPENAI_API_KEY": process.env.OPENAI_API_KEY,
      "WHISPER_API_URL": process.env.WHISPER_API_URL,
      "HUGGINGFACE_API_URL": process.env.HUGGINGFACE_API_URL,
      "HUGGINGFACE_API_KEY": process.env.HUGGINGFACE_API_KEY
    },
    "android": {
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO",
        "INTERNET"
      ],
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera",
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone",
          "recordAudioAndroid": true
        }
      ],
      [
        "expo-audio",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone."
        }
      ],
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ],
      "expo-audio"
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
)
