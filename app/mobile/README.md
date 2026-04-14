# Delivery Optimizer Mobile App

Native mobile application for delivery drivers built with React Native and Expo.

## Overview

This is the mobile client for the Delivery Optimizer platform, part of a larger monorepo that includes:
- **UI**: Next.js web dashboard (`app/ui`)
- **API**: C++ backend server (`app/api`)
- **Mobile**: React Native driver app (this directory)

## Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the development server

   ```bash
   npx expo start
   ```

   You'll have options to open the app in:
   - [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
   - [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
   - [Expo Go](https://expo.dev/go) (quick testing on physical device)

## Development

The app uses file-based routing with Expo Router. Edit files in the **app** directory to make changes.

## Architecture Notes

- Built with React Native and Expo for iOS and Android support
- Uses TypeScript for type safety
- Theme support for light/dark modes
- New Architecture enabled (Bridgeless mode and Fabric rendering)

## Resources

- [Expo documentation](https://docs.expo.dev/)
- [React Native documentation](https://reactnative.dev/)
- [Expo Router guide](https://docs.expo.dev/router/introduction/)
